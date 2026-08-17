import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The ingestion script requires the service role key to bypass RLS on the works table.\n" +
      "Find it in Supabase → Project Settings → API → service_role (secret).",
  );
  process.exit(1);
}

if (!GOOGLE_BOOKS_API_KEY) {
  console.error(
    "Missing GOOGLE_BOOKS_API_KEY in .env.local.\n" +
      "Create an API key at https://console.cloud.google.com/apis/credentials\n" +
      "and enable the Google Books API for your project.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function loadExistingKeys() {
  const { data: existing, error } = await supabase
    .from("works")
    .select("ol_work_key");

  if (error) {
    throw new Error(`Failed to load existing works: ${error.message}`);
  }

  return new Set(
    (existing ?? []).map((r) => r.ol_work_key).filter(Boolean),
  );
}

async function main() {
  console.log("Starting Wreckt Google Books ingestion…");

  const progressPath = join(__dirname, "ingest-progress.json");
  let queryProgress = {};

  try {
    const raw = await readFile(progressPath, "utf8");
    queryProgress = JSON.parse(raw);
  } catch {
    queryProgress = {};
  }

  const existingKeys = await loadExistingKeys();
  console.log(`Loaded ${existingKeys.size} existing works from database\n`);

  const QUERIES = [
    "subject:fiction",
    "subject:fantasy",
    "subject:science fiction",
    "subject:mystery",
    "subject:romance",
    "subject:thriller",
    "subject:biography",
    "subject:history",
    "subject:self-help",
    "subject:literary fiction",
  ];

  const TARGET = 5000;
  const PAGE_SIZE = 20;
  const DELAY_MS = 1000;

  let totalInserted = 0;
  let totalFetched = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const query of QUERIES) {
    if (totalInserted >= TARGET) break;

    let offset = queryProgress[query] ?? 0;
    let keepGoing = true;

    while (keepGoing && totalInserted < TARGET) {
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${PAGE_SIZE}&startIndex=${offset}&key=${GOOGLE_BOOKS_API_KEY}&langRestrict=en&orderBy=relevance`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.log(
            `[google] HTTP ${res.status} for "${query}" at offset ${offset}`,
          );
          keepGoing = false;
          totalErrors++;
          break;
        }

        const data = await res.json();
        const items = data.items || [];
        totalFetched += items.length;

        if (items.length === 0) keepGoing = false;

        const toInsert = [];
        for (const vol of items) {
          const info = vol.volumeInfo || {};
          const key = "gb:" + vol.id;
          if (existingKeys.has(key)) {
            totalSkipped++;
            continue;
          }
          if (!info.title) {
            totalSkipped++;
            continue;
          }

          const book = {
            id: randomUUID(),
            title: info.title,
            author_name: (info.authors || [])[0] || "Unknown",
            pub_year: info.publishedDate
              ? parseInt(info.publishedDate.substring(0, 4))
              : null,
            ol_work_key: key,
            description: info.description
              ? info.description.replace(/<[^>]*>/g, "").substring(0, 500)
              : null,
            genres: (info.categories || [])
              .map((c) => c.toLowerCase())
              .slice(0, 5),
            cover_url:
              info.imageLinks?.thumbnail?.replace("http://", "https://") ||
              null,
            cached_rating: null,
            rating_count: 0,
          };

          toInsert.push(book);
          existingKeys.add(key);
        }

        if (toInsert.length > 0) {
          const { error } = await supabase
            .from("works")
            .upsert(toInsert, { onConflict: "ol_work_key" });

          if (error) {
            console.error(`[google] Insert error:`, error.message);
            totalErrors++;
          } else {
            totalInserted += toInsert.length;
          }
        }

        const pageNum = Math.floor(offset / PAGE_SIZE) + 1;
        console.log(
          `[google] Query '${query}' page ${pageNum}: fetched ${items.length}, inserted ${toInsert.length}, skipped ${items.length - toInsert.length} | Total inserted: ${totalInserted}`,
        );

        offset += PAGE_SIZE;

        queryProgress[query] = offset;
        await writeFile(
          progressPath,
          JSON.stringify(queryProgress, null, 2) + "\n",
        );
      } catch (err) {
        console.error(
          `[google] Fetch error at "${query}" offset ${offset}:`,
          err.message,
        );
        totalErrors++;
        keepGoing = false;
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log("\n─── Ingestion complete ───");
  console.log(`Total fetched:  ${totalFetched}`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total skipped:  ${totalSkipped}`);
  console.log(`Errors:         ${totalErrors}`);

  console.log("\nCurrent progress:");
  for (const [query, offset] of Object.entries(queryProgress)) {
    console.log(`  ${query}: offset ${offset}`);
  }

  console.log("\nRun the script again to continue from where it left off.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
