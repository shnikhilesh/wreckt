import { EditLogButton } from "@/components/EditLogButton";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const LIST_ORDER = ["Stack", "Reading now", "Finished", "Dropped"] as const;
const COVERS_PER_LIST = 10;

type Profile = {
  id: string;
  username: string;
  created_at: string;
};

type Work = {
  id: string;
  title: string;
  cover_url: string | null;
};

type ListSection = {
  id: string;
  name: string;
  entries: { work_id: string; added_at: string; works: Work | null }[];
  total: number;
};

type Take = {
  id: string;
  body: string;
  created_at: string;
  work_id: string;
  works: { id: string; title: string } | null;
  score: number | null;
};

function bookInitials(title: string) {
  return title.trim().slice(0, 2).toUpperCase();
}

async function loadListSections(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ListSection[]> {
  const { data: listsRaw } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", userId);

  const orderedLists = LIST_ORDER.map((name) =>
    listsRaw?.find((list) => list.name === name),
  ).filter((list): list is { id: string; name: string } => Boolean(list));

  return Promise.all(
    orderedLists.map(async (list) => {
      const [{ data: entries }, { count }] = await Promise.all([
        supabase
          .from("list_entries")
          .select("work_id, added_at, works(id, title, cover_url)")
          .eq("list_id", list.id)
          .order("added_at", { ascending: false })
          .limit(COVERS_PER_LIST),
        supabase
          .from("list_entries")
          .select("*", { count: "exact", head: true })
          .eq("list_id", list.id),
      ]);

      return {
        ...list,
        entries: (entries ?? []) as unknown as ListSection["entries"],
        total: count ?? 0,
      };
    }),
  );
}

async function loadRecentTakes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Take[]> {
  const { data: takesRaw } = await supabase
    .from("takes")
    .select("id, body, created_at, work_id, works(id, title)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  const takes = (takesRaw ?? []) as unknown as Omit<Take, "score">[];
  if (takes.length === 0) return [];

  const workIds = takes.map((take) => take.work_id);
  const { data: ratings } = await supabase
    .from("ratings")
    .select("work_id, score")
    .eq("user_id", userId)
    .in("work_id", workIds);

  const scoreByWorkId = new Map(
    (ratings ?? []).map((rating) => [rating.work_id, rating.score]),
  );

  return takes.map((take) => ({
    ...take,
    score: scoreByWorkId.get(take.work_id) ?? null,
  }));
}

export default async function LogPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, created_at")
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

  const [lists, takes] = await Promise.all([
    loadListSections(supabase, profile.id),
    loadRecentTakes(supabase, profile.id),
  ]);

  const finishedCount = lists.find((l) => l.name === "Finished")?.total ?? 0;
  const readingCount = lists.find((l) => l.name === "Reading now")?.total ?? 0;
  const stackCount = lists.find((l) => l.name === "Stack")?.total ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              @{profile.username}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              {finishedCount} finished · {readingCount} reading now ·{" "}
              {stackCount} in stack
            </p>
          </div>
          <EditLogButton profileId={profile.id} />
        </div>

        {/* List sections */}
        <div className="mt-10 space-y-10">
          {lists.map((list) => (
            <section key={list.id}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-white">
                  {list.name}
                </h2>
                {list.total > COVERS_PER_LIST && (
                  <span className="text-sm text-zinc-500">See all →</span>
                )}
              </div>

              {list.entries.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Nothing here yet</p>
              ) : (
                <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                  {list.entries.map((entry) =>
                    entry.works ? (
                      <Link
                        key={entry.work_id}
                        href={`/books/${entry.works.id}`}
                        className="w-20 shrink-0 transition-transform duration-200 hover:scale-[1.03]"
                      >
                        <div className="aspect-[2/3] overflow-hidden rounded-md bg-zinc-800 shadow-md">
                          {entry.works.cover_url ? (
                            <img
                              src={`/api/cover?url=${encodeURIComponent(entry.works.cover_url)}`}
                              alt={entry.works.title}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm font-semibold text-zinc-500">
                              {bookInitials(entry.works.title)}
                            </div>
                          )}
                        </div>
                      </Link>
                    ) : null,
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Recent takes */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Recent takes</h2>
          {takes.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No takes yet</p>
          ) : (
            <div className="mt-3 space-y-4">
              {takes.map((take) => (
                <div
                  key={take.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    {take.works ? (
                      <Link
                        href={`/books/${take.works.id}`}
                        className="text-sm font-medium text-white transition-colors hover:text-zinc-300"
                      >
                        {take.works.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-white" />
                    )}
                    {take.score != null && (
                      <span className="shrink-0 text-sm text-zinc-400">
                        <span className="text-amber-400">★</span>{" "}
                        {take.score}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {take.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
