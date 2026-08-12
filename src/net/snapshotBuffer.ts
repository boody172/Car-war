// High-frequency remote-kart transform buffer.
//
// Deliberately kept OUTSIDE React/Zustand: position/rotation snapshots arrive
// at ~18Hz and are sampled every render frame (~60Hz) by RemoteKart via
// useFrame. Routing that through reactive state would force a re-render per
// packet per kart. Instead we buffer snapshots per player and let consumers
// pull an interpolated pose imperatively — this is what keeps the game
// smooth and jank-free even when a peer's connection is choppy: a stalled
// buffer just holds the last known pose instead of anything breaking.

import { INTERP_DELAY_MS, SNAPSHOT_BUFFER_MAX } from "@/lib/constants";
import type { Vec3, Quat } from "@/shared/types";

export interface Snapshot {
  ts: number; // sender-local send time (ms)
  recvAt: number; // local receive time (ms) — used as playback clock
  p: Vec3;
  q: Quat;
  v: Vec3;
  steer: number;
  throttle: number;
  lap: number;
  cp: number;
  dist: number;
  place: number;
}

const buffers = new Map<string, Snapshot[]>();

export function pushSnapshot(id: string, snap: Snapshot) {
  let buf = buffers.get(id);
  if (!buf) {
    buf = [];
    buffers.set(id, buf);
  }
  buf.push(snap);
  if (buf.length > SNAPSHOT_BUFFER_MAX) buf.shift();
}

export function dropPlayer(id: string) {
  buffers.delete(id);
}

export function clearAll() {
  buffers.clear();
}

/** Latest raw (non-interpolated) snapshot — used for low-frequency ranking/targeting logic. */
export function getLatest(id: string): Snapshot | null {
  const buf = buffers.get(id);
  if (!buf || buf.length === 0) return null;
  return buf[buf.length - 1];
}

export function getAllIds(): string[] {
  return Array.from(buffers.keys());
}

export interface InterpolatedPose {
  p: Vec3;
  q: Quat;
  v: Vec3;
  steer: number;
  throttle: number;
  lap: number;
  cp: number;
  dist: number;
  place: number;
  stale: boolean;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  let dot = ax * bx + ay * by + az * bz + aw * bw;
  if (dot < 0) {
    ax = -ax;
    ay = -ay;
    az = -az;
    aw = -aw;
    dot = -dot;
  }
  if (dot > 0.9995) {
    return [
      lerp(ax, bx, t),
      lerp(ay, by, t),
      lerp(az, bz, t),
      lerp(aw, bw, t),
    ];
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta = Math.sin(theta);
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;
  return [
    ax * s0 + bx * s1,
    ay * s0 + by * s1,
    az * s0 + bz * s1,
    aw * s0 + bw * s1,
  ];
}

/** Returns an interpolated (or extrapolated, if the buffer stalls) pose for `id`. */
export function getInterpolated(id: string, now: number): InterpolatedPose | null {
  const buf = buffers.get(id);
  if (!buf || buf.length === 0) return null;

  const renderTime = now - INTERP_DELAY_MS;

  if (buf.length === 1) {
    const s = buf[0];
    return { ...s, stale: now - s.recvAt > 500 };
  }

  // Find the bracketing pair [older, newer] around renderTime.
  let older = buf[0];
  let newer = buf[buf.length - 1];
  let found = false;
  for (let i = 0; i < buf.length - 1; i++) {
    if (buf[i].recvAt <= renderTime && buf[i + 1].recvAt >= renderTime) {
      older = buf[i];
      newer = buf[i + 1];
      found = true;
      break;
    }
  }

  if (!found) {
    if (renderTime > newer.recvAt) {
      // Buffer underrun (peer is lagging) — extrapolate briefly from last
      // known velocity rather than snapping or, worse, dropping the peer.
      const dtSec = Math.min((renderTime - newer.recvAt) / 1000, 0.35);
      const p: Vec3 = [
        newer.p[0] + newer.v[0] * dtSec,
        newer.p[1] + newer.v[1] * dtSec,
        newer.p[2] + newer.v[2] * dtSec,
      ];
      return {
        ...newer,
        p,
        stale: now - newer.recvAt > 500,
      };
    }
    older = buf[0];
    newer = buf[0];
  }

  const span = newer.recvAt - older.recvAt;
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - older.recvAt) / span)) : 1;

  return {
    p: lerp3(older.p, newer.p, t),
    q: slerpQuat(older.q, newer.q, t),
    v: lerp3(older.v, newer.v, t),
    steer: lerp(older.steer, newer.steer, t),
    throttle: lerp(older.throttle, newer.throttle, t),
    lap: newer.lap,
    cp: newer.cp,
    dist: lerp(older.dist, newer.dist, t),
    place: newer.place,
    stale: now - newer.recvAt > 500,
  };
}
