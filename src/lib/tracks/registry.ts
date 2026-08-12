import { buildTrackData, type TrackConfig, type TrackData } from "./build";
import { ARENA_TRACK_ID, LAPS_TO_WIN } from "@/shared/types";

const SKYLINE_LOOP: TrackConfig = {
  id: "skyline-loop",
  name: "Skyline Loop",
  description: "A sweeping high-rise circuit with a launch ramp on the back straight.",
  controlPoints: [
    [0, 0],
    [0, -38],
    [4, -72],
    [34, -96],
    [74, -92],
    [96, -60],
    [92, -24],
    [70, -2],
    [56, 8],
    [60, 30],
    [46, 46],
    [18, 40],
    [2, 58],
    [-6, 84],
    [-40, 92],
    [-72, 70],
    [-78, 38],
    [-64, 10],
    [-70, -14],
    [-46, -30],
    [-20, -22],
  ],
  trackWidth: 16,
  theme: {
    ground: "#3c6b3f",
    asphalt: "#454851",
    curbA: "#ff5a3c",
    curbB: "#f4f2ea",
    wall: "#e8ddb5",
    sky: "#8fc3ea",
  },
  itemBoxU: [0.06, 0.16, 0.27, 0.37, 0.48, 0.58, 0.68, 0.78, 0.88, 0.96],
  obstacleU: [0.13, 0.22, 0.32, 0.42, 0.53, 0.63, 0.73, 0.82, 0.92, 0.985],
  rampU: 0.09,
  rampHeight: 3.2,
  checkpointCount: 8,
  laps: LAPS_TO_WIN,
};

const FROSTBITE_YARD: TrackConfig = {
  id: "frostbite-yard",
  name: "Frostbite Yard",
  description: "A technical snow-site circuit with a tight hairpin and a long icy straight.",
  controlPoints: [
    [0, 0],
    [0, -50],
    [20, -70],
    [55, -65],
    [70, -40],
    [55, -15],
    [30, -10],
    [25, 15],
    [50, 35],
    [75, 55],
    [60, 80],
    [20, 75],
    [-10, 55],
    [-15, 25],
    [-40, 15],
    [-55, -10],
    [-40, -35],
    [-15, -30],
  ],
  trackWidth: 14,
  theme: {
    ground: "#c9d6de",
    asphalt: "#3a4550",
    curbA: "#3ca7ff",
    curbB: "#f4f2ea",
    wall: "#e8eef2",
    sky: "#bcd9ec",
  },
  itemBoxU: [0.05, 0.14, 0.24, 0.34, 0.44, 0.55, 0.65, 0.75, 0.85, 0.94],
  obstacleU: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.97],
  rampU: 0.5,
  rampHeight: 2.8,
  checkpointCount: 8,
  laps: LAPS_TO_WIN,
};

const DEMOLITION_YARD: TrackConfig = {
  id: ARENA_TRACK_ID,
  name: "Demolition Yard",
  description: "Free-for-all combat pit. No laps — just wrecking balls and nowhere to hide.",
  controlPoints: [
    [0, 34],
    [24.04, 24.04],
    [34, 0],
    [24.04, -24.04],
    [0, -34],
    [-24.04, -24.04],
    [-34, 0],
    [-24.04, 24.04],
  ],
  trackWidth: 38,
  theme: {
    ground: "#2b2420",
    asphalt: "#4a4038",
    curbA: "#ff5a3c",
    curbB: "#ffd23c",
    wall: "#5c534a",
    sky: "#e8935a",
  },
  itemBoxU: [0.05, 0.18, 0.3, 0.43, 0.55, 0.68, 0.8, 0.93],
  obstacleU: [0.1, 0.25, 0.4, 0.6, 0.75, 0.9],
  rampU: 0.5,
  rampHeight: 1.8,
  checkpointCount: 4,
  laps: 1,
};

export const TRACK_CONFIGS: TrackConfig[] = [SKYLINE_LOOP, FROSTBITE_YARD, DEMOLITION_YARD];

export const TRACK_LIST = TRACK_CONFIGS.filter((c) => c.id !== ARENA_TRACK_ID).map((c) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  theme: c.theme,
}));

const cache = new Map<string, TrackData>();

export function getTrack(id: string): TrackData {
  const cached = cache.get(id);
  if (cached) return cached;
  const config = TRACK_CONFIGS.find((c) => c.id === id) ?? TRACK_CONFIGS[0];
  const built = buildTrackData(config);
  cache.set(id, built);
  return built;
}
