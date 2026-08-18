"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export function EditLogButton({ profileId }: { profileId: string }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsOwner(user?.id === profileId);
    };

    check();
  }, [profileId]);

  if (!isOwner) return null;

  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="cursor-not-allowed rounded-full border border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-400 opacity-60"
    >
      Edit profile
    </button>
  );
}
