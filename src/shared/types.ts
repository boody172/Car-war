// Shared protocol types between the Next.js client and the PartyKit room server.
// Kept dependency-free (no Three.js / React) so it can be imported from both sides.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export type WeaponKind = "wall" | "ball" | "blueprint" | "scaffold";

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
export const LAPS_TO_WIN = 3;

export const PLAYER_COLORS = [
  "#ff5a3c", // safety orange
  "#3ca7ff", // hard-hat blue
  "#ffd23c", // caution yellow
  "#43e08a", // rebar green
  "#c15aff", // survey purple
  "#ff85c2", // blueprint pink
] as const;

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  joinedAt: number;
}

export type RoomPhase = "lobby" | "countdown" | "racing" | "finished";

export interface RaceResultEntry {
  id: string;
  name: string;
  place: number;
  timeMs: number | null;
  dnf: boolean;
}

// ---------- Client -> Server ----------

export type ClientMessage =
  | { t: "join"; name: string; maxPlayers?: number }
  | { t: "ready"; ready: boolean }
  | { t: "start" }
  | { t: "rematch" }
  | {
      t: "state";
      p: Vec3;
      q: Quat;
      v: Vec3;
      steer: number;
      throttle: number;
      lap: number;
      cp: number;
      dist: number;
      place: number;
      seq: number;
      ts: number;
    }
  | { t: "pickup"; boxId: string }
  | {
      t: "weapon";
      id: string;
      kind: WeaponKind;
      p: Vec3;
      yaw: number;
      targetId?: string;
      targetP?: Vec3;
    }
  | { t: "finish"; timeMs: number }
  | { t: "ping"; ts: number };

// ---------- Server -> Client ----------

export type ServerMessage =
  | {
      t: "welcome";
      selfId: string;
      roomId: string;
      players: PlayerInfo[];
      phase: RoomPhase;
      hostId: string;
      maxPlayers: number;
    }
  | { t: "playerJoined"; player: PlayerInfo }
  | { t: "playerLeft"; id: string }
  | { t: "playerUpdated"; player: PlayerInfo }
  | { t: "hostChanged"; hostId: string }
  | { t: "raceStart"; startAt: number; order: string[] }
  | {
      t: "state";
      id: string;
      p: Vec3;
      q: Quat;
      v: Vec3;
      steer: number;
      throttle: number;
      lap: number;
      cp: number;
      dist: number;
      place: number;
      seq: number;
      ts: number;
    }
  | { t: "itemGranted"; id: string; item: WeaponKind; boxId: string }
  | { t: "boxConsumed"; boxId: string; respawnAt: number }
  | {
      t: "weaponFired";
      id: string;
      kind: WeaponKind;
      from: string;
      fromName: string;
      p: Vec3;
      yaw: number;
      targetId?: string;
      targetP?: Vec3;
    }
  | { t: "hitApplied"; targetId: string; kind: WeaponKind; from: string }
  | { t: "playerFinished"; id: string; timeMs: number; place: number }
  | { t: "raceOver"; results: RaceResultEntry[] }
  | { t: "phaseChanged"; phase: RoomPhase }
  | { t: "error"; message: string }
  | { t: "pong"; ts: number };
