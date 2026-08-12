"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/state/gameStore";
import { getConnection, disconnectFromRoom } from "@/net/connection";
import { MIN_PLAYERS } from "@/shared/types";
import { CHARACTERS, getCharacter } from "@/shared/characters";
import { useTrack } from "@/hooks/useTrack";

export default function Lobby() {
  const track = useTrack();
  const mode = useGameStore((s) => s.mode);
  const roomId = useGameStore((s) => s.roomId);
  const selfId = useGameStore((s) => s.selfId);
  const hostId = useGameStore((s) => s.hostId);
  const players = useGameStore((s) => s.players);
  const maxPlayers = useGameStore((s) => s.maxPlayers);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const roster = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
  const self = selfId ? players[selfId] : undefined;
  const isHost = selfId === hostId;
  const allReady = roster.length > 0 && roster.every((p) => p.ready);
  const canStart = isHost && allReady && roster.length >= MIN_PLAYERS;
  const takenCharacters = new Set(roster.filter((p) => p.id !== selfId).map((p) => p.characterId));

  const shareUrl = typeof window !== "undefined" && roomId ? `${window.location.origin}/room/${roomId}` : "";
  const inviteText = `Join my Car War room! 🏁 Code: ${roomId} — ${shareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — user can still select the text manually
    }
  };

  const copyCode = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
    } catch {
      // clipboard API unavailable — user can still select the text manually
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Car War", text: inviteText, url: shareUrl });
      } catch {
        // user dismissed the share sheet — nothing to do
      }
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, "_blank", "noopener");
  };

  const shareMessenger = async () => {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = `fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`;
    } else {
      await copyLink();
      useGameStore.getState().pushToast("Link copied — paste it in Messenger!", "info");
      window.open("https://www.messenger.com/", "_blank", "noopener");
    }
  };

  const shareDiscord = async () => {
    await copyLink();
    useGameStore.getState().pushToast("Link copied — paste it in Discord!", "info");
    window.open("https://discord.com/app", "_blank", "noopener");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#101319] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181b22] p-6 shadow-2xl">
        <h1 className="mb-1 text-center font-mono text-xl font-black uppercase tracking-wide text-white">
          {mode === "battle" ? "Battle Lobby" : "Waiting Lobby"}
        </h1>
        <div className="mb-5 flex items-center justify-center gap-2">
          <span
            className="h-3 w-3 rounded-full ring-1 ring-white/30"
            style={{
              background: `linear-gradient(135deg, ${track.theme.sky}, ${track.theme.asphalt})`,
            }}
          />
          <p className="text-center text-sm text-white/50">
            {mode === "battle" ? "💥 " : "🏁 "}
            {track.name} · {roster.length}/{maxPlayers} {mode === "battle" ? "fighters" : "racers"}
          </p>
        </div>

        <button
          onClick={copyCode}
          className="mb-2 flex w-full items-center justify-between rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2.5 transition hover:border-amber-400/70"
        >
          <span className="text-left">
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-amber-300/80">
              Room Code
            </span>
            <span className="font-mono text-xl font-black tracking-[0.2em] text-white">
              {roomId}
            </span>
          </span>
          <span className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase text-black">
            {codeCopied ? "Copied!" : "Copy Code"}
          </span>
        </button>

        <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
          <input
            readOnly
            value={shareUrl}
            className="min-w-0 flex-1 bg-transparent px-2 font-mono text-xs text-white/70 outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-white transition hover:bg-white/20"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>

        <div className="mb-5 grid grid-cols-4 gap-2">
          <button
            onClick={shareWhatsApp}
            title="Share via WhatsApp"
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-white/80 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
          >
            <span className="text-lg">💬</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">WhatsApp</span>
          </button>
          <button
            onClick={shareMessenger}
            title="Share via Messenger"
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-white/80 transition hover:border-blue-400/50 hover:bg-blue-400/10"
          >
            <span className="text-lg">📩</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Messenger</span>
          </button>
          <button
            onClick={shareDiscord}
            title="Share via Discord"
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-white/80 transition hover:border-indigo-400/50 hover:bg-indigo-400/10"
          >
            <span className="text-lg">🎮</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">Discord</span>
          </button>
          <button
            onClick={canNativeShare ? shareNative : copyLink}
            title="More sharing options"
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-white/80 transition hover:border-amber-400/50 hover:bg-amber-400/10"
          >
            <span className="text-lg">📤</span>
            <span className="text-[9px] font-bold uppercase tracking-wide">More</span>
          </button>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
          Choose your driver
        </p>
        <div className="mb-5 grid grid-cols-3 gap-2">
          {CHARACTERS.map((c) => {
            const isMine = self?.characterId === c.id;
            const isTaken = takenCharacters.has(c.id) && !isMine;
            return (
              <button
                key={c.id}
                disabled={isTaken}
                onClick={() => getConnection()?.send({ t: "selectCharacter", characterId: c.id })}
                className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center transition disabled:cursor-not-allowed disabled:opacity-30 ${
                  isMine
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/10 bg-white/5 hover:border-white/25"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-lg ring-2 ring-white/15"
                  style={{ backgroundColor: `${c.color}33` }}
                >
                  {c.icon}
                </span>
                <span className="text-[11px] font-bold text-white">{c.name}</span>
              </button>
            );
          })}
        </div>

        <ul className="mb-5 space-y-1.5">
          {roster.map((p) => {
            const char = getCharacter(p.characterId);
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 ${
                  !p.connected ? "opacity-50" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-white">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs ring-2 ring-white/20"
                    style={{ backgroundColor: `${p.color}33` }}
                  >
                    {char?.icon}
                  </span>
                  <span>
                    {p.name}
                    <span className="ml-1 text-xs text-white/40">— {char?.name}</span>
                  </span>
                  {p.id === hostId && <span title="Host">👑</span>}
                  {p.id === selfId && <span className="text-xs text-amber-300">(you)</span>}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${
                    !p.connected
                      ? "bg-amber-500/20 text-amber-300"
                      : p.ready
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/10 text-white/40"
                  }`}
                >
                  {!p.connected ? "Reconnecting…" : p.ready ? "Ready" : "Not ready"}
                </span>
              </li>
            );
          })}
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
            {roster.length < MIN_PLAYERS
              ? `Need ${MIN_PLAYERS}+ players`
              : allReady
                ? mode === "battle"
                  ? "Start Battle"
                  : "Start Race"
                : "Waiting for everyone ready"}
          </button>
        )}
      </div>
    </div>
  );
}
