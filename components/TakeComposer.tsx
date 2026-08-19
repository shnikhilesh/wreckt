"use client";

import { starString } from "@/lib/stars";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useState } from "react";

const MIN_LENGTH = 10;
const MAX_LENGTH = 500;

type TakeRow = {
  id: string;
  body: string;
};

export function TakeComposer({
  workId,
  onChange,
}: {
  workId: string;
  onChange?: () => void;
}) {
  const [supabase] = useState(() => createClient());
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [existingTake, setExistingTake] = useState<TakeRow | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setCheckingAuth(false);
        return;
      }

      setUser(session.user);

      const [{ data: take }, { data: rating }] = await Promise.all([
        supabase
          .from("takes")
          .select("id, body")
          .eq("work_id", workId)
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("ratings")
          .select("score")
          .eq("work_id", workId)
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (take) {
        setExistingTake(take);
        setBody(take.body);
      }
      setRatingScore(rating?.score ?? null);
      setCheckingAuth(false);
    };

    load();
  }, [supabase, workId]);

  const handleSubmit = async () => {
    if (!user) return;
    const trimmed = body.trim();
    if (trimmed.length < MIN_LENGTH) return;

    setSubmitting(true);
    setError(null);

    const { data, error: upsertError } = await supabase
      .from("takes")
      .upsert(
        { user_id: user.id, work_id: workId, body: trimmed },
        { onConflict: "user_id,work_id" },
      )
      .select("id, body")
      .single();

    if (upsertError || !data) {
      console.error("Failed to save take:", upsertError);
      setError(
        upsertError?.message
          ? `Couldn't save your take — ${upsertError.message}`
          : "Couldn't save your take — try again",
      );
      setSubmitting(false);
      return;
    }

    setExistingTake(data);
    setBody(data.body);
    setSubmitting(false);
    onChange?.();
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("takes")
      .delete()
      .eq("user_id", user.id)
      .eq("work_id", workId);

    if (deleteError) {
      console.error("Failed to delete take:", deleteError);
      setError(
        deleteError.message
          ? `Couldn't delete your take — ${deleteError.message}`
          : "Couldn't delete your take — try again",
      );
      setDeleting(false);
      return;
    }

    setExistingTake(null);
    setBody("");
    setConfirmingDelete(false);
    setDeleting(false);
    onChange?.();
  };

  if (checkingAuth) {
    return <div className="mt-6 h-32 animate-pulse rounded-xl bg-zinc-900" />;
  }

  if (!user) {
    return (
      <p className="mt-6 text-sm text-zinc-400">
        <Link
          href="/login"
          className="text-white underline underline-offset-4 hover:text-zinc-300"
        >
          Sign in
        </Link>{" "}
        to share your take
      </p>
    );
  }

  const trimmedLength = body.trim().length;
  const canSubmit =
    trimmedLength >= MIN_LENGTH && trimmedLength <= MAX_LENGTH && !submitting;

  return (
    <div className="mt-6">
      {ratingScore != null && (
        <p className="mb-2 text-sm text-zinc-400">
          Your rating:{" "}
          <span className="text-amber-400">{starString(ratingScore)}</span>
        </p>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
        placeholder="What did you think? Be honest — no spoilers unless you warn us."
        rows={4}
        className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-600"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          {body.length} / {MAX_LENGTH}
        </span>

        <div className="flex items-center gap-4">
          {existingTake && !confirmingDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-sm text-zinc-500 transition-colors hover:text-red-400"
            >
              Delete take
            </button>
          )}

          {confirmingDelete && (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-zinc-400">Delete this take?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-400 transition-colors hover:text-red-300 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-zinc-500 transition-colors hover:text-white"
              >
                Cancel
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : existingTake
                ? "Update take"
                : "Share your take"}
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
