import { WaitlistForm } from "@/components/WaitlistForm";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type CoverWork = {
  id: string;
  cover_url: string | null;
};

type SocialTake = {
  body: string;
  resonated_count: number;
  users: { username: string } | null;
  works: { title: string; cover_url: string | null } | null;
};

const PROBLEM_STATEMENTS = [
  { icon: "📚", text: "Your reading list is a graveyard." },
  { icon: "🕰️", text: "The apps you use were built for someone else." },
  { icon: "✨", text: "You deserve something that gets it." },
];

const FEATURES = [
  {
    icon: "📚",
    title: "Stack",
    lead: "Save books you actually want to read.",
    sub: "Not a wishlist you'll ignore — a Stack you'll work through.",
  },
  {
    icon: "💬",
    title: "Takes",
    lead: "Skip the five-paragraph essay.",
    sub: "Your take can be three words or three paragraphs. Just be honest.",
  },
  {
    icon: "♥",
    title: "Resonated",
    lead: "Find the readers who get it.",
    sub: "When a take hits different, Resonate with it.",
  },
  {
    icon: "✕",
    title: "Dropped",
    lead: "It's okay to put a book down.",
    sub: "Dropped is a first-class state on Wreckt. No shame, just honesty.",
  },
];

const PLACEHOLDER_TAKES = [
  {
    body: "Absolutely wreckt me. Did not see that ending coming.",
    username: "reader",
    bookTitle: "The Road",
  },
  {
    body: "Dropped at chapter 4. Life's too short.",
    username: "reader",
    bookTitle: "Circe",
  },
  {
    body: "Read it in one sitting. Zero notes.",
    username: "reader",
    bookTitle: "Piranesi",
  },
];

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

export default async function Home() {
  const supabase = await createClient();

  const [{ count: signupCount }, { data: coverWorks }, { data: takesRaw }] =
    await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase
        .from("works")
        .select("id, cover_url")
        .not("cover_url", "is", null)
        .order("rating_count", { ascending: false })
        .limit(12),
      supabase
        .from("takes")
        .select(
          "body, resonated_count, users(username), works(title, cover_url)",
        )
        .eq("is_flagged", false)
        .order("resonated_count", { ascending: false })
        .limit(3),
    ]);

  const covers = (coverWorks ?? []) as CoverWork[];
  const takes = (takesRaw ?? []) as unknown as SocialTake[];
  const showPlaceholderTakes = takes.length === 0;

  return (
    <main className="bg-zinc-950 text-zinc-100">
      {/* Hero */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center sm:px-6">
        {covers.length > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid grid-cols-4 gap-2 opacity-30 blur-md sm:grid-cols-6"
          >
            {covers.map((work) => (
              <div
                key={work.id}
                className="aspect-[2/3] overflow-hidden rounded bg-zinc-800"
              >
                {work.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/cover?url=${encodeURIComponent(work.cover_url)}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(9,9,11,0.97)_0%,rgba(9,9,11,0.88)_40%,rgba(9,9,11,0.6)_100%)]"
        />

        <div className="relative flex flex-col items-center">
          <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Your reading life, finally worth tracking.
          </h1>
          <p className="mt-6 max-w-xl text-base text-zinc-400 sm:text-lg">
            Wreckt is where readers log what they&apos;ve read, share honest
            takes, and find their next obsession — without the clutter.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
            >
              Start reading
            </Link>
            <Link
              href="/books"
              className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-zinc-500 hover:bg-zinc-900"
            >
              Browse books
            </Link>
          </div>

          {signupCount != null && signupCount > 0 && (
            <p className="mt-6 text-sm text-zinc-500">
              Join {signupCount} reader{signupCount === 1 ? "" : "s"} already
              on Wreckt
            </p>
          )}
        </div>
      </section>

      {/* The problem */}
      <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          {PROBLEM_STATEMENTS.map((item) => (
            <div key={item.text} className="text-center">
              <div className="text-3xl">{item.icon}</div>
              <p className="mt-3 text-lg font-medium text-zinc-200">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Built different
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8"
            >
              <div className="text-3xl">{feature.icon}</div>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-zinc-300">{feature.lead}</p>
              <p className="mt-1 text-sm text-zinc-500">{feature.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          What readers say
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {showPlaceholderTakes
            ? PLACEHOLDER_TAKES.map((take) => (
                <div
                  key={take.body}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  <p className="text-zinc-200">
                    &ldquo;{take.body}&rdquo;
                  </p>
                  <p className="mt-4 text-sm text-zinc-500">
                    @{take.username} on {take.bookTitle}
                  </p>
                </div>
              ))
            : takes.map((take, i) => (
                <div
                  key={i}
                  className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  {take.works?.cover_url && (
                    <div className="hidden w-12 shrink-0 sm:block">
                      <div className="aspect-[2/3] overflow-hidden rounded bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/cover?url=${encodeURIComponent(take.works.cover_url)}`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-zinc-200">
                      &ldquo;{truncate(take.body, 150)}&rdquo;
                    </p>
                    <p className="mt-4 text-sm text-zinc-500">
                      @{take.users?.username} on {take.works?.title} · ♥{" "}
                      {take.resonated_count}
                    </p>
                  </div>
                </div>
              ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Get early access
        </h2>
        <p className="mt-3 text-zinc-400">
          We&apos;re in early access. Join the list and we&apos;ll let you
          know when we open up.
        </p>

        <div className="mt-8 flex justify-center">
          <WaitlistForm />
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          No spam. Just a heads up when we&apos;re ready.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500 sm:px-6">
        <p>Wreckt © 2025 · Made for readers · wreckt.me</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <Link href="/books" className="transition-colors hover:text-white">
            Browse
          </Link>
          <Link href="/login" className="transition-colors hover:text-white">
            Sign in
          </Link>
          <Link
            href="/privacy"
            className="transition-colors hover:text-white"
          >
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}
