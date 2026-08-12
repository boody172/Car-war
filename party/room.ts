import type * as Party from "partykit/server";
import type {
  ClientMessage,
  ServerMessage,
  PlayerInfo,
  RoomPhase,
  RoomMode,
  WeaponKind,
  RaceResultEntry,
  BattleResultEntry,
} from "../src/shared/types";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  DEFAULT_TRACK_ID,
  ARENA_TRACK_ID,
} from "../src/shared/types";
import { unclaimedCharacter, getCharacter } from "../src/shared/characters";
import {
  WEAPON_DURATION,
  ITEM_BOX_RESPAWN_MS,
  COUNTDOWN_MS,
  BATTLE_DURATION_MS,
  DISCONNECT_GRACE_MS,
} from "../src/lib/constants";

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
  players = new Map<string, PlayerInfo>(); // keyed by stable playerId
  connToPlayer = new Map<string, string>(); // PartyKit connection.id -> playerId (changes across reconnects)
  sessionIndex = new Map<string, string>(); // client-persisted sessionId -> playerId
  disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>(); // playerId -> pending-removal timer
  hostId: string | null = null;
  phase: RoomPhase = "lobby";
  mode: RoomMode = "race";
  maxPlayers = MAX_PLAYERS;
  trackId: string = DEFAULT_TRACK_ID;
  itemBoxes = new Map<string, ItemBoxState>();
  finishedIds = new Set<string>();
  finishOrder: RaceResultEntry[] = [];
  scores = new Map<string, number>();
  wrapUpTimer: ReturnType<typeof setTimeout> | null = null;
  phaseTimer: ReturnType<typeof setTimeout> | null = null;
  battleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {}

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, without?: string[]) {
    this.room.broadcast(JSON.stringify(msg), without);
  }

  /** Resolves a raw PartyKit connection back to the stable player record it's currently mapped to. */
  private playerFor(sender: Party.Connection): PlayerInfo | undefined {
    const pid = this.connToPlayer.get(sender.id);
    return pid ? this.players.get(pid) : undefined;
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
        this.handleJoin(sender, msg.name, msg.maxPlayers, msg.trackId, msg.mode, msg.sessionId);
        break;
      case "leave":
        this.handleLeave(sender);
        break;
      case "ready":
        this.handleReady(sender, msg.ready);
        break;
      case "selectCharacter":
        this.handleSelectCharacter(sender, msg.characterId);
        break;
      case "selectTrack":
        this.handleSelectTrack(sender, msg.trackId);
        break;
      case "start":
        this.handleStart(sender);
        break;
      case "rematch":
        this.handleRematch(sender);
        break;
      case "state": {
        if (this.phase !== "racing" && this.phase !== "countdown") break;
        const playerId = this.connToPlayer.get(sender.id);
        if (!playerId) break;
        this.broadcast(
          {
            t: "state",
            id: playerId,
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
        break;
      }
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

  /** Explicit, user-chosen departure — always removes the seat immediately, no grace period. */
  private handleLeave(sender: Party.Connection) {
    const playerId = this.connToPlayer.get(sender.id);
    if (!playerId) return;
    this.connToPlayer.delete(sender.id);
    this.removePlayer(playerId);
  }

  onClose(connection: Party.Connection) {
    const playerId = this.connToPlayer.get(connection.id);
    this.connToPlayer.delete(connection.id);
    if (!playerId) return; // already handled via an explicit "leave", or never fully joined

    const player = this.players.get(playerId);
    if (!player) return;

    // Unintentional drop (network blip, backgrounded tab, reload): hold their
    // seat for a grace window instead of announcing them gone right away —
    // an explicit Leave (handleLeave, above) is the only path that removes a
    // player immediately.
    player.connected = false;
    this.players.set(playerId, player);
    this.broadcast({ t: "playerUpdated", player });

    const existingTimer = this.disconnectTimers.get(playerId);
    if (existingTimer) clearTimeout(existingTimer);
    this.disconnectTimers.set(
      playerId,
      setTimeout(() => {
        this.disconnectTimers.delete(playerId);
        // Only actually remove them if they never reconnected in time.
        if (this.players.get(playerId)?.connected === false) {
          this.removePlayer(playerId);
        }
      }, DISCONNECT_GRACE_MS),
    );
  }

  /** Fully removes a player's seat: roster, host handoff, and race/battle bookkeeping. */
  private removePlayer(playerId: string) {
    const existing = this.players.get(playerId);
    if (!existing) return;

    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }
    for (const [sessionId, pid] of this.sessionIndex) {
      if (pid === playerId) this.sessionIndex.delete(sessionId);
    }

    this.players.delete(playerId);
    this.broadcast({ t: "playerLeft", id: playerId });

    if (this.hostId === playerId) {
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

  private handleJoin(
    sender: Party.Connection,
    name: string,
    requestedMax?: number,
    requestedTrackId?: string,
    requestedMode?: RoomMode,
    sessionId?: string,
  ) {
    if (this.connToPlayer.has(sender.id)) return; // already joined on this connection (dup message)

    // Reattachment: same browser session reconnecting after a network blip,
    // tab reload, or backgrounded phone — resume their existing seat rather
    // than treating them as a brand-new player (which would also get
    // rejected outright once the race has started).
    if (sessionId) {
      const existingPlayerId = this.sessionIndex.get(sessionId);
      const existing = existingPlayerId ? this.players.get(existingPlayerId) : undefined;
      if (existingPlayerId && existing) {
        this.connToPlayer.set(sender.id, existingPlayerId);
        existing.connected = true;
        existing.name = sanitizeName(name);
        this.players.set(existingPlayerId, existing);

        const timer = this.disconnectTimers.get(existingPlayerId);
        if (timer) {
          clearTimeout(timer);
          this.disconnectTimers.delete(existingPlayerId);
        }

        sender.setState({ joined: true });
        this.send(sender, {
          t: "welcome",
          selfId: existingPlayerId,
          roomId: this.room.id,
          players: Array.from(this.players.values()),
          phase: this.phase,
          hostId: this.hostId ?? existingPlayerId,
          maxPlayers: this.maxPlayers,
          trackId: this.trackId,
          mode: this.mode,
          rejoined: true,
        });
        this.broadcast({ t: "playerUpdated", player: existing }, [sender.id]);
        return;
      }
    }

    if (this.players.size === 0) {
      this.hostId = sender.id;
      this.maxPlayers = Math.min(
        MAX_PLAYERS,
        Math.max(MIN_PLAYERS, requestedMax ?? MAX_PLAYERS),
      );
      this.mode = requestedMode === "battle" ? "battle" : "race";
      this.trackId = this.mode === "battle" ? ARENA_TRACK_ID : requestedTrackId ?? this.trackId;
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

    const takenCharacters = Array.from(this.players.values()).map((p) => p.characterId);
    const character = unclaimedCharacter(takenCharacters);
    const playerId = sender.id;

    const info: PlayerInfo = {
      id: playerId,
      name: sanitizeName(name),
      color: character.color,
      characterId: character.id,
      ready: false,
      connected: true,
      isHost: playerId === this.hostId,
      joinedAt: Date.now(),
    };
    this.players.set(playerId, info);
    this.connToPlayer.set(sender.id, playerId);
    if (sessionId) this.sessionIndex.set(sessionId, playerId);
    sender.setState({ joined: true });

    this.send(sender, {
      t: "welcome",
      selfId: playerId,
      roomId: this.room.id,
      players: Array.from(this.players.values()),
      phase: this.phase,
      hostId: this.hostId ?? playerId,
      maxPlayers: this.maxPlayers,
      trackId: this.trackId,
      mode: this.mode,
      rejoined: false,
    });

    this.broadcast({ t: "playerJoined", player: info }, [sender.id]);
  }

  private handleReady(sender: Party.Connection, ready: boolean) {
    const p = this.playerFor(sender);
    if (!p || this.phase !== "lobby") return;
    p.ready = ready;
    this.players.set(p.id, p);
    this.broadcast({ t: "playerUpdated", player: p });
  }

  private handleSelectCharacter(sender: Party.Connection, characterId: string) {
    const p = this.playerFor(sender);
    if (!p || this.phase !== "lobby") return;
    const character = getCharacter(characterId);
    if (!character) return;
    const takenByOther = Array.from(this.players.values()).some(
      (other) => other.id !== p.id && other.characterId === characterId,
    );
    if (takenByOther) {
      this.send(sender, { t: "error", message: "That driver is already taken." });
      return;
    }
    p.characterId = character.id;
    p.color = character.color;
    this.players.set(p.id, p);
    this.broadcast({ t: "playerUpdated", player: p });
  }

  private handleSelectTrack(sender: Party.Connection, trackId: string) {
    const p = this.playerFor(sender);
    if (!p || p.id !== this.hostId || this.phase !== "lobby") return;
    if (this.mode === "battle") return; // arena is fixed for battle mode
    if (!trackId) return;
    this.trackId = trackId;
    this.broadcast({ t: "trackChanged", trackId });
  }

  private handleStart(sender: Party.Connection) {
    const starter = this.playerFor(sender);
    if (!starter || starter.id !== this.hostId || this.phase !== "lobby") return;
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
    this.scores.clear();
    this.phase = "countdown";
    const startAt = Date.now() + COUNTDOWN_MS;
    const order = Array.from(this.players.keys());

    this.broadcast({ t: "raceStart", startAt, order, trackId: this.trackId, mode: this.mode });

    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (this.battleTimer) clearTimeout(this.battleTimer);
    this.phaseTimer = setTimeout(() => {
      if (this.phase === "countdown") {
        this.phase = "racing";
        this.broadcast({ t: "phaseChanged", phase: "racing" });
      }
    }, COUNTDOWN_MS + 50);

    if (this.mode === "battle") {
      this.battleTimer = setTimeout(() => {
        this.concludeBattle();
      }, COUNTDOWN_MS + BATTLE_DURATION_MS);
    }
  }

  private handleRematch(sender: Party.Connection) {
    const p = this.playerFor(sender);
    if (!p || p.id !== this.hostId || this.phase !== "finished") return;
    this.phase = "lobby";
    this.finishedIds.clear();
    this.finishOrder = [];
    this.itemBoxes.clear();
    this.scores.clear();
    if (this.battleTimer) {
      clearTimeout(this.battleTimer);
      this.battleTimer = null;
    }
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
    const p = this.playerFor(sender);
    if (!p) return;
    const now = Date.now();
    const existing = this.itemBoxes.get(boxId);
    if (existing && existing.consumedUntil > now) return;

    const item = WEAPON_KINDS[Math.floor(Math.random() * WEAPON_KINDS.length)];
    const respawnAt = now + ITEM_BOX_RESPAWN_MS;
    this.itemBoxes.set(boxId, { consumedUntil: respawnAt });

    this.send(sender, { t: "itemGranted", id: p.id, item, boxId });
    this.broadcast({ t: "boxConsumed", boxId, respawnAt });
  }

  private handleWeapon(
    sender: Party.Connection,
    msg: Extract<ClientMessage, { t: "weapon" }>,
  ) {
    if (this.phase !== "racing") return;
    const player = this.playerFor(sender);
    if (!player) return;

    this.broadcast({
      t: "weaponFired",
      id: msg.id,
      kind: msg.kind,
      from: player.id,
      fromName: player.name,
      p: msg.p,
      yaw: msg.yaw,
      targetId: msg.targetId,
      targetP: msg.targetP,
    });

    if ((msg.kind === "ball" || msg.kind === "blueprint") && msg.targetId) {
      const targetId = msg.targetId;
      const delay = WEAPON_DURATION[msg.kind];
      const attackerId = player.id;
      setTimeout(() => {
        if (!this.players.has(targetId)) return;
        this.broadcast({
          t: "hitApplied",
          targetId,
          kind: msg.kind,
          from: attackerId,
        });
        if (this.mode === "battle" && this.phase === "racing") {
          this.scores.set(attackerId, (this.scores.get(attackerId) ?? 0) + 1);
        }
      }, delay);
    }
  }

  private handleFinish(sender: Party.Connection, timeMs: number) {
    if (this.phase !== "racing") return;
    const player = this.playerFor(sender);
    if (!player || this.finishedIds.has(player.id)) return;

    this.finishedIds.add(player.id);
    const place = this.finishedIds.size;
    this.finishOrder.push({ id: player.id, name: player.name, place, timeMs, dnf: false });
    this.broadcast({ t: "playerFinished", id: player.id, timeMs, place });

    if (this.finishedIds.size === 1 && !this.wrapUpTimer) {
      this.wrapUpTimer = setTimeout(() => this.maybeConcludeRace(true), WRAP_UP_MS);
    }
    this.maybeConcludeRace();
  }

  private maybeConcludeRace(force = false) {
    if (this.mode !== "race") return;
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

  private concludeBattle() {
    if (this.mode !== "battle") return;
    if (this.phase !== "racing" && this.phase !== "countdown") return;

    if (this.battleTimer) {
      clearTimeout(this.battleTimer);
      this.battleTimer = null;
    }

    const ranked = Array.from(this.players.values())
      .map((p) => ({ id: p.id, name: p.name, score: this.scores.get(p.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);

    const results: BattleResultEntry[] = ranked.map((r, i) => ({
      id: r.id,
      name: r.name,
      score: r.score,
      place: i + 1,
    }));

    this.phase = "finished";
    this.broadcast({ t: "battleOver", results });
  }
}
