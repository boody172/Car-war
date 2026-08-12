"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/state/gameStore";
import { getConnection, disconnectFromRoom } from "@/net/connection";
import { MIN_PLAYERS } from "@/shared/types";

export default function Lobby() {
  const roomId = useGameStore((s) => s.roomId);
  const selfId = useGameStore((s) => s.selfId);
  const hostId = useGameStore((s) => s.hostId);
  const players = useGameStore((s) => s.players);
  const maxPlayers = useGameStore((s) => s.maxPlayers);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const roster = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
  const self = selfId ? players[selfId] : undefined;
  const isHost = selfId === hostId;
  const allReady = roster.length > 0 && roster.every((p) => p.ready);
  const canStart = isHost && allReady && roster.length >= MIN_PLAYERS;

  const shareUrl = typeof window !== "undefined" && roomId ? `${window.location.origin}/room/${roomId}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — user can still select the text manually
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#101319] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181b22] p-6 shadow-2xl">
        <h1 className="mb-1 text-center font-mono text-xl font-black uppercase tracking-wide text-white">
          Waiting Lobby
        </h1>
        <p className="mb-5 text-center text-sm text-white/50">
          Skyline Loop · {roster.length}/{maxPlayers} racers
        </p>

        <div className="mb-5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs text-white/70 outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase text-black transition hover:bg-amber-300"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        <ul className="mb-5 space-y-1.5">
          {roster.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-white">
                <span
                  className="h-3 w-3 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: p.color }}
                />
                {p.name}
                {p.id === hostId && <span title="Host">👑</span>}
                {p.id === selfId && <span className="text-xs text-amber-300">(you)</span>}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                  p.ready ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"
                }`}
              >
                {p.ready ? "Ready" : "Not ready"}
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, maxPlayers - roster.length) }).map((_, i) => (
            <li
              key={`empty-${i}`}
              className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-sm text-white/25"
            >
              Waiting for player…
            </li>
          ))}
        </ul>

        {errorMessage && (
          <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => getConnection()?.send({ t: "ready", ready: !self?.ready })}
            className={`flex-1 rounded-xl py-3 font-bold uppercase tracking-wide transition active:scale-[0.98] ${
              self?.ready
                ? "bg-white/10 text-white hover:bg-white/15"
                : "bg-emerald-400 text-black hover:bg-emerald-300"
            }`}
          >
            {self?.ready ? "Not Ready" : "I'm Ready"}
          </button>
          <button
            onClick={() => {
              disconnectFromRoom();
              router.push("/");
            }}
            className="rounded-xl border border-white/15 px-4 py-3 font-bold uppercase text-white/60 transition hover:bg-white/5"
          >
            Leave
          </button>
        </div>

        {isHost && (
          <button
            disabled={!canStart}
            onClick={() => getConnection()?.send({ t: "start" })}
            className="mt-3 w-full rounded-xl bg-amber-400 py-3 font-bold uppercase tracking-wide text-black transition hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {roster.length < MIN_PLAYERS ? `Need ${MIN_PLAYERS}+ players` : allReady ? "Start Race" : "Waiting for everyone ready"}
          </button>
        )}
      </div>
    </div>
  );
}
