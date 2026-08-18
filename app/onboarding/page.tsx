"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export default function OnboardingPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.username) {
        router.replace(`/log/${profile.username}`);
        return;
      }

      setUserId(user.id);
      setCheckingAuth(false);
    };

    init();
  }, [router]);

  useEffect(() => {
    if (!username) {
      setAvailability("idle");
      return;
    }

    if (!USERNAME_REGEX.test(username)) {
      setAvailability("invalid");
      return;
    }

    setAvailability("checking");
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      setAvailability(data ? "taken" : "available");
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || availability !== "available") return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("users")
      .insert({ id: userId, username });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    router.replace(`/log/${username}`);
  };

  if (checkingAuth) {
    return <main className="min-h-screen bg-zinc-950" />;
  }

  const canSubmit = availability === "available" && !submitting;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Choose your username
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            This is your Log — make it yours
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-3">
          <div>
            <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition-colors focus-within:border-zinc-600">
              <span className="text-zinc-500">@</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="username"
                className="ml-1 w-full bg-transparent text-white placeholder:text-zinc-500 outline-none"
              />
            </div>
            {username && (
              <p
                className={`mt-2 text-sm ${
                  availability === "available"
                    ? "text-emerald-400"
                    : availability === "taken" || availability === "invalid"
                      ? "text-red-400"
                      : "text-zinc-500"
                }`}
              >
                {availability === "checking" && "Checking..."}
                {availability === "available" && "✓ username is available"}
                {availability === "taken" && "✗ taken"}
                {availability === "invalid" &&
                  "3–20 characters, lowercase letters, numbers, underscores only"}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create my Log"}
          </button>
        </form>
      </div>
    </main>
  );
}
