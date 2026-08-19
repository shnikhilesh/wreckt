"use client";

import { useCallback, useState } from "react";
import { TakeComposer } from "./TakeComposer";
import { TakesList } from "./TakesList";

export function TakesSection({ workId }: { workId: string }) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [count, setCount] = useState<number | null>(null);

  const bumpRefresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-white">
        Takes{count ? ` (${count})` : ""}
      </h2>

      <TakeComposer workId={workId} onChange={bumpRefresh} />

      <TakesList
        workId={workId}
        refreshToken={refreshToken}
        onCountChange={setCount}
      />
    </section>
  );
}
