"use client";

import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import { getTrack } from "@/lib/tracks/registry";
import type { TrackData } from "@/lib/tracks/build";

/** The currently active room track, built once per id and cached. */
export function useTrack(): TrackData {
  const trackId = useGameStore((s) => s.trackId);
  return useMemo(() => getTrack(trackId), [trackId]);
}
