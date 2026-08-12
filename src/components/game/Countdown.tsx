"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/state/gameStore";

export default function Countdown() {
  const phase = useGameStore((s) => s.phase);
  const raceStartAt = useGameStore((s) => s.raceStartAt);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (phase !== "countdown") return;
    let raf: number;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  if (phase !== "countdown" || !raceStartAt) return null;

  const remaining = Math.max(0, raceStartAt - now);
  const label =
    remaining > 2000 ? "3" : remaining > 1000 ? "2" : remaining > 0 ? "1" : "GO!";

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <span
        key={label}
        className="animate-[popIn_0.4s_ease-out] font-mono text-8xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] md:text-9xl"
      >
        {label}
      </span>
    </div>
  );
}
