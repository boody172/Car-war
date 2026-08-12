"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { getAllIds, getLatest } from "@/net/snapshotBuffer";
import { getCharacter } from "@/shared/characters";

interface Row {
  id: string;
  name: string;
  value: number;
  icon: string;
}

export default function Standings() {
  const mode = useGameStore((s) => s.mode);
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const selfPlace = useGameStore((s) => s.selfRace.place);
  const battleHits = useGameStore((s) => s.battleHits);
  const [raceRows, setRaceRows] = useState<Row[]>([]);

  const battleRows = useMemo<Row[]>(() => {
    if (mode !== "battle") return [];
    return Object.values(players)
      .map((p) => ({
        id: p.id,
        name: p.name,
        value: battleHits[p.id] ?? 0,
        icon: getCharacter(p.characterId)?.icon ?? "🏎️",
      }))
      .sort((a, b) => b.value - a.value);
  }, [mode, players, battleHits]);

  useEffect(() => {
    if (mode === "battle") return;
    const id = setInterval(() => {
      const list: Row[] = [];
      if (selfId && players[selfId]) {
        const p = players[selfId];
        list.push({
          id: selfId,
          name: p.name,
          value: selfPlace,
          icon: getCharacter(p.characterId)?.icon ?? "🏎️",
        });
      }
      for (const otherId of getAllIds()) {
        const snap = getLatest(otherId);
        const p = players[otherId];
        if (!snap || !p) continue;
        list.push({
          id: otherId,
          name: p.name,
          value: snap.place,
          icon: getCharacter(p.characterId)?.icon ?? "🏎️",
        });
      }
      list.sort((a, b) => a.value - b.value);
      setRaceRows(list);
    }, 250);
    return () => clearInterval(id);
  }, [mode, players, selfId, selfPlace]);

  const rows = mode === "battle" ? battleRows : raceRows;
  if (rows.length < 2) return null;

  return (
    <div className="absolute right-4 top-24 z-20 hidden w-40 flex-col gap-1 rounded-xl border border-white/10 bg-black/40 p-2 font-mono text-xs backdrop-blur-sm sm:flex">
      {rows.slice(0, 6).map((r) => (
        <div
          key={r.id}
          className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${
            r.id === selfId ? "bg-amber-400/20 text-amber-200" : "text-white/70"
          }`}
        >
          <span className="w-4 text-center font-bold">{r.value}</span>
          <span>{r.icon}</span>
          <span className="truncate">{r.name}</span>
        </div>
      ))}
    </div>
  );
}
