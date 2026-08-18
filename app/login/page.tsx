"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCheckingSession(false);
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      router.replace(
        profile?.username ? `/log/${profile.username}` : "/onboarding",
      );
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("loading");

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (otpError) {
      setError(otpError.message);
      setStatus("idle");
      return;
    }

    setStatus("sent");
  };

  if (checkingSession) {
    return <main className="min-h-screen bg-zinc-950" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link
            href="/"
            className="text-xl font-semibold tracking-tight text-white"
          >
            Wreckt
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-white">
            Sign in to Wreckt
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            We&apos;ll send you a magic link — no password needed
          </p>
        </div>

        {status === "sent" ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-300">
              Check your email — we sent a magic link to{" "}
              <span className="text-white">{email}</span>
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-4 text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-600"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full rounded-full bg-white px-4 py-3 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading" ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
