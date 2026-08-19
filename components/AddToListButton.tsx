"use client";

import { LIST_ICONS, LIST_ORDER, type ListName } from "@/lib/lists";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ListRow = {
  id: string;
  name: string;
  list_entries: { work_id: string }[];
};

export function AddToListButton({ workId }: { workId: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [listIdByName, setListIdByName] = useState<Record<string, string>>(
    {},
  );
  const [allListIds, setAllListIds] = useState<string[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const loadLists = async () => {
      const { data } = await supabase
        .from("lists")
        .select("id, name, list_entries(work_id)")
        .eq("user_id", user.id);

      const rows = (data ?? []) as unknown as ListRow[];
      const map: Record<string, string> = {};
      let foundId: string | null = null;

      rows.forEach((list) => {
        map[list.name] = list.id;
        if (list.list_entries.some((entry) => entry.work_id === workId)) {
          foundId = list.id;
        }
      });

      setListIdByName(map);
      setAllListIds(rows.map((list) => list.id));
      setCurrentListId(foundId);
    };

    loadLists();
  }, [supabase, user, workId]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const handleSelect = async (listName: ListName) => {
    const targetId = listIdByName[listName];
    if (!targetId || syncing) return;

    setOpen(false);
    setSyncing(true);
    const previousListId = currentListId;

    if (currentListId === targetId) {
      setCurrentListId(null);
      showToast(`Removed from ${listName}`);

      const { error } = await supabase
        .from("list_entries")
        .delete()
        .eq("work_id", workId)
        .eq("list_id", targetId);

      if (error) {
        setCurrentListId(previousListId);
        showToast("Couldn't update — try again");
      }
    } else {
      setCurrentListId(targetId);
      showToast(`Added to ${listName}`);

      const { error: deleteError } = await supabase
        .from("list_entries")
        .delete()
        .eq("work_id", workId)
        .in("list_id", allListIds);

      const { error: insertError } = deleteError
        ? { error: deleteError }
        : await supabase
            .from("list_entries")
            .insert({ list_id: targetId, work_id: workId });

      if (deleteError || insertError) {
        setCurrentListId(previousListId);
        showToast("Couldn't update — try again");
      }
    }

    setSyncing(false);
  };

  if (checkingAuth) {
    return (
      <div className="mt-6 h-10 w-40 animate-pulse rounded-full bg-zinc-800" />
    );
  }

  if (!user) {
    return (
      <div className="mt-6">
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-zinc-500 hover:bg-zinc-900"
        >
          Add to your Log
        </button>
      </div>
    );
  }

  const currentListName = LIST_ORDER.find(
    (name) => listIdByName[name] === currentListId,
  );

  return (
    <div ref={containerRef} className="relative mt-6 inline-block">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
          currentListName
            ? "border-white bg-white text-zinc-950 hover:opacity-90"
            : "border-zinc-700 text-white hover:border-zinc-500 hover:bg-zinc-900"
        }`}
      >
        {currentListName
          ? `${LIST_ICONS[currentListName]} In ${currentListName}`
          : "+ Add to a list"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-10 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {LIST_ORDER.map((listName) => {
            const isSelected = listIdByName[listName] === currentListId;
            return (
              <button
                key={listName}
                type="button"
                onClick={() => handleSelect(listName)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>
                  <span className="mr-2">{LIST_ICONS[listName]}</span>
                  {listName}
                </span>
                {isSelected && <span className="text-emerald-400">✓</span>}
              </button>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
