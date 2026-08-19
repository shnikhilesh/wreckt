import { AddToListButton } from "@/components/AddToListButton";
import { RatingWidget } from "@/components/RatingWidget";
import { TakesSection } from "@/components/TakesSection";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";

type Work = {
  id: string;
  title: string;
  author_name: string;
  pub_year: number | null;
  description: string | null;
  genres: string[] | null;
  cover_url: string | null;
};

type WorkRating = {
  work_id: string;
  avg_score: number | null;
  total_votes: number;
  flagged_votes: number;
};

function bookInitials(title: string, author: string) {
  const t = title.trim()[0] ?? "";
  const a = author.trim()[0] ?? "";
  return (t + a).toUpperCase();
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: work, error: workError } = await supabase
    .from("works")
    .select("id, title, author_name, pub_year, description, genres, cover_url")
    .eq("id", id)
    .single();

  if (workError || !work) {
    notFound();
  }

  const typedWork = work as Work;

  const { data: workRating } = await supabase
    .from("work_ratings")
    .select("*")
    .eq("work_id", id)
    .maybeSingle();

  const rating = workRating as WorkRating | null;
  const avgScore =
    rating?.avg_score != null ? Number(rating.avg_score).toFixed(1) : null;
  const totalVotes = rating?.total_votes ?? 0;
  const initials = bookInitials(typedWork.title, typedWork.author_name);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href="/books"
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Browse books
        </Link>

        {/* Hero */}
        <div className="mt-6 flex gap-6 sm:gap-8">
          <div className="w-[200px] shrink-0">
            <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 shadow-lg">
              {typedWork.cover_url ? (
                <img
                  src={`/api/cover?url=${encodeURIComponent(typedWork.cover_url)}`}
                  alt={typedWork.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-3xl font-semibold text-zinc-500">
                  {initials}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
              {typedWork.title}
            </h1>
            <p className="mt-2 text-lg text-zinc-400">{typedWork.author_name}</p>
            {typedWork.pub_year && (
              <p className="mt-1 text-sm text-zinc-500">{typedWork.pub_year}</p>
            )}

            {typedWork.genres && typedWork.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {typedWork.genres.map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-300"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 text-sm text-zinc-400">
              {avgScore ? (
                <span>
                  <span className="text-amber-400">★</span>{" "}
                  <span className="text-zinc-200">{avgScore}</span>
                  <span className="text-zinc-500">
                    {" "}
                    ({totalVotes} ratings)
                  </span>
                </span>
              ) : (
                <span>No ratings yet</span>
              )}
            </div>
          </div>
        </div>

        <RatingWidget workId={id} />

        <AddToListButton workId={id} />

        {/* Description */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">About this book</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {typedWork.description ?? "No description available."}
          </p>
        </section>

        <TakesSection workId={id} />
      </div>
    </main>
  );
}
