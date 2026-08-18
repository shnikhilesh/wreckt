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

if (!SUPABASE_URL) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL in .env.local",
  );
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SUBJECTS = [
  "fiction",
  "fantasy",
  "science_fiction",
  "mystery",
  "romance",
  "thriller",
  "biography",
  "history",
  "self_help",
  "literary_fiction",
];

const TARGET = 5000;
const PAGE_SIZE = 100;
const BATCH_SIZE = 100;
const PAGE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function mapBook(doc) {
  const olWorkKey = doc.key ?? null;
  if (!olWorkKey) return null;

  let description = null;
  if (doc.first_sentence) {
    description = Array.isArray(doc.first_sentence)
      ? doc.first_sentence[0]
      : doc.first_sentence;
  }

  const genres = Array.isArray(doc.subject)
    ? doc.subject.slice(0, 5).map((s) => String(s).toLowerCase())
    : [];

  const coverUrl =
    doc.cover_i != null
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null;

  return {
    id: randomUUID(),
    title: doc.title ?? "Unknown",
    author_name: doc.author_name?.[0] ?? "Unknown",
    pub_year: doc.first_publish_year ?? null,
    ol_work_key: olWorkKey,
    description,
    genres,
    cover_url: coverUrl,
    cached_rating: null,
    rating_count: 0,
  };
}

async function insertBatch(batch) {
  const { error } = await supabase
    .from("works")
    .upsert(batch, { onConflict: "ol_work_key" });

  if (error) {
    throw new Error(error.message);
  }
}

function dedupeAndFilter(mappedBooks, existingKeys) {
  const seen = new Set();
  const toInsert = [];
  let skipped = 0;

  for (const book of mappedBooks) {
    if (seen.has(book.ol_work_key) || existingKeys.has(book.ol_work_key)) {
      skipped++;
      continue;
    }

    seen.add(book.ol_work_key);
    toInsert.push(book);
  }

  return { toInsert, skipped };
}

async function loadAllExistingKeys() {
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

function buildSubjectUrl(subject, offset) {
  return `https://openlibrary.org/search.json?subject=${subject}&fields=key,title,author_name,first_publish_year,subject,cover_i,first_sentence&limit=${PAGE_SIZE}&offset=${offset}`;
}

async function main() {
  console.log("Starting Wreckt Open Library ingestion…");
  console.log(`Target: ${TARGET} inserted books across ${SUBJECTS.length} subjects\n`);

  const progressPath = join(__dirname, "ingest-progress-ol.json");
  let progress = {};

  try {
    const raw = await readFile(progressPath, "utf8");
    progress = JSON.parse(raw);
  } catch {
    progress = {};
  }

  const existingKeys = await loadAllExistingKeys();
  console.log(`Loaded ${existingKeys.size} existing works from DB\n`);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const errors = [];

  for (const subject of SUBJECTS) {
    if (totalInserted >= TARGET) break;

    let offset = progress[subject] ?? 0;
    let keepGoing = true;

    while (keepGoing && totalInserted < TARGET) {
      const pageNum = Math.floor(offset / PAGE_SIZE) + 1;
      const url = buildSubjectUrl(subject, offset);

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} for subject "${subject}" at offset ${offset}`,
          );
        }

        const data = await response.json();
        const results = data.docs ?? [];
        const fetched = results.length;
        totalFetched += fetched;

        if (fetched === 0) keepGoing = false;
        if (fetched < PAGE_SIZE) keepGoing = false;

        const mapped = results.map(mapBook).filter(Boolean);
        const { toInsert, skipped } = dedupeAndFilter(mapped, existingKeys);

        let inserted = 0;

        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);

          try {
            await insertBatch(batch);
            inserted += batch.length;

            for (const book of batch) {
              existingKeys.add(book.ol_work_key);
            }
          } catch (err) {
            errors.push({
              subject,
              page: pageNum,
              offset,
              batch: Math.floor(i / BATCH_SIZE) + 1,
              message: err.message,
            });
            console.error(
              `[ol] Subject '${subject}' page ${pageNum} (offset ${offset}), batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`,
            );
          }
        }

        totalInserted += inserted;
        totalSkipped += skipped;

        console.log(
          `[ol] Subject '${subject}' page ${pageNum} (offset ${offset}): fetched ${fetched}, inserted ${inserted}, skipped ${skipped} | Total inserted: ${totalInserted}`,
        );

        const newOffset = offset + PAGE_SIZE;
        progress[subject] = newOffset;
        await writeFile(progressPath, JSON.stringify(progress, null, 2) + "\n");
        offset = newOffset;

        if (totalInserted >= TARGET) {
          console.log("Target reached");
          break;
        }

        if (keepGoing) {
          await sleep(PAGE_DELAY_MS);
        }
      } catch (err) {
        errors.push({ subject, page: pageNum, offset, message: err.message });
        console.error(
          `[ol] Subject '${subject}' page ${pageNum} (offset ${offset}): ${err.message}`,
        );
        keepGoing = false;
      }
    }

    if (totalInserted >= TARGET) break;
  }

  console.log("\n─── Ingestion complete ───");
  console.log(`Total fetched:  ${totalFetched}`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total skipped:  ${totalSkipped}`);

  if (errors.length > 0) {
    console.log(`Errors:         ${errors.length}`);
    for (const err of errors) {
      const location = err.batch
        ? `subject '${err.subject}' page ${err.page} (offset ${err.offset}), batch ${err.batch}`
        : `subject '${err.subject}' page ${err.page} (offset ${err.offset})`;
      console.log(`  - ${location}: ${err.message}`);
    }
  } else {
    console.log("Errors:         0");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
