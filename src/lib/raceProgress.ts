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

/** Finds the current race leader among opponents (highest lap/checkpoint/dist). */
export function findLeader(excludeId?: string): string | null {
  const candidates: Progress[] = [];
  for (const id of getAllIds()) {
    if (id === excludeId) continue;
    const snap = getLatest(id);
    if (snap) candidates.push({ id, lap: snap.lap, cp: snap.cp, dist: snap.dist });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.cp !== b.cp) return b.cp - a.cp;
    return b.dist - a.dist;
  });
  return candidates[0].id;
}

/** Nearest other racer to a world position — used for Blueprint Blindness targeting. */
export function findNearest(
  fromPos: THREE.Vector3,
  excludeId?: string,
): { id: string; position: THREE.Vector3 } | null {
  let best: { id: string; position: THREE.Vector3 } | null = null;
  let bestD = Infinity;
  for (const id of getAllIds()) {
    if (id === excludeId) continue;
    const snap = getLatest(id);
    if (!snap) continue;
    const p = new THREE.Vector3(snap.p[0], snap.p[1], snap.p[2]);
    const d = p.distanceToSquared(fromPos);
    if (d < bestD) {
      bestD = d;
      best = { id, position: p };
    }
  }
  return best;
}
