import { BookCard, type BookCardWork } from "@/components/BookCard";
import { EditLogButton } from "@/components/EditLogButton";
import {
  LIST_EMPTY_MESSAGES,
  LIST_ORDER,
  slugifyListName,
  type ListName,
} from "@/lib/lists";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const COVERS_PER_LIST = 10;

type Profile = {
  id: string;
  username: string;
  created_at: string;
};

type ListSection = {
  id: string;
  name: ListName;
  entries: { work_id: string; added_at: string; works: BookCardWork | null }[];
  total: number;
};

type RecentTake = {
  id: string;
  body: string;
  resonated_count: number;
  created_at: string;
  work_id: string;
  works: { id: string; title: string; cover_url: string | null } | null;
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

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
  ).filter((list): list is { id: string; name: ListName } => Boolean(list));

  return Promise.all(
    orderedLists.map(async (list) => {
      const [{ data: entries }, { count }] = await Promise.all([
        supabase
          .from("list_entries")
          .select(
            "work_id, added_at, works(id, title, author_name, cover_url, cached_rating)",
          )
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
): Promise<{ takes: RecentTake[]; total: number }> {
  const [{ data: takesRaw }, { count }] = await Promise.all([
    supabase
      .from("takes")
      .select(
        "id, body, resonated_count, created_at, work_id, works(id, title, cover_url)",
      )
      .eq("user_id", userId)
      .eq("is_flagged", false)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("takes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_flagged", false),
  ]);

  return {
    takes: (takesRaw ?? []) as unknown as RecentTake[],
    total: count ?? 0,
  };
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

  const [lists, { takes, total: totalTakes }] = await Promise.all([
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
                  {list.name}{" "}
                  <span className="font-normal text-zinc-500">
                    ({list.total})
                  </span>
                </h2>
                {list.total > COVERS_PER_LIST && (
                  <Link
                    href={`/log/${profile.username}/lists/${slugifyListName(list.name)}`}
                    className="text-sm text-zinc-500 transition-colors hover:text-white"
                  >
                    See all →
                  </Link>
                )}
              </div>

              {list.entries.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">
                  {LIST_EMPTY_MESSAGES[list.name]}
                </p>
              ) : (
                <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
                  {list.entries.map((entry) =>
                    entry.works ? (
                      <BookCard
                        key={entry.work_id}
                        work={entry.works}
                        compact
                      />
                    ) : null,
                  )}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Recent takes */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-white">Recent takes</h2>
            {totalTakes > 3 && (
              <Link
                href={`/log/${profile.username}/takes`}
                className="text-sm text-zinc-500 transition-colors hover:text-white"
              >
                See all takes →
              </Link>
            )}
          </div>

          {takes.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No takes yet</p>
          ) : (
            <div className="mt-3 space-y-3">
              {takes.map((take) => (
                <div
                  key={take.id}
                  className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                >
                  <Link
                    href={`/books/${take.work_id}`}
                    className="w-12 shrink-0"
                  >
                    <div className="aspect-[2/3] overflow-hidden rounded bg-zinc-800">
                      {take.works?.cover_url ? (
                        <img
                          src={`/api/cover?url=${encodeURIComponent(take.works.cover_url)}`}
                          alt={take.works.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-500">
                          {take.works ? bookInitials(take.works.title) : ""}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    {take.works && (
                      <Link
                        href={`/books/${take.work_id}`}
                        className="text-sm font-medium text-white transition-colors hover:text-zinc-300"
                      >
                        {take.works.title}
                      </Link>
                    )}
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                      {truncate(take.body, 100)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      ♥ {take.resonated_count} resonated
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
