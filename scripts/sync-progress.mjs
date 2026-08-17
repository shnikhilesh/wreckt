import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Find it in Supabase → Project Settings → API → service_role (secret).",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const QUERY_GENRE_MAP = {
  "subject:fiction": "fiction",
  "subject:fantasy": "fantasy",
  "subject:science fiction": "science fiction",
  "subject:mystery": "mystery",
  "subject:romance": "romance",
  "subject:thriller": "thriller",
  "subject:biography": "biography",
  "subject:history": "history",
  "subject:self-help": "self-help",
  "subject:literary fiction": "literary fiction",
};

const PAGE_SIZE = 20;

function offsetForCount(count) {
  return Math.floor(count / PAGE_SIZE) * PAGE_SIZE;
}

async function main() {
  const progress = {};

  for (const [query, genre] of Object.entries(QUERY_GENRE_MAP)) {
    const { count, error } = await supabase
      .from("works")
      .select("*", { count: "exact", head: true })
      .contains("genres", [genre]);

    if (error) {
      console.error(`${query}: failed to count — ${error.message}`);
      process.exit(1);
    }

    const bookCount = count ?? 0;
    const offset = offsetForCount(bookCount);
    progress[query] = offset;

    console.log(`${query}: ${bookCount} books in DB → starting offset ${offset}`);
  }

  const outputPath = join(__dirname, "ingest-progress.json");
  await writeFile(outputPath, JSON.stringify(progress, null, 2) + "\n");

  console.log("Progress file written to scripts/ingest-progress.json");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
