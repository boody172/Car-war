import { nanoid } from "nanoid";
import { PartySocket } from "partysocket";
import type { ClientMessage, ServerMessage, RoomMode } from "@/shared/types";
import { useGameStore } from "@/state/gameStore";
import { useHazardStore, hazardExpiryFor } from "@/state/hazardStore";
import { pushSnapshot, dropPlayer } from "@/net/snapshotBuffer";

export function partyHost(): string {
  return process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";
}

// Persisted per-room so a page reload (not just a raw WebSocket reconnect)
// can still be recognized by the server as "the same player coming back",
// letting handleJoin reattach them to their existing seat instead of
// rejecting them outright once the race/battle has started.
function getOrCreateSessionId(roomId: string): string {
  if (typeof window === "undefined") return nanoid();
  const key = `carwar:session:${roomId}`;
  try {
    let id = window.sessionStorage.getItem(key);
    if (!id) {
      id = nanoid();
      window.sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    // sessionStorage unavailable (private mode, etc.) — fall back to an
    // in-memory id that at least survives WebSocket-level auto-reconnects.
    return nanoid();
  }
}

type ItemGrantListener = (item: string, boxId: string) => void;
type FinishListener = () => void;

export class GameConnection {
  socket: PartySocket;
  private intentionalClose = false;
  private sessionId: string;
  private itemGrantListeners = new Set<ItemGrantListener>();
  private finishListeners = new Set<FinishListener>();

  constructor(
    roomId: string,
    name: string,
    maxPlayers: number,
    trackId?: string,
    mode?: RoomMode,
  ) {
    const store = useGameStore.getState();
    store.setConnStatus("connecting");
    this.sessionId = getOrCreateSessionId(roomId);

    this.socket = new PartySocket({
      host: partyHost(),
      room: roomId,
      party: "room",
      minReconnectionDelay: 300,
      maxReconnectionDelay: 4000,
      reconnectionDelayGrowFactor: 1.5,
      maxRetries: Infinity,
      connectionTimeout: 8000,
    });

    this.socket.addEventListener("open", () => {
      useGameStore.getState().setConnStatus("open");
      useGameStore.getState().setError(null);
      // Fires on the initial connect AND every automatic reconnect — always
      // carrying the same sessionId lets the server tell "still me" apart
      // from a brand-new player.
      this.send({ t: "join", name, maxPlayers, trackId, mode, sessionId: this.sessionId });
    });

    this.socket.addEventListener("close", () => {
      if (!this.intentionalClose) {
        useGameStore.getState().setConnStatus("reconnecting");
      }
    });

    this.socket.addEventListener("error", () => {
      useGameStore.getState().setConnStatus("reconnecting");
    });

    this.socket.addEventListener("message", (evt: MessageEvent) => {
      this.handleMessage(evt.data);
    });
  }

  send(msg: ClientMessage) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  onItemGranted(fn: ItemGrantListener) {
    this.itemGrantListeners.add(fn);
    return () => this.itemGrantListeners.delete(fn);
  }

  onFinishAck(fn: FinishListener) {
    this.finishListeners.add(fn);
    return () => this.finishListeners.delete(fn);
  }

  dispose() {
    this.intentionalClose = true;
    this.send({ t: "leave" });
    try {
      this.socket.close();
    } catch {
      // socket already closed — nothing to do
    }
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== "string") return;
    let msg: ServerMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const store = useGameStore.getState();
    const hazards = useHazardStore.getState();

    switch (msg.t) {
      case "welcome": {
        store.applyWelcome(msg);
        if (msg.rejoined) {
          store.pushToast("Reconnected!", "info");
        }
        break;
      }
      case "playerJoined": {
        store.upsertPlayer(msg.player);
        store.pushToast(`${msg.player.name} joined`, "info");
        break;
      }
      case "playerLeft": {
        const name = store.players[msg.id]?.name ?? "Player";
        store.removePlayer(msg.id);
        dropPlayer(msg.id);
        store.pushToast(`${name} left`, "warn");
        break;
      }
      case "playerUpdated": {
        store.upsertPlayer(msg.player);
        break;
      }
      case "hostChanged": {
        store.setHost(msg.hostId);
        break;
      }
      case "trackChanged": {
        store.setTrackId(msg.trackId);
        break;
      }
      case "phaseChanged": {
        store.setPhase(msg.phase);
        if (msg.phase === "lobby") {
          store.resetRace();
          hazards.reset();
        }
        break;
      }
      case "raceStart": {
        hazards.reset();
        store.startRace(msg.startAt, msg.order, msg.trackId, msg.mode);
        break;
      }
      case "state": {
        pushSnapshot(msg.id, {
          ts: msg.ts,
          recvAt: Date.now(),
          p: msg.p,
          q: msg.q,
          v: msg.v,
          steer: msg.steer,
          throttle: msg.throttle,
          lap: msg.lap,
          cp: msg.cp,
          dist: msg.dist,
          place: msg.place,
        });
        break;
      }
      case "itemGranted": {
        store.grantItemWithReveal(msg.item as never);
        this.itemGrantListeners.forEach((fn) => fn(msg.item, msg.boxId));
        break;
      }
      case "boxConsumed": {
        // Handled by ItemBoxes component via a light poll of server time;
        // nothing global to update here besides letting UI components
        // subscribing to box state react (see useItemBoxRespawn hook).
        window.dispatchEvent(
          new CustomEvent("carwar:boxConsumed", { detail: msg }),
        );
        break;
      }
      case "weaponFired": {
        const now = Date.now();
        if (msg.kind === "wall" || msg.kind === "scaffold") {
          hazards.spawnHazard({
            id: msg.id,
            kind: msg.kind,
            ownerId: msg.from,
            ownerName: msg.fromName,
            position: msg.p,
            rotationY: msg.yaw,
            spawnedAt: now,
            expiresAt: hazardExpiryFor(msg.kind, now),
            triggeredBy: [],
          });
        } else if (msg.kind === "ball" || msg.kind === "blueprint") {
          const targetId = msg.targetId ?? "";
          hazards.spawnProjectile({
            id: msg.id,
            kind: msg.kind,
            ownerId: msg.from,
            ownerName: msg.fromName,
            targetId,
            from: msg.p,
            to: msg.targetP ?? msg.p,
            spawnedAt: now,
            durationMs:
              msg.kind === "ball" ? 1900 : 1200,
          });
          if (msg.from !== store.selfId) {
            store.pushToast(
              `${msg.fromName} fired ${msg.kind === "ball" ? "a wrecking ball" : "blueprint blindness"}!`,
              "warn",
            );
          }
        }
        break;
      }
      case "hitApplied": {
        if (msg.targetId === useGameStore.getState().selfId) {
          if (msg.kind === "ball") {
            store.stun(1150);
            store.pushToast("Wrecked by the homing ball!", "hit");
          } else if (msg.kind === "blueprint") {
            store.blind(3200);
            store.pushToast("Blueprint blindness!", "hit");
          }
        }
        if (store.mode === "battle") {
          store.registerHit(msg.from);
        }
        break;
      }
      case "playerFinished": {
        store.pushToast(
          `${store.players[msg.id]?.name ?? "Player"} finished P${msg.place}`,
          "info",
        );
        break;
      }
      case "raceOver": {
        store.setResults(msg.results);
        this.finishListeners.forEach((fn) => fn());
        break;
      }
      case "battleOver": {
        store.setBattleResults(msg.results);
        this.finishListeners.forEach((fn) => fn());
        break;
      }
      case "error": {
        store.setError(msg.message);
        break;
      }
      default:
        break;
    }
  }
}

let activeConnection: GameConnection | null = null;

export function getConnection(): GameConnection | null {
  return activeConnection;
}

export function connectToRoom(
  roomId: string,
  name: string,
  maxPlayers: number,
  trackId?: string,
  mode?: RoomMode,
): GameConnection {
  if (activeConnection) {
    activeConnection.dispose();
  }
  activeConnection = new GameConnection(roomId, name, maxPlayers, trackId, mode);
  return activeConnection;
}

export function disconnectFromRoom() {
  activeConnection?.dispose();
  activeConnection = null;
}
