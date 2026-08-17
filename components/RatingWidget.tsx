"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RatingWidgetProps = {
  workId: string;
};

export function RatingWidget({ workId }: RatingWidgetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUserRating = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoggedIn(false);
      setUserRating(null);
      setLoading(false);
      return;
    }

    setIsLoggedIn(true);

    const { data } = await supabase
      .from("ratings")
      .select("score")
      .eq("work_id", workId)
      .eq("user_id", user.id)
      .maybeSingle();

    setUserRating(data?.score ?? null);
    setLoading(false);
  }, [workId]);

  useEffect(() => {
    loadUserRating();
  }, [loadUserRating]);

  const handleStarClick = async (score: number) => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    setConfirmation(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("ratings").upsert(
      {
        user_id: user.id,
        work_id: workId,
        score,
      },
      { onConflict: "user_id,work_id" },
    );

    if (error) {
      console.error("Failed to save rating:", error.message);
      setSubmitting(false);
      return;
    }

    setUserRating(score);
    setConfirmation(`Your rating: ${score} stars`);
    setSubmitting(false);
    router.refresh();
  };

  const activeRating = hoverRating ?? userRating ?? 0;

  if (loading) {
    return (
      <div className="mt-8 animate-pulse">
        <div className="h-4 w-24 rounded bg-zinc-800" />
        <div className="mt-3 flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-8 rounded bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-sm font-medium text-zinc-300">Rate this book</p>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={submitting}
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            className={`text-2xl transition-colors disabled:opacity-50 ${
              star <= activeRating
                ? "text-amber-400"
                : "text-zinc-600 hover:text-amber-300"
            }`}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>
      {confirmation && (
        <p className="mt-2 text-sm text-zinc-400">{confirmation}</p>
      )}
    </div>
  );
}
