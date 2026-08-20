"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "loading" | "success";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setStatus("loading");

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStatus("success");
        return;
      }

      const data = await response.json().catch(() => null);
      setMessage(data?.error ?? "Something went wrong — try again");
      setStatus("idle");
    } catch {
      setMessage("Something went wrong — try again");
      setStatus("idle");
    }
  };

  if (status === "success") {
    return (
      <p className="text-sm text-zinc-300">
        You&apos;re on the list — we&apos;ll be in touch.
      </p>
    );
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-600 sm:w-72"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="shrink-0 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Joining..." : "Join waitlist"}
        </button>
      </form>
      {message && <p className="mt-2 text-sm text-zinc-400">{message}</p>}
    </div>
  );
}
