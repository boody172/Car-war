import type * as Party from "partykit/server";
import type {
  ClientMessage,
  ServerMessage,
  PlayerInfo,
  RoomPhase,
  WeaponKind,
  RaceResultEntry,
} from "../src/shared/types";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COLORS,
} from "../src/shared/types";
import { WEAPON_DURATION, ITEM_BOX_RESPAWN_MS, COUNTDOWN_MS } from "../src/lib/constants";

const WEAPON_KINDS: WeaponKind[] = ["wall", "ball", "blueprint", "scaffold"];
const WRAP_UP_MS = 22000; // grace period after the first finisher before DNF-ing stragglers

function sanitizeName(raw: string): string {
  const trimmed = (raw ?? "").toString().trim().slice(0, 16);
  return trimmed.length > 0 ? trimmed : "Racer";
}

interface ItemBoxState {
  consumedUntil: number;
}

export default class RoomServer implements Party.Server {
  players = new Map<string, PlayerInfo>();
  hostId: string | null = null;
  phase: RoomPhase = "lobby";
  maxPlayers = MAX_PLAYERS;
  itemBoxes = new Map<string, ItemBoxState>();
  finishedIds = new Set<string>();
  finishOrder: RaceResultEntry[] = [];
  wrapUpTimer: ReturnType<typeof setTimeout> | null = null;
  phaseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, without?: string[]) {
    this.room.broadcast(JSON.stringify(msg), without);
  }

  onConnect(connection: Party.Connection) {
    // Player is registered once we receive an explicit `join` message
    // (carries their chosen name), not on raw socket connect.
    connection.setState({ joined: false });
  }

  onMessage(raw: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    if (typeof raw !== "string") return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.t) {
      case "join":
        this.handleJoin(sender, msg.name, msg.maxPlayers);
        break;
      case "ready":
        this.handleReady(sender, msg.ready);
        break;
      case "start":
        this.handleStart(sender);
        break;
      case "rematch":
        this.handleRematch(sender);
        break;
      case "state":
        if (this.phase === "racing" || this.phase === "countdown") {
          this.broadcast(
            {
              t: "state",
              id: sender.id,
              p: msg.p,
              q: msg.q,
              v: msg.v,
              steer: msg.steer,
              throttle: msg.throttle,
              lap: msg.lap,
              cp: msg.cp,
              dist: msg.dist,
              place: msg.place,
              seq: msg.seq,
              ts: msg.ts,
            },
            [sender.id],
          );
        }
        break;
      case "pickup":
        this.handlePickup(sender, msg.boxId);
        break;
      case "weapon":
        this.handleWeapon(sender, msg);
        break;
      case "finish":
        this.handleFinish(sender, msg.timeMs);
        break;
      case "ping":
        this.send(sender, { t: "pong", ts: msg.ts });
        break;
    }
  }

  onClose(connection: Party.Connection) {
    const wasHost = this.hostId === connection.id;
    const left = this.players.get(connection.id);
    this.players.delete(connection.id);
    if (!left) return;

    this.broadcast({ t: "playerLeft", id: connection.id });

    if (wasHost) {
      const next = this.players.keys().next();
      if (!next.done) {
        this.hostId = next.value;
        const p = this.players.get(this.hostId);
        if (p) {
          p.isHost = true;
          this.players.set(p.id, p);
          this.broadcast({ t: "hostChanged", hostId: this.hostId });
          this.broadcast({ t: "playerUpdated", player: p });
        }
      } else {
        this.hostId = null;
      }
    }

    if (this.phase === "racing" || this.phase === "countdown") {
      this.maybeConcludeRace();
    }
  }

  private handleJoin(sender: Party.Connection, name: string, requestedMax?: number) {
    if (this.players.has(sender.id)) return; // already joined (dup message)

    if (this.players.size === 0) {
      this.hostId = sender.id;
      this.maxPlayers = Math.min(
        MAX_PLAYERS,
        Math.max(MIN_PLAYERS, requestedMax ?? MAX_PLAYERS),
      );
    }

    if (this.players.size >= this.maxPlayers) {
      this.send(sender, { t: "error", message: "Room is full." });
      sender.close();
      return;
    }

    if (this.phase !== "lobby") {
      this.send(sender, {
        t: "error",
        message: "Race already in progress — try again once it finishes.",
      });
      sender.close();
      return;
    }

    const info: PlayerInfo = {
      id: sender.id,
      name: sanitizeName(name),
      color: PLAYER_COLORS[this.players.size % PLAYER_COLORS.length],
      ready: false,
      connected: true,
      isHost: sender.id === this.hostId,
      joinedAt: Date.now(),
    };
    this.players.set(sender.id, info);
    sender.setState({ joined: true });

    this.send(sender, {
      t: "welcome",
      selfId: sender.id,
      roomId: this.room.id,
      players: Array.from(this.players.values()),
      phase: this.phase,
      hostId: this.hostId ?? sender.id,
      maxPlayers: this.maxPlayers,
    });

    this.broadcast({ t: "playerJoined", player: info }, [sender.id]);
  }

  private handleReady(sender: Party.Connection, ready: boolean) {
    const p = this.players.get(sender.id);
    if (!p || this.phase !== "lobby") return;
    p.ready = ready;
    this.players.set(p.id, p);
    this.broadcast({ t: "playerUpdated", player: p });
  }

  private handleStart(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "lobby") return;
    if (this.players.size < MIN_PLAYERS) {
      this.send(sender, {
        t: "error",
        message: `Need at least ${MIN_PLAYERS} players to start.`,
      });
      return;
    }
    const allReady = Array.from(this.players.values()).every((p) => p.ready);
    if (!allReady) {
      this.send(sender, { t: "error", message: "Not everyone is ready yet." });
      return;
    }

    this.itemBoxes.clear();
    this.finishedIds.clear();
    this.finishOrder = [];
    this.phase = "countdown";
    const startAt = Date.now() + COUNTDOWN_MS;
    const order = Array.from(this.players.keys());

    this.broadcast({ t: "raceStart", startAt, order });

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => {
      if (this.phase === "countdown") {
        this.phase = "racing";
        this.broadcast({ t: "phaseChanged", phase: "racing" });
      }
    }, COUNTDOWN_MS + 50);
  }

  private handleRematch(sender: Party.Connection) {
    if (sender.id !== this.hostId || this.phase !== "finished") return;
    this.phase = "lobby";
    this.finishedIds.clear();
    this.finishOrder = [];
    this.itemBoxes.clear();
    for (const p of this.players.values()) {
      p.ready = false;
      this.players.set(p.id, p);
    }
    this.broadcast({ t: "phaseChanged", phase: "lobby" });
    for (const p of this.players.values()) {
      this.broadcast({ t: "playerUpdated", player: p });
    }
  }

  private handlePickup(sender: Party.Connection, boxId: string) {
    if (this.phase !== "racing") return;
    const now = Date.now();
    const existing = this.itemBoxes.get(boxId);
    if (existing && existing.consumedUntil > now) return;

    const item = WEAPON_KINDS[Math.floor(Math.random() * WEAPON_KINDS.length)];
    const respawnAt = now + ITEM_BOX_RESPAWN_MS;
    this.itemBoxes.set(boxId, { consumedUntil: respawnAt });

    this.send(sender, { t: "itemGranted", id: sender.id, item, boxId });
    this.broadcast({ t: "boxConsumed", boxId, respawnAt });
  }

  private handleWeapon(
    sender: Party.Connection,
    msg: Extract<ClientMessage, { t: "weapon" }>,
  ) {
    if (this.phase !== "racing") return;
    const player = this.players.get(sender.id);
    if (!player) return;

    this.broadcast({
      t: "weaponFired",
      id: msg.id,
      kind: msg.kind,
      from: sender.id,
      fromName: player.name,
      p: msg.p,
      yaw: msg.yaw,
      targetId: msg.targetId,
      targetP: msg.targetP,
    });

    if ((msg.kind === "ball" || msg.kind === "blueprint") && msg.targetId) {
      const targetId = msg.targetId;
      const delay = WEAPON_DURATION[msg.kind];
      setTimeout(() => {
        if (!this.players.has(targetId)) return;
        this.broadcast({
          t: "hitApplied",
          targetId,
          kind: msg.kind,
          from: sender.id,
        });
      }, delay);
    }
  }

  private handleFinish(sender: Party.Connection, timeMs: number) {
    if (this.phase !== "racing" || this.finishedIds.has(sender.id)) return;
    const player = this.players.get(sender.id);
    if (!player) return;

    this.finishedIds.add(sender.id);
    const place = this.finishedIds.size;
    this.finishOrder.push({ id: sender.id, name: player.name, place, timeMs, dnf: false });
    this.broadcast({ t: "playerFinished", id: sender.id, timeMs, place });

    if (this.finishedIds.size === 1 && !this.wrapUpTimer) {
      this.wrapUpTimer = setTimeout(() => this.maybeConcludeRace(true), WRAP_UP_MS);
    }
    this.maybeConcludeRace();
  }

  private maybeConcludeRace(force = false) {
    if (this.phase !== "racing" && this.phase !== "countdown") return;
    const totalConnected = this.players.size;
    const allFinished =
      totalConnected > 0 && this.finishedIds.size >= totalConnected;

    if (!allFinished && !force) return;

    if (this.wrapUpTimer) {
      clearTimeout(this.wrapUpTimer);
      this.wrapUpTimer = null;
    }

    const results: RaceResultEntry[] = [...this.finishOrder];
    let nextPlace = results.length + 1;
    for (const p of this.players.values()) {
      if (!this.finishedIds.has(p.id)) {
        results.push({ id: p.id, name: p.name, place: nextPlace++, timeMs: null, dnf: true });
      }
    }

    this.phase = "finished";
    this.broadcast({ t: "raceOver", results });
  }
}
