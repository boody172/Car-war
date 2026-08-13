import { create } from "zustand";
import type {
  PlayerInfo,
  RoomPhase,
  RoomMode,
  RaceResultEntry,
  BattleResultEntry,
  WeaponKind,
} from "@/shared/types";
import { DEFAULT_TRACK_ID } from "@/shared/types";
import { ITEM_REVEAL_MS } from "@/lib/constants";

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
  trackId: string;
  mode: RoomMode;
  phase: RoomPhase;
  players: Record<string, PlayerInfo>;
  connStatus: ConnStatus;
  errorMessage: string | null;
  raceStartAt: number | null;
  startOrder: string[];
  results: RaceResultEntry[] | null;
  battleResults: BattleResultEntry[] | null;
  battleHits: Record<string, number>;
  heldItem: WeaponKind | null;
  // Set the instant a box grant arrives; cleared once the roulette spin
  // lands and heldItem becomes usable. `token` disambiguates overlapping
  // reveals (e.g. a fresh pickup racing an in-flight timer) so a stale
  // timeout can never clobber a newer grant.
  pendingReveal: { item: WeaponKind; token: number } | null;
  // Which opponent (if any) the ball/blueprint aim cone is currently over —
  // purely informational for the on-screen reticle, recomputed every physics
  // tick in Kart.tsx. Firing still requires an explicit button press; this
  // never auto-fires or auto-follows on its own.
  aimLockedId: string | null;
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
    trackId: string;
    mode: RoomMode;
  }) => void;
  upsertPlayer: (p: PlayerInfo) => void;
  removePlayer: (id: string) => void;
  setHost: (id: string) => void;
  setPhase: (p: RoomPhase) => void;
  setTrackId: (id: string) => void;
  startRace: (startAt: number, order: string[], trackId: string, mode: RoomMode) => void;
  resetRace: () => void;
  setHeldItem: (item: WeaponKind | null) => void;
  /** Starts the CTR-style spin reveal; heldItem stays null/unusable until it lands. */
  grantItemWithReveal: (item: WeaponKind) => void;
  setAimLocked: (id: string | null) => void;
  updateSelfRace: (partial: Partial<SelfRaceState>) => void;
  setResults: (r: RaceResultEntry[]) => void;
  setBattleResults: (r: BattleResultEntry[]) => void;
  registerHit: (attackerId: string) => void;
  pushToast: (text: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  stun: (durationMs: number) => void;
  blind: (durationMs: number) => void;
  boost: (durationMs: number, power: number) => void;
}

let toastSeq = 0;
let revealTokenSeq = 0;

export const useGameStore = create<GameState>((set, get) => ({
  roomId: null,
  selfId: null,
  selfName: "",
  hostId: null,
  maxPlayers: 6,
  trackId: DEFAULT_TRACK_ID,
  mode: "race",
  phase: "lobby",
  players: {},
  connStatus: "connecting",
  errorMessage: null,
  raceStartAt: null,
  startOrder: [],
  results: null,
  battleResults: null,
  battleHits: {},
  heldItem: null,
  pendingReveal: null,
  aimLockedId: null,
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

  applyWelcome: ({ selfId, roomId, players, phase, hostId, maxPlayers, trackId, mode }) =>
    set({
      selfId,
      roomId,
      hostId,
      phase,
      maxPlayers,
      trackId,
      mode,
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
  setTrackId: (id) => set({ trackId: id }),

  startRace: (startAt, order, trackId, mode) =>
    set({
      phase: "countdown",
      raceStartAt: startAt,
      startOrder: order,
      trackId,
      mode,
      results: null,
      battleResults: null,
      battleHits: {},
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
      battleResults: null,
      battleHits: {},
      raceStartAt: null,
      heldItem: null,
      pendingReveal: null,
      aimLockedId: null,
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

  grantItemWithReveal: (item) => {
    const token = ++revealTokenSeq;
    set({ heldItem: null, pendingReveal: { item, token } });
    setTimeout(() => {
      set((s) => {
        if (s.pendingReveal?.token !== token) return {};
        return { heldItem: item, pendingReveal: null };
      });
    }, ITEM_REVEAL_MS);
  },

  setAimLocked: (id) => set({ aimLockedId: id }),

  updateSelfRace: (partial) =>
    set((s) => ({ selfRace: { ...s.selfRace, ...partial } })),

  setResults: (r) => set({ results: r, phase: "finished" }),
  setBattleResults: (r) => set({ battleResults: r, phase: "finished" }),

  registerHit: (attackerId) =>
    set((s) => ({
      battleHits: { ...s.battleHits, [attackerId]: (s.battleHits[attackerId] ?? 0) + 1 },
    })),

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
