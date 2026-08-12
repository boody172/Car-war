"use client";

import { useGameStore } from "@/state/gameStore";
import { getConnection } from "@/net/connection";
import { getCharacter } from "@/shared/characters";

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_RING = [
  "ring-amber-300/70 bg-amber-400/10 border-amber-400/50",
  "ring-white/40 bg-white/10 border-white/30",
  "ring-orange-400/50 bg-orange-500/10 border-orange-400/40",
];

export default function BattleResultsScreen() {
  const mode = useGameStore((s) => s.mode);
  const results = useGameStore((s) => s.battleResults);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const hostId = useGameStore((s) => s.hostId);

  if (mode !== "battle" || !results) return null;
  const isHost = selfId === hostId;
  const sorted = results.slice().sort((a, b) => a.place - b.place);
  const champion = sorted[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-[popIn_0.35s_ease-out] rounded-2xl border border-white/10 bg-[#14161c] p-6 shadow-2xl">
        <h2 className="mb-1 text-center font-mono text-2xl font-black uppercase tracking-wide text-white">
          Battle Complete
        </h2>
        <p className="mb-5 text-center text-sm text-white/50">
          {champion ? `🏆 ${champion.name} wins the demolition derby` : "Demolition Yard — Final Score"}
        </p>

        <ol className="mb-6 space-y-2">
          {sorted.map((r) => {
            const char = getCharacter(players[r.id]?.characterId ?? "");
            const podium = r.place <= 3 ? PODIUM_RING[r.place - 1] : "border-white/10 bg-white/5";
            return (
              <li
                key={r.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                  r.id === selfId ? "border-amber-400/50 bg-amber-500/10" : podium
                } ${r.place <= 3 ? "ring-1" : ""}`}
              >
                <span className="flex items-center gap-2 font-medium text-white">
                  <span className="w-7 text-center font-mono text-base text-white/60">
                    {MEDAL[r.place - 1] ?? `P${r.place}`}
                  </span>
                  {char && (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm ring-2 ring-white/15"
                      style={{ backgroundColor: `${char.color}33` }}
                    >
                      {char.icon}
                    </span>
                  )}
                  {r.name}
                  {r.id === selfId && <span className="text-xs text-amber-300">(you)</span>}
                </span>
                <span className="font-mono text-sm text-white/70">🔨 {r.score}</span>
              </li>
            );
          })}
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
