"use client";

import dynamic from "next/dynamic";
import HUD from "./HUD";
import EffectsOverlay from "./EffectsOverlay";
import Toasts from "./Toasts";
import Countdown from "./Countdown";
import ResultsScreen from "./ResultsScreen";
import BattleResultsScreen from "./BattleResultsScreen";

const GameRoot = dynamic(() => import("./GameRoot"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#8fc3ea] text-white">
      <p className="animate-pulse font-mono text-sm uppercase tracking-widest">
        Loading track…
      </p>
    </div>
  ),
});

export default function GameScreen() {
  return (
    <>
      <GameRoot />
      <HUD />
      <EffectsOverlay />
      <Toasts />
      <Countdown />
      <ResultsScreen />
      <BattleResultsScreen />
    </>
  );
}
