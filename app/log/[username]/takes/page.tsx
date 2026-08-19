import { relativeTime } from "@/lib/relativeTime";
import { starString } from "@/lib/stars";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Profile = {
  id: string;
  username: string;
};

type Take = {
  id: string;
  body: string;
  resonated_count: number;
  created_at: string;
  work_id: string;
  works: { id: string; title: string; cover_url: string | null } | null;
};

function bookInitials(title: string) {
  return title.trim().slice(0, 2).toUpperCase();
}

export default async function UserTakesPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", username)
    .maybeSingle<Profile>();

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
        <p className="text-lg text-zinc-300">This Log doesn&apos;t exist</p>
        <Link
          href="/books"
          className="mt-4 text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← Browse books
        </Link>
      </main>
    );
  }

  const { data: takesRaw } = await supabase
    .from("takes")
    .select(
      "id, body, resonated_count, created_at, work_id, works(id, title, cover_url)",
    )
    .eq("user_id", profile.id)
    .eq("is_flagged", false)
    .order("created_at", { ascending: false });

  const takes = (takesRaw ?? []) as unknown as Take[];

  const workIds = takes.map((take) => take.work_id);
  const { data: ratings } = workIds.length
    ? await supabase
        .from("ratings")
        .select("work_id, score")
        .eq("user_id", profile.id)
        .in("work_id", workIds)
    : { data: [] as { work_id: string; score: number }[] };

  const scoreByWorkId = new Map(
    (ratings ?? []).map((rating) => [rating.work_id, rating.score]),
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/log/${profile.username}`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← @{profile.username}&apos;s Log
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          @{profile.username}&apos;s takes
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {takes.length} take{takes.length === 1 ? "" : "s"}
        </p>

        <div className="mt-6 space-y-4">
          {takes.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              No takes yet
            </p>
          ) : (
            takes.map((take) => {
              const score = scoreByWorkId.get(take.work_id) ?? null;
              return (
                <div
                  key={take.id}
                  className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <Link
                    href={`/books/${take.work_id}`}
                    className="w-16 shrink-0"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-800">
                      {take.works?.cover_url ? (
                        <img
                          src={`/api/cover?url=${encodeURIComponent(take.works.cover_url)}`}
                          alt={take.works.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-500">
                          {take.works ? bookInitials(take.works.title) : ""}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {take.works && (
                        <Link
                          href={`/books/${take.work_id}`}
                          className="text-sm font-medium text-white transition-colors hover:text-zinc-300"
                        >
                          {take.works.title}
                        </Link>
                      )}
                      {score != null && (
                        <span className="text-xs text-amber-400">
                          {starString(score)}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500">
                        {relativeTime(take.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                      {take.body}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      ♥ {take.resonated_count} resonated
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
