import * as THREE from "three";

// -----------------------------------------------------------------------
// "Skyline Loop" — a closed construction-site circuit. Every downstream
// system (visual ribbon, physics walls, checkpoints, item boxes, start
// grid, ramp, decorative obstacles) is derived from this single curve so
// the track can never desync from its own collision geometry.
// -----------------------------------------------------------------------

const CONTROL_POINTS: Array<[number, number]> = [
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
];

export const TRACK_WIDTH = 16;
export const TRACK_HALF_WIDTH = TRACK_WIDTH / 2;
const WALL_HEIGHT = 1.15;
const WALL_THICKNESS = 0.6;

export const curve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true,
  "catmullrom",
  0.5,
);

export interface TrackSample {
  u: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  dist: number;
}

function buildSamples(count: number): TrackSample[] {
  const pts = curve.getSpacedPoints(count);
  const samples: TrackSample[] = [];
  let dist = 0;
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const point = pts[i];
    const tangent = curve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    if (i > 0) dist += point.distanceTo(pts[i - 1]);
    samples.push({ u, point, tangent, normal, dist });
  }
  return samples;
}

// Fine samples used for accurate progress-along-track lookups.
export const FINE_SAMPLES = buildSamples(360);
export const TRACK_LENGTH = (() => {
  const last = FINE_SAMPLES[FINE_SAMPLES.length - 1];
  return last.dist + last.point.distanceTo(FINE_SAMPLES[0].point);
})();

// Coarse samples used to build the physical/visual boundary fences.
const WALL_SAMPLES = buildSamples(84);

export interface WallSegment {
  position: [number, number, number];
  rotationY: number;
  length: number;
}

function buildWalls(side: 1 | -1): WallSegment[] {
  const segs: WallSegment[] = [];
  const n = WALL_SAMPLES.length;
  for (let i = 0; i < n; i++) {
    const a = WALL_SAMPLES[i];
    const b = WALL_SAMPLES[(i + 1) % n];
    const pa = a.point.clone().addScaledVector(a.normal, side * TRACK_HALF_WIDTH);
    const pb = b.point.clone().addScaledVector(b.normal, side * TRACK_HALF_WIDTH);
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    const length = pa.distanceTo(pb);
    const angle = Math.atan2(pb.x - pa.x, pb.z - pa.z);
    segs.push({
      position: [mid.x, WALL_HEIGHT / 2, mid.z],
      rotationY: angle,
      length: length + 0.15,
    });
  }
  return segs;
}

export const OUTER_WALLS = buildWalls(1);
export const INNER_WALLS = buildWalls(-1);
export const WALL_THICKNESS_M = WALL_THICKNESS;
export const WALL_HEIGHT_M = WALL_HEIGHT;

// ---------------------------------------------------------------------
// Progress lookup — nearest-sample search against the fine sample set.
// Called once per frame for the locally controlled kart only.
// ---------------------------------------------------------------------
export interface ProgressResult {
  u: number;
  dist: number;
  lateral: number;
}

export function nearestProgress(pos: THREE.Vector3): ProgressResult {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < FINE_SAMPLES.length; i++) {
    const d = FINE_SAMPLES[i].point.distanceToSquared(pos);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  const s = FINE_SAMPLES[bestI];
  const toKart = pos.clone().sub(s.point);
  const lateral = toKart.dot(s.normal);
  return { u: s.u, dist: s.dist, lateral };
}

// ---------------------------------------------------------------------
// Checkpoints
// ---------------------------------------------------------------------
export const CHECKPOINT_COUNT = 8;
export const CHECKPOINTS = Array.from({ length: CHECKPOINT_COUNT }, (_, i) => {
  const u = i / CHECKPOINT_COUNT;
  const point = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).normalize();
  return { u, point, tangent, distAlong: u * TRACK_LENGTH };
});

// ---------------------------------------------------------------------
// Start grid — staggered 2-wide formation behind the start/finish line.
// ---------------------------------------------------------------------
export function getStartTransform(index: number): {
  position: [number, number, number];
  rotationY: number;
} {
  const row = Math.floor(index / 2);
  const col = index % 2 === 0 ? -1 : 1;
  const backDist = 6 + row * 5.5;
  const u = (1 - backDist / TRACK_LENGTH + 1) % 1;
  const s = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).normalize();
  const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
  const pos = s.clone().addScaledVector(normal, col * 3.2);
  const rotationY = Math.atan2(tangent.x, tangent.z);
  return { position: [pos.x, 0.6, pos.z], rotationY };
}

// ---------------------------------------------------------------------
// Item boxes
// ---------------------------------------------------------------------
export interface ItemBoxDef {
  id: string;
  position: [number, number, number];
}

const ITEM_BOX_U = [0.06, 0.16, 0.27, 0.37, 0.48, 0.58, 0.68, 0.78, 0.88, 0.96];
export const ITEM_BOXES: ItemBoxDef[] = ITEM_BOX_U.map((u, i) => {
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).normalize();
  const n = new THREE.Vector3(t.z, 0, -t.x).normalize();
  const offset = i % 2 === 0 ? 2.6 : -2.6;
  const pos = p.clone().addScaledVector(n, offset);
  return { id: `box-${i}`, position: [pos.x, 1, pos.z] };
});

// ---------------------------------------------------------------------
// Boost ramp
// ---------------------------------------------------------------------
export const RAMP = (() => {
  const u = 0.09;
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).normalize();
  const rotationY = Math.atan2(t.x, t.z);
  return {
    position: [p.x, 0, p.z] as [number, number, number],
    rotationY,
    width: 9,
    length: 12,
    height: 3.2,
  };
})();

// ---------------------------------------------------------------------
// Decorative / collidable construction obstacles
// ---------------------------------------------------------------------
export type ObstacleKind = "crateStack" | "pipe" | "barrier" | "cone";
export interface ObstacleDef {
  kind: ObstacleKind;
  position: [number, number, number];
  rotationY: number;
}

const OBSTACLE_U = [0.13, 0.22, 0.32, 0.42, 0.53, 0.63, 0.73, 0.82, 0.92, 0.985];
export const OBSTACLES: ObstacleDef[] = OBSTACLE_U.map((u, i) => {
  const p = curve.getPointAt(u);
  const t = curve.getTangentAt(u).normalize();
  const n = new THREE.Vector3(t.z, 0, -t.x).normalize();
  const side = i % 2 === 0 ? -1 : 1;
  const offset = TRACK_HALF_WIDTH - 2.2;
  const pos = p.clone().addScaledVector(n, side * offset);
  const kinds: ObstacleKind[] = ["crateStack", "pipe", "barrier", "cone"];
  return {
    kind: kinds[i % kinds.length],
    position: [pos.x, 0, pos.z],
    rotationY: Math.atan2(t.x, t.z),
  };
});

export const GROUND_SIZE = 320;

// ---------------------------------------------------------------------
// Visual ribbon mesh (flat quad strip following the track boundary).
// ---------------------------------------------------------------------
export function buildRibbonGeometry() {
  const samples = buildSamples(200);
  const n = samples.length;
  const positions = new Float32Array((n + 1) * 2 * 3);
  const uvs = new Float32Array((n + 1) * 2 * 2);
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const left = s.point.clone().addScaledVector(s.normal, TRACK_HALF_WIDTH);
    const right = s.point.clone().addScaledVector(s.normal, -TRACK_HALF_WIDTH);
    const vi = i * 2;
    positions[vi * 3] = left.x;
    positions[vi * 3 + 1] = 0;
    positions[vi * 3 + 2] = left.z;
    positions[(vi + 1) * 3] = right.x;
    positions[(vi + 1) * 3 + 1] = 0;
    positions[(vi + 1) * 3 + 2] = right.z;

    const v = (i / n) * (TRACK_LENGTH / 12);
    uvs[vi * 2] = 0;
    uvs[vi * 2 + 1] = v;
    uvs[(vi + 1) * 2] = 1;
    uvs[(vi + 1) * 2 + 1] = v;

    if (i < n) {
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      indices.push(a, b, c, b, d, c);
    }
  }

  return { positions, uvs, indices };
}
