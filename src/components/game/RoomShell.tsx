"use client";

import { useEffect } from "react";
import { useGameStore } from "@/state/gameStore";
import { disconnectFromRoom } from "@/net/connection";
import Lobby from "./Lobby";
import GameScreen from "./GameScreen";
import Toasts from "./Toasts";

export default function RoomShell() {
  const phase = useGameStore((s) => s.phase);

  // Deliberately not tied to component unmount: React's Strict Mode
  // double-invokes effects in development, which would otherwise tear the
  // socket down a moment after connecting. Explicit navigation ("Leave")
  // already disconnects; closing/refreshing the tab closes the socket
  // naturally.
  useEffect(() => {
    const onPageHide = () => disconnectFromRoom();
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  return (
    <>
      {phase === "lobby" ? <Lobby /> : <GameScreen />}
      {phase === "lobby" && <Toasts />}
    </>
  );
}
