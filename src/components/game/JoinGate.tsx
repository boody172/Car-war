"use client";

import { useEffect, useState } from "react";
import { connectToRoom } from "@/net/connection";
import { useGameStore } from "@/state/gameStore";
import type { RoomMode } from "@/shared/types";

const NAME_KEY = "carwar:name";

export default function JoinGate({
  roomId,
  maxPlayers,
  trackId,
  mode,
  children,
}: {
  roomId: string;
  maxPlayers: number;
  trackId?: string;
  mode?: RoomMode;
  children: React.ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const errorMessage = useGameStore((s) => s.errorMessage);

  useEffect(() => {
    // Hydrate from localStorage post-mount (deliberately, not in the
    // initializer) so server and first client render match; the name
    // field is empty for that one frame, then fills in.
    const saved = window.localStorage.getItem(NAME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setName(saved);
  }, []);

  const join = (chosenName: string) => {
    const trimmed = chosenName.trim().slice(0, 16) || "Racer";
    window.localStorage.setItem(NAME_KEY, trimmed);
    useGameStore.getState().setSelfName(trimmed);
    useGameStore.getState().setRoomId(roomId);
    connectToRoom(roomId, trimmed, maxPlayers, trackId, mode);
    setPending(true);
    setConnected(true);
  };

  if (connected) return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#101319] px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join(name);
        }}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#181b22] p-6 shadow-2xl"
      >
        <h1 className="mb-1 text-center font-mono text-xl font-black uppercase tracking-wide text-white">
          Join Room
        </h1>
        <p className="mb-5 text-center font-mono text-sm text-amber-400">{roomId}</p>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">
          Driver name
        </label>
        <input
          autoFocus
          maxLength={16}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Racer"
          className="mb-4 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-amber-400"
        />

        {errorMessage && (
          <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-amber-400 py-3 font-bold uppercase tracking-wide text-black transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "Connecting…" : "Join Race"}
        </button>
      </form>
    </div>
  );
}
