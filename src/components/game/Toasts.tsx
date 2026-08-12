"use client";

import { useEffect } from "react";
import { useGameStore } from "@/state/gameStore";

const KIND_STYLE: Record<string, string> = {
  info: "border-white/20 bg-black/55 text-white",
  hit: "border-red-400/50 bg-red-950/70 text-red-100",
  item: "border-amber-400/50 bg-amber-950/70 text-amber-100",
  warn: "border-yellow-400/40 bg-black/55 text-yellow-100",
};

export default function Toasts() {
  const toasts = useGameStore((s) => s.toasts);
  const dismissToast = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const id = setTimeout(() => dismissToast(oldest.id), 3400);
    return () => clearTimeout(id);
  }, [toasts, dismissToast]);

  return (
    <div className="pointer-events-none fixed left-1/2 top-24 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-[fadeSlide_0.25s_ease-out] rounded-lg border px-3 py-1.5 text-sm font-medium backdrop-blur-sm ${KIND_STYLE[t.kind]}`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
