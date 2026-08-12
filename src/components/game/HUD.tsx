"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { LAPS_TO_WIN } from "@/shared/types";
import { WEAPON_ICON, WEAPON_LABEL } from "@/components/game/weaponMeta";

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(2).padStart(5, "0");
  return `${min}:${sec}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function HUD() {
  const selfRace = useGameStore((s) => s.selfRace);
  const heldItem = useGameStore((s) => s.heldItem);
  const playerCount = useGameStore((s) => Object.keys(s.players).length);
  const connStatus = useGameStore((s) => s.connStatus);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const elapsed = selfRace.raceStartedAt ? now - selfRace.raceStartedAt : 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* Top-left: lap + place */}
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-xl border border-white/15 bg-black/40 px-4 py-2 font-mono text-white backdrop-blur-sm">
        <div className="text-2xl font-black leading-none tracking-tight">
          {ordinal(selfRace.place)}
          <span className="ml-1 text-sm font-medium text-white/60">/ {playerCount}</span>
        </div>
        <div className="mt-1 text-xs uppercase tracking-widest text-white/60">
          Lap {Math.min(selfRace.lap, LAPS_TO_WIN)} / {LAPS_TO_WIN}
        </div>
      </div>

      {/* Top-center: timer */}
      <div className="absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] -translate-x-1/2 rounded-xl border border-white/15 bg-black/40 px-4 py-2 font-mono text-lg font-bold text-white backdrop-blur-sm">
        {formatTime(elapsed)}
      </div>

      {connStatus !== "open" && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-amber-500/90 px-3 py-1 text-xs font-bold text-black">
          {connStatus === "reconnecting" ? "Reconnecting…" : "Connecting…"}
        </div>
      )}

      {/* Bottom-left: speed */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-sm text-white/70 md:left-6 md:translate-x-0">
        {Math.round(selfRace.speed * 3.6)} km/h
      </div>

      {/* Desktop item indicator (mirrors the mobile item button) */}
      <div className="absolute right-6 top-[max(1rem,env(safe-area-inset-top))] hidden h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 border-white/20 bg-black/35 text-2xl text-white backdrop-blur-sm md:flex">
        <span>{heldItem ? WEAPON_ICON[heldItem] : "▢"}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-white/60">
          {heldItem ? WEAPON_LABEL[heldItem] : "empty"}
        </span>
      </div>
    </div>
  );
}
