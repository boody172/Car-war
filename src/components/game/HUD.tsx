"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { useTrack } from "@/hooks/useTrack";
import { useItemReveal } from "@/hooks/useItemReveal";
import { WEAPON_ICON, WEAPON_LABEL } from "@/components/game/weaponMeta";
import { BATTLE_DURATION_MS } from "@/lib/constants";
import Standings from "@/components/game/Standings";

function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(2).padStart(5, "0");
  return `${min}:${sec}`;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function HUD() {
  const track = useTrack();
  const mode = useGameStore((s) => s.mode);
  const selfRace = useGameStore((s) => s.selfRace);
  const selfId = useGameStore((s) => s.selfId);
  const battleHits = useGameStore((s) => s.battleHits);
  const raceStartAt = useGameStore((s) => s.raceStartAt);
  const { icon: itemIcon, revealing } = useItemReveal();
  const aimLockedId = useGameStore((s) => s.aimLockedId);
  const playerCount = useGameStore((s) => Object.keys(s.players).length);
  const connStatus = useGameStore((s) => s.connStatus);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const elapsed = selfRace.raceStartedAt ? now - selfRace.raceStartedAt : 0;
  const battleRemaining = raceStartAt ? raceStartAt + BATTLE_DURATION_MS - now : BATTLE_DURATION_MS;
  const myScore = selfId ? (battleHits[selfId] ?? 0) : 0;
  const aimable = !revealing && (itemIcon === "ball" || itemIcon === "blueprint");
  const locked = aimable && aimLockedId !== null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      {/* Top-left: lap + place (race) or score (battle) */}
      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] rounded-xl border border-white/15 bg-black/40 px-4 py-2 font-mono text-white backdrop-blur-sm">
        {mode === "battle" ? (
          <>
            <div className="text-2xl font-black leading-none tracking-tight">
              🔨 {myScore}
            </div>
            <div className="mt-1 text-xs uppercase tracking-widest text-white/60">Hits</div>
          </>
        ) : (
          <>
            <div className="text-2xl font-black leading-none tracking-tight">
              {ordinal(selfRace.place)}
              <span className="ml-1 text-sm font-medium text-white/60">/ {playerCount}</span>
            </div>
            <div className="mt-1 text-xs uppercase tracking-widest text-white/60">
              Lap {Math.min(selfRace.lap, track.laps)} / {track.laps}
            </div>
          </>
        )}
      </div>

      {/* Top-center: race stopwatch or battle countdown */}
      <div
        className={`absolute left-1/2 top-[max(1rem,env(safe-area-inset-top))] -translate-x-1/2 rounded-xl border px-4 py-2 font-mono text-lg font-bold backdrop-blur-sm ${
          mode === "battle" && battleRemaining < 10000
            ? "border-red-400/50 bg-red-950/50 text-red-200"
            : "border-white/15 bg-black/40 text-white"
        }`}
      >
        {mode === "battle" ? formatCountdown(battleRemaining) : formatTime(elapsed)}
      </div>

      <Standings />

      {/* Aim reticle: shown whenever a ball/blueprint is held, so the player
          can see — before firing — whether they're actually pointed at an
          opponent. Turns green and reports "TARGET LOCKED" the instant the
          forward cone finds someone; still requires the explicit fire button,
          it never fires or steers on its own. */}
      {aimable && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div
            className={`h-14 w-14 rounded-full border-2 transition-colors ${
              locked ? "border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.7)]" : "border-white/50"
            }`}
          >
            <div
              className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                locked ? "bg-emerald-400" : "bg-white/70"
              }`}
            />
          </div>
          {locked && (
            <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
              Target Locked
            </div>
          )}
        </div>
      )}

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
      <div
        className={`absolute right-6 top-[max(1rem,env(safe-area-inset-top))] hidden h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 text-2xl text-white backdrop-blur-sm transition md:flex ${
          revealing
            ? "border-sky-300/80 bg-sky-500/20 shadow-[0_0_18px_rgba(56,189,248,0.5)]"
            : itemIcon
              ? "animate-pulse border-amber-400/70 bg-amber-500/20 shadow-[0_0_18px_rgba(255,178,32,0.4)]"
              : "border-white/20 bg-black/35"
        }`}
      >
        <span className={revealing ? "animate-spin" : undefined}>
          {itemIcon ? WEAPON_ICON[itemIcon] : "▢"}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-white/60">
          {revealing ? "..." : itemIcon ? WEAPON_LABEL[itemIcon] : "empty"}
        </span>
      </div>
    </div>
  );
}
