"use client";

import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Only the landing page floats a transparent navbar over its hero;
    // every other page keeps the plain solid bar, so skip the listener
    // there entirely.
    if (!isLanding) return;

    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLanding]);

  useEffect(() => {
    // Reactively update on sign-in/sign-out/token refresh, including
    // events that happen without a navigation (e.g. magic-link callback).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUsername(session.user.id);
      } else {
        setUsername(null);
      }
    });

    return () => subscription.unsubscribe();

    async function fetchUsername(userId: string) {
      const { data } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .single();

      setUsername(data?.username ?? null);
    }
  }, [supabase]);

  useEffect(() => {
    // The Navbar is part of the persistent root layout, so client-side
    // navigations (e.g. onboarding's router.replace after creating the
    // `users` row) don't remount it or fire an auth event. Re-check on
    // every route change too, so a freshly created username shows up
    // without requiring a full page reload.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);

      if (!session?.user) {
        setUsername(null);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("username")
        .eq("id", session.user.id)
        .single();

      setUsername(data?.username ?? null);
    });
  }, [supabase, pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const headerClassName = isLanding
    ? `fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled
          ? "border-zinc-800 bg-zinc-950/90 backdrop-blur-sm"
          : "border-transparent bg-transparent"
      }`
    : "sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm";

  return (
    <header className={headerClassName}>
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-white transition-opacity hover:opacity-80"
        >
          Wreckt
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/books"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Browse
          </Link>

          {user && (
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-zinc-400 transition-colors hover:text-white"
            >
              Sign out
            </button>
          )}

          {user ? (
            username && (
              <Link
                href={`/log/${username}`}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
              >
                @{username}
              </Link>
            )
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
