"use client";

import { useGameStore } from "@/state/gameStore";
import { getConnection } from "@/net/connection";

function formatTime(ms: number | null): string {
  if (ms == null) return "DNF";
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(2).padStart(5, "0");
  return `${min}:${sec}`;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function ResultsScreen() {
  const results = useGameStore((s) => s.results);
  const selfId = useGameStore((s) => s.selfId);
  const hostId = useGameStore((s) => s.hostId);

  if (!results) return null;
  const isHost = selfId === hostId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14161c] p-6 shadow-2xl">
        <h2 className="mb-1 text-center font-mono text-2xl font-black uppercase tracking-wide text-white">
          Race Complete
        </h2>
        <p className="mb-5 text-center text-sm text-white/50">Skyline Loop — Final Standings</p>

        <ol className="mb-6 space-y-2">
          {results
            .slice()
            .sort((a, b) => a.place - b.place)
            .map((r) => (
              <li
                key={r.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  r.id === selfId
                    ? "border-amber-400/50 bg-amber-500/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-white">
                  <span className="w-8 text-center font-mono text-white/60">
                    {MEDAL[r.place - 1] ?? `P${r.place}`}
                  </span>
                  {r.name}
                  {r.id === selfId && <span className="text-xs text-amber-300">(you)</span>}
                </span>
                <span className="font-mono text-sm text-white/70">{formatTime(r.timeMs)}</span>
              </li>
            ))}
        </ol>

        {isHost ? (
          <button
            onClick={() => getConnection()?.send({ t: "rematch" })}
            className="w-full rounded-xl bg-amber-400 py-3 font-bold uppercase tracking-wide text-black transition hover:bg-amber-300 active:scale-[0.98]"
          >
            Back to Lobby
          </button>
        ) : (
          <p className="text-center text-sm text-white/50">
            Waiting for the host to start a rematch…
          </p>
        )}
      </div>
    </div>
  );
}
