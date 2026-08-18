"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();

      // Returning-user magic links go through the PKCE `code` flow, which a
      // server route can exchange. But Supabase's *first* "confirm signup"
      // email for a brand-new address falls back to the implicit flow —
      // it puts the session in the URL fragment (`#access_token=...`)
      // instead of a `?code=` query param. Fragments never reach the
      // server, so that flow has to be handled here, client-side.
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const code = new URLSearchParams(window.location.search).get("code");

      let sessionError: { message: string } | null = null;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        sessionError = error;
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        sessionError = error;
      } else {
        sessionError = { message: "Missing auth code or tokens" };
      }

      if (sessionError) {
        router.replace("/login");
        return;
      }

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

      router.replace(
        profile?.username ? `/log/${profile.username}` : "/onboarding",
      );
    };

    run();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <p className="text-sm text-zinc-400">Signing you in...</p>
    </main>
  );
}
