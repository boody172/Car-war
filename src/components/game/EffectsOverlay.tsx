"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/state/gameStore";

export default function EffectsOverlay() {
  const effects = useGameStore((s) => s.effects);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const blinded = effects.blindedUntil > now;
  const stunned = effects.stunnedUntil > now;
  const blindT = blinded ? (effects.blindedUntil - now) / 3200 : 0;
  const stunT = stunned ? (effects.stunnedUntil - now) / 1150 : 0;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {stunned && (
        <div
          className="absolute inset-0"
          style={{
            boxShadow: `inset 0 0 ${60 + stunT * 80}px ${20 + stunT * 30}px rgba(255,40,20,${0.35 + stunT * 0.35})`,
          }}
        />
      )}
      {blinded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: Math.min(1, blindT + 0.15),
            backgroundColor: "rgba(15,40,80,0.86)",
            backgroundImage:
              "linear-gradient(rgba(150,200,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(150,200,255,0.35) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
          }}
        >
          <span className="rounded-md border border-sky-300/60 bg-black/30 px-4 py-2 font-mono text-sm uppercase tracking-widest text-sky-100">
            Blueprint Blindness
          </span>
        </div>
      )}
    </div>
  );
}
