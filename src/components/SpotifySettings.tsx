"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { SpotifyConnect, type SpotifyStatus } from "@/components/SpotifyConnect";
import { SpotifyMatch } from "@/components/SpotifyMatch";

export function SpotifySettings() {
  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get("status");
  const callbackMessage = searchParams.get("message");

  const [status, setStatus] = useState<SpotifyStatus | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleStatusChange = useCallback((next: SpotifyStatus) => setStatus(next), []);
  const handleChanged = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <div className="space-y-6">
      {callbackStatus ? (
        <p
          className={`rounded-lg border px-3 py-2.5 text-sm ${
            callbackStatus === "connected"
              ? "border-lime-glow/50 bg-lime-glow/10 text-lime-glow"
              : "border-magenta/50 bg-magenta/10 text-magenta"
          }`}
        >
          {callbackMessage ?? (callbackStatus === "connected" ? "連携しました" : "連携に失敗しました")}
        </p>
      ) : null}

      <SpotifyConnect key={reloadKey} onStatusChange={handleStatusChange} />

      {status?.configured ? <SpotifyMatch onChanged={handleChanged} /> : null}
    </div>
  );
}
