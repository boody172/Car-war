"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { generateRoomId, isValidRoomId } from "@/lib/roomId";

const NAME_KEY = "carwar:name";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(NAME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setName(saved);
  }, []);

  const createRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().slice(0, 16) || "Racer";
    window.localStorage.setItem(NAME_KEY, trimmed);
    const id = generateRoomId();
    router.push(`/room/${id}?max=${maxPlayers}`);
  };

  const joinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!isValidRoomId(code)) return;
    router.push(`/room/${code}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0e1015] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <div className="relative z-10 mb-8 text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-amber-400">
          Construction &amp; Demolition Kart Racing
        </p>
        <h1 className="font-mono text-5xl font-black uppercase tracking-tight text-white sm:text-6xl">
          Car <span className="text-amber-400">War</span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-white/50">
          Drift the Skyline Loop, smash item crates, and bury your rivals under concrete walls,
          wrecking balls, and blueprint blindness. 2–6 players, one shared link.
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-4">
        <form
          onSubmit={createRoom}
          className="rounded-2xl border border-white/10 bg-[#181b22] p-6 shadow-2xl"
        >
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">
            Driver name
          </label>
          <input
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Racer"
            className="mb-4 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-amber-400"
          />

          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">
            Players ({maxPlayers})
          </label>
          <input
            type="range"
            min={2}
            max={6}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="mb-5 w-full accent-amber-400"
          />

          <button
            type="submit"
            className="w-full rounded-xl bg-amber-400 py-3 font-bold uppercase tracking-wide text-black transition hover:bg-amber-300 active:scale-[0.98]"
          >
            Create Race Room
          </button>
        </form>

        <form
          onSubmit={joinRoom}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#181b22] p-3 shadow-2xl"
        >
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Have a code? ABCD12"
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-sm text-white outline-none placeholder:text-white/30"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm font-bold uppercase text-white/80 transition hover:bg-white/10"
          >
            Join
          </button>
        </form>
      </div>

      <p className="relative z-10 mt-8 max-w-sm text-center text-xs text-white/30">
        Works on desktop and mobile — keyboard/arrow keys on desktop, on-screen joystick and
        buttons on touch devices.
      </p>
    </div>
  );
}
