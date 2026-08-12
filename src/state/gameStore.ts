import { create } from "zustand";
import type {
  PlayerInfo,
  RoomPhase,
  RaceResultEntry,
  WeaponKind,
} from "@/shared/types";

export type ConnStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface Toast {
  id: string;
  text: string;
  kind: "info" | "hit" | "item" | "warn";
}

export interface SelfRaceState {
  lap: number;
  checkpoint: number;
  place: number;
  finished: boolean;
  finishTimeMs: number | null;
  raceStartedAt: number | null;
  speed: number;
}

export interface ActiveEffects {
  stunnedUntil: number;
  blindedUntil: number;
  boostUntil: number;
  boostPower: number;
}

interface GameState {
  roomId: string | null;
  selfId: string | null;
  selfName: string;
  hostId: string | null;
  maxPlayers: number;
  phase: RoomPhase;
  players: Record<string, PlayerInfo>;
  connStatus: ConnStatus;
  errorMessage: string | null;
  raceStartAt: number | null;
  startOrder: string[];
  results: RaceResultEntry[] | null;
  heldItem: WeaponKind | null;
  selfRace: SelfRaceState;
  effects: ActiveEffects;
  toasts: Toast[];

  setRoomId: (id: string) => void;
  setSelfName: (name: string) => void;
  setConnStatus: (s: ConnStatus) => void;
  setError: (m: string | null) => void;
  applyWelcome: (payload: {
    selfId: string;
    roomId: string;
    players: PlayerInfo[];
    phase: RoomPhase;
    hostId: string;
    maxPlayers: number;
  }) => void;
  upsertPlayer: (p: PlayerInfo) => void;
  removePlayer: (id: string) => void;
  setHost: (id: string) => void;
  setPhase: (p: RoomPhase) => void;
  startRace: (startAt: number, order: string[]) => void;
  resetRace: () => void;
  setHeldItem: (item: WeaponKind | null) => void;
  updateSelfRace: (partial: Partial<SelfRaceState>) => void;
  setResults: (r: RaceResultEntry[]) => void;
  pushToast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  stun: (durationMs: number) => void;
  blind: (durationMs: number) => void;
  boost: (durationMs: number, power: number) => void;
}

let toastSeq = 0;

export const useGameStore = create<GameState>((set, get) => ({
  roomId: null,
  selfId: null,
  selfName: "",
  hostId: null,
  maxPlayers: 6,
  phase: "lobby",
  players: {},
  connStatus: "connecting",
  errorMessage: null,
  raceStartAt: null,
  startOrder: [],
  results: null,
  heldItem: null,
  selfRace: {
    lap: 1,
    checkpoint: 0,
    place: 1,
    finished: false,
    finishTimeMs: null,
    raceStartedAt: null,
    speed: 0,
  },
  effects: { stunnedUntil: 0, blindedUntil: 0, boostUntil: 0, boostPower: 0 },
  toasts: [],

  setRoomId: (id) => set({ roomId: id }),
  setSelfName: (name) => set({ selfName: name }),
  setConnStatus: (s) => set({ connStatus: s }),
  setError: (m) => set({ errorMessage: m }),

  applyWelcome: ({ selfId, roomId, players, phase, hostId, maxPlayers }) =>
    set({
      selfId,
      roomId,
      hostId,
      phase,
      maxPlayers,
      players: Object.fromEntries(players.map((p) => [p.id, p])),
    }),

  upsertPlayer: (p) =>
    set((s) => ({ players: { ...s.players, [p.id]: p } })),

  removePlayer: (id) =>
    set((s) => {
      const next = { ...s.players };
      delete next[id];
      return { players: next };
    }),

  setHost: (id) => set({ hostId: id }),
  setPhase: (p) => set({ phase: p }),

  startRace: (startAt, order) =>
    set({
      phase: "countdown",
      raceStartAt: startAt,
      startOrder: order,
      results: null,
      selfRace: {
        lap: 1,
        checkpoint: 0,
        place: order.indexOf(get().selfId ?? "") + 1 || 1,
        finished: false,
        finishTimeMs: null,
        raceStartedAt: null,
        speed: 0,
      },
    }),

  resetRace: () =>
    set({
      phase: "lobby",
      results: null,
      raceStartAt: null,
      heldItem: null,
      effects: { stunnedUntil: 0, blindedUntil: 0, boostUntil: 0, boostPower: 0 },
      selfRace: {
        lap: 1,
        checkpoint: 0,
        place: 1,
        finished: false,
        finishTimeMs: null,
        raceStartedAt: null,
        speed: 0,
      },
      players: Object.fromEntries(
        Object.entries(get().players).map(([id, p]) => [id, { ...p, ready: false }]),
      ),
    }),

  setHeldItem: (item) => set({ heldItem: item }),

  updateSelfRace: (partial) =>
    set((s) => ({ selfRace: { ...s.selfRace, ...partial } })),

  setResults: (r) => set({ results: r, phase: "finished" }),

  pushToast: (text, kind = "info") =>
    set((s) => ({
      toasts: [...s.toasts, { id: `t${toastSeq++}`, text, kind }].slice(-4),
    })),

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  stun: (durationMs) =>
    set((s) => ({
      effects: { ...s.effects, stunnedUntil: Date.now() + durationMs },
    })),

  blind: (durationMs) =>
    set((s) => ({
      effects: { ...s.effects, blindedUntil: Date.now() + durationMs },
    })),

  boost: (durationMs, power) =>
    set((s) => ({
      effects: {
        ...s.effects,
        boostUntil: Date.now() + durationMs,
        boostPower: power,
      },
    })),
}));
