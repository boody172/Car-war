import * as THREE from "three";
import type { TrackData } from "@/lib/tracks/build";
import { getAllIds, getLatest } from "@/net/snapshotBuffer";

export class RaceProgressTracker {
  lap = 1;
  nextCpIndex = 1;
  dist = 0;
  lateral = 0;

  constructor(private track: TrackData) {}

  update(position: THREE.Vector3): { lapChanged: boolean; cpChanged: boolean } {
    const { dist, lateral } = this.track.nearestProgress(position);
    this.lateral = lateral;
    let lapChanged = false;
    let cpChanged = false;
    const checkpointCount = this.track.checkpointCount;
    const trackLength = this.track.trackLength;

    if (this.nextCpIndex < checkpointCount) {
      const target = this.track.checkpoints[this.nextCpIndex].distAlong;
      if (dist >= target) {
        this.nextCpIndex++;
        cpChanged = true;
      }
    } else {
      // Waiting for the start/finish line: distance wraps from near
      // trackLength back down near 0.
      if (this.dist > trackLength * 0.85 && dist < trackLength * 0.15) {
        this.lap++;
        this.nextCpIndex = 1;
        lapChanged = true;
      }
    }

    this.dist = dist;
    return { lapChanged, cpChanged };
  }

  get checkpointsPassed() {
    const checkpointCount = this.track.checkpointCount;
    return this.nextCpIndex >= checkpointCount ? checkpointCount : this.nextCpIndex;
  }
}

interface Progress {
  id: string;
  lap: number;
  cp: number;
  dist: number;
}

/** 1-indexed placement among all currently-known racers. */
export function computePlace(selfId: string, self: Omit<Progress, "id">): number {
  const all: Progress[] = [{ id: selfId, ...self }];
  for (const id of getAllIds()) {
    const snap = getLatest(id);
    if (snap) all.push({ id, lap: snap.lap, cp: snap.cp, dist: snap.dist });
  }
  all.sort((a, b) => {
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.cp !== b.cp) return b.cp - a.cp;
    return b.dist - a.dist;
  });
  return all.findIndex((p) => p.id === selfId) + 1;
}

/**
 * Closest opponent actually in front of the shooter — within a forward
 * cone and range — rather than a blind auto-lock onto the leader or nearest
 * rival. Used to fire the wrecking ball and blueprint blindness: you have to
 * actually point your kart at someone to hit them. Returns null on a miss
 * (nobody in the cone), which the caller still fires as a clean whiff rather
 * than silently cancelling the shot.
 */
export function findInAimCone(
  fromPos: THREE.Vector3,
  forward: THREE.Vector3,
  excludeId: string | undefined,
  maxAngleRad: number,
  maxRange: number,
): { id: string; position: THREE.Vector3 } | null {
  const fwd = forward.clone().normalize();
  let best: { id: string; position: THREE.Vector3 } | null = null;
  let bestDist = Infinity;
  for (const id of getAllIds()) {
    if (id === excludeId) continue;
    const snap = getLatest(id);
    if (!snap) continue;
    const p = new THREE.Vector3(snap.p[0], snap.p[1], snap.p[2]);
    const toTarget = p.clone().sub(fromPos);
    const dist = toTarget.length();
    if (dist < 0.05 || dist > maxRange) continue;
    const angle = fwd.angleTo(toTarget.multiplyScalar(1 / dist));
    if (angle > maxAngleRad) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = { id, position: p };
    }
  }
  return best;
}
