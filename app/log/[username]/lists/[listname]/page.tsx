import { BookCard, type BookCardWork } from "@/components/BookCard";
import { LIST_EMPTY_MESSAGES, listNameFromSlug } from "@/lib/lists";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type Profile = {
  id: string;
  username: string;
};

function NotFound({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
      <p className="text-lg text-zinc-300">{message}</p>
      <Link
        href="/books"
        className="mt-4 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        ← Browse books
      </Link>
    </main>
  );
}

export default async function ListPage({
  params,
}: {
  params: Promise<{ username: string; listname: string }>;
}) {
  const { username, listname } = await params;
  const listName = listNameFromSlug(listname);

  if (!listName) {
    return <NotFound message="This list doesn't exist" />;
  }

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", username)
    .maybeSingle<Profile>();

  if (!profile) {
    return <NotFound message="This Log doesn't exist" />;
  }

  const { data: list } = await supabase
    .from("lists")
    .select("id, name")
    .eq("user_id", profile.id)
    .eq("name", listName)
    .maybeSingle<{ id: string; name: string }>();

  if (!list) {
    return <NotFound message="This list doesn't exist" />;
  }

  const { data: entriesRaw } = await supabase
    .from("list_entries")
    .select(
      "work_id, added_at, works(id, title, author_name, cover_url, cached_rating)",
    )
    .eq("list_id", list.id)
    .order("added_at", { ascending: false });

  const entries = (entriesRaw ?? []) as unknown as {
    work_id: string;
    added_at: string;
    works: BookCardWork | null;
  }[];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Link
          href={`/log/${profile.username}`}
          className="text-sm text-zinc-400 transition-colors hover:text-white"
        >
          ← @{profile.username}&apos;s Log
        </Link>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {listName}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {entries.length} book{entries.length === 1 ? "" : "s"}
        </p>

        <div className="mt-6">
          {entries.length === 0 ? (
            <p className="py-16 text-center text-sm text-zinc-500">
              {LIST_EMPTY_MESSAGES[listName]}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {entries.map((entry) =>
                entry.works ? (
                  <BookCard key={entry.work_id} work={entry.works} />
                ) : null,
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
