"use client";

import { relativeTime } from "@/lib/relativeTime";
import { starString } from "@/lib/stars";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TakeRow = {
  id: string;
  body: string;
  resonated_count: number;
  created_at: string;
  user_id: string;
  users: { username: string } | null;
};

type DisplayTake = TakeRow & {
  score: number | null;
  resonated: boolean;
};

export function TakesList({
  workId,
  refreshToken,
  onCountChange,
}: {
  workId: string;
  refreshToken?: number;
  onCountChange?: (count: number) => void;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [takes, setTakes] = useState<DisplayTake[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      const [{ data: takesRaw }, { count }] = await Promise.all([
        supabase
          .from("takes")
          .select(
            "id, body, resonated_count, created_at, user_id, users(username)",
          )
          .eq("work_id", workId)
          .eq("is_flagged", false)
          .order("resonated_count", { ascending: false })
          .limit(20),
        supabase
          .from("takes")
          .select("*", { count: "exact", head: true })
          .eq("work_id", workId)
          .eq("is_flagged", false),
      ]);

      const rows = (takesRaw ?? []) as unknown as TakeRow[];
      const userIds = rows.map((t) => t.user_id);
      const takeIds = rows.map((t) => t.id);

      const [{ data: ratings }, resonatedResult] = await Promise.all([
        userIds.length
          ? supabase
              .from("ratings")
              .select("user_id, score")
              .eq("work_id", workId)
              .in("user_id", userIds)
          : Promise.resolve({
              data: [] as { user_id: string; score: number }[],
            }),
        currentUser && takeIds.length
          ? supabase
              .from("resonated_by")
              .select("take_id")
              .eq("user_id", currentUser.id)
              .in("take_id", takeIds)
          : Promise.resolve({ data: [] as { take_id: string }[] }),
      ]);

      const scoreByUserId = new Map(
        (ratings ?? []).map((r) => [r.user_id, r.score]),
      );
      const resonatedSet = new Set(
        (resonatedResult.data ?? []).map((r) => r.take_id),
      );

      setTakes(
        rows.map((t) => ({
          ...t,
          score: scoreByUserId.get(t.user_id) ?? null,
          resonated: resonatedSet.has(t.id),
        })),
      );
      setTotalCount(count ?? 0);
      onCountChange?.(count ?? 0);
      setLoading(false);
    };

    load();
  }, [supabase, workId, refreshToken, onCountChange]);

  const handleResonate = async (take: DisplayTake) => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (pendingIds.has(take.id)) return;

    setPendingIds((prev) => new Set(prev).add(take.id));

    const wasResonated = take.resonated;
    setTakes((prev) =>
      prev.map((t) =>
        t.id === take.id
          ? {
              ...t,
              resonated: !wasResonated,
              resonated_count: t.resonated_count + (wasResonated ? -1 : 1),
            }
          : t,
      ),
    );

    const { error } = wasResonated
      ? await supabase
          .from("resonated_by")
          .delete()
          .eq("user_id", user.id)
          .eq("take_id", take.id)
      : await supabase
          .from("resonated_by")
          .insert({ user_id: user.id, take_id: take.id });

    if (error) {
      setTakes((prev) =>
        prev.map((t) =>
          t.id === take.id
            ? {
                ...t,
                resonated: wasResonated,
                resonated_count: t.resonated_count + (wasResonated ? 1 : -1),
              }
            : t,
        ),
      );
    }

    setPendingIds((prev) => {
      const next = new Set(prev);
      next.delete(take.id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-zinc-900 p-4">
            <div className="h-4 w-32 rounded bg-zinc-800" />
            <div className="mt-3 h-3 w-full rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-2/3 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-zinc-400">
        {totalCount} take{totalCount === 1 ? "" : "s"}
      </p>

      {takes.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No takes yet — be the first
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {takes.map((take) => (
            <div
              key={take.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/log/${take.users?.username}`}
                  className="text-sm font-medium text-white transition-colors hover:text-zinc-300"
                >
                  @{take.users?.username}
                </Link>
                {take.score != null && (
                  <span className="text-xs text-amber-400">
                    {starString(take.score)}
                  </span>
                )}
                <span className="text-xs text-zinc-500">
                  {relativeTime(take.created_at)}
                </span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {take.body}
              </p>

              <button
                type="button"
                onClick={() => handleResonate(take)}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  take.resonated
                    ? "border-rose-500 bg-rose-500/10 text-rose-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                }`}
              >
                <span>♥</span>
                <span>Resonated ({take.resonated_count})</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
