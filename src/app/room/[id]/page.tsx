"use client";

import { use } from "react";
import JoinGate from "@/components/game/JoinGate";
import RoomShell from "@/components/game/RoomShell";
import { isValidRoomId } from "@/lib/roomId";
import { MAX_PLAYERS, MIN_PLAYERS, type RoomMode } from "@/shared/types";

export default function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ max?: string; track?: string; mode?: string }>;
}) {
  const { id } = use(params);
  const { max, track, mode } = use(searchParams);
  const roomMode: RoomMode | undefined = mode === "battle" ? "battle" : mode === "race" ? "race" : undefined;

  if (!isValidRoomId(id)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#101319] px-4 text-center text-white">
        <p>That room code doesn&apos;t look right.</p>
      </div>
    );
  }

  const requestedMax = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Number(max) || MAX_PLAYERS));

  return (
    <JoinGate roomId={id} maxPlayers={requestedMax} trackId={track} mode={roomMode}>
      <RoomShell />
    </JoinGate>
  );
}
