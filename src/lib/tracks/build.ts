import * as THREE from "three";

// -----------------------------------------------------------------------
// Generic track builder. Every track in the game (see registry.ts) is a
// closed CatmullRom curve plus a small config; this factory derives
// everything downstream — visual ribbon, physics walls, checkpoints, item
// boxes, start grid, ramp, decorative obstacles — from that single curve so
// a track can never desync from its own collision geometry.
// -----------------------------------------------------------------------

export interface TrackThemeColors {
  ground: string;
  asphalt: string;
  curbA: string;
  curbB: string;
  wall: string;
  sky: string;
}

export interface TrackConfig {
  id: string;
  name: string;
  description: string;
  controlPoints: Array<[number, number]>;
  trackWidth: number;
  theme: TrackThemeColors;
  itemBoxU: number[];
  obstacleU: number[];
  rampU: number;
  rampHeight: number;
  checkpointCount: number;
  laps: number;
}

export interface TrackSample {
  u: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  dist: number;
}

export interface WallSegment {
  position: [number, number, number];
  rotationY: number;
  length: number;
}

export interface ItemBoxDef {
  id: string;
  position: [number, number, number];
}

export type ObstacleKind = "crateStack" | "pipe" | "barrier" | "cone";
export interface ObstacleDef {
  kind: ObstacleKind;
  position: [number, number, number];
  rotationY: number;
}

export interface CheckpointDef {
  u: number;
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  distAlong: number;
}

export interface RampDef {
  position: [number, number, number];
  rotationY: number;
  width: number;
  length: number;
  height: number;
}

export interface ProgressResult {
  u: number;
  dist: number;
  lateral: number;
}

export interface RibbonGeometryData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: number[];
}

export interface TrackData {
  id: string;
  name: string;
  description: string;
  theme: TrackThemeColors;
  laps: number;
  curve: THREE.CatmullRomCurve3;
  trackWidth: number;
  trackHalfWidth: number;
  wallThickness: number;
  wallHeight: number;
  groundSize: number;
  trackLength: number;
  outerWalls: WallSegment[];
  innerWalls: WallSegment[];
  checkpointCount: number;
  checkpoints: CheckpointDef[];
  itemBoxes: ItemBoxDef[];
  obstacles: ObstacleDef[];
  ramp: RampDef;
  nearestProgress: (pos: THREE.Vector3) => ProgressResult;
  getStartTransform: (index: number) => { position: [number, number, number]; rotationY: number };
  buildRibbonGeometry: () => RibbonGeometryData;
}

const WALL_HEIGHT = 1.15;
const WALL_THICKNESS = 0.6;
const GROUND_SIZE = 340;

function buildSamples(curve: THREE.CatmullRomCurve3, count: number): TrackSample[] {
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

export function buildTrackData(config: TrackConfig): TrackData {
  const {
    id,
    name,
    description,
    controlPoints,
    trackWidth,
    theme,
    itemBoxU,
    obstacleU,
    rampU,
    rampHeight,
    checkpointCount,
    laps,
  } = config;

  const trackHalfWidth = trackWidth / 2;

  const curve = new THREE.CatmullRomCurve3(
    controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "catmullrom",
    0.5,
  );

  const fineSamples = buildSamples(curve, 360);
  const lastSample = fineSamples[fineSamples.length - 1];
  const trackLength = lastSample.dist + lastSample.point.distanceTo(fineSamples[0].point);

  const wallSamples = buildSamples(curve, 84);

  function buildWalls(side: 1 | -1): WallSegment[] {
    const segs: WallSegment[] = [];
    const n = wallSamples.length;
    for (let i = 0; i < n; i++) {
      const a = wallSamples[i];
      const b = wallSamples[(i + 1) % n];
      const pa = a.point.clone().addScaledVector(a.normal, side * trackHalfWidth);
      const pb = b.point.clone().addScaledVector(b.normal, side * trackHalfWidth);
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

  const outerWalls = buildWalls(1);
  const innerWalls = buildWalls(-1);

  function nearestProgress(pos: THREE.Vector3): ProgressResult {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < fineSamples.length; i++) {
      const d = fineSamples[i].point.distanceToSquared(pos);
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    const s = fineSamples[bestI];
    const toKart = pos.clone().sub(s.point);
    const lateral = toKart.dot(s.normal);
    return { u: s.u, dist: s.dist, lateral };
  }

  const checkpoints: CheckpointDef[] = Array.from({ length: checkpointCount }, (_, i) => {
    const u = i / checkpointCount;
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    return { u, point, tangent, distAlong: u * trackLength };
  });

  function getStartTransform(index: number): {
    position: [number, number, number];
    rotationY: number;
  } {
    const row = Math.floor(index / 2);
    const col = index % 2 === 0 ? -1 : 1;
    const backDist = 6 + row * 5.5;
    const u = (1 - backDist / trackLength + 1) % 1;
    const s = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const pos = s.clone().addScaledVector(normal, col * 3.2);
    const rotationY = Math.atan2(tangent.x, tangent.z);
    return { position: [pos.x, 0.6, pos.z], rotationY };
  }

  const itemBoxes: ItemBoxDef[] = itemBoxU.map((u, i) => {
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u).normalize();
    const n = new THREE.Vector3(t.z, 0, -t.x).normalize();
    const offset = i % 2 === 0 ? 2.6 : -2.6;
    const pos = p.clone().addScaledVector(n, offset);
    return { id: `box-${i}`, position: [pos.x, 1, pos.z] };
  });

  const ramp: RampDef = (() => {
    const p = curve.getPointAt(rampU);
    const t = curve.getTangentAt(rampU).normalize();
    const rotationY = Math.atan2(t.x, t.z);
    return { position: [p.x, 0, p.z], rotationY, width: 9, length: 12, height: rampHeight };
  })();

  const kinds: ObstacleKind[] = ["crateStack", "pipe", "barrier", "cone"];
  const obstacles: ObstacleDef[] = obstacleU.map((u, i) => {
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u).normalize();
    const n = new THREE.Vector3(t.z, 0, -t.x).normalize();
    const side = i % 2 === 0 ? -1 : 1;
    const offset = trackHalfWidth - 2.2;
    const pos = p.clone().addScaledVector(n, side * offset);
    return {
      kind: kinds[i % kinds.length],
      position: [pos.x, 0, pos.z],
      rotationY: Math.atan2(t.x, t.z),
    };
  });

  function buildRibbonGeometry(): RibbonGeometryData {
    const samples = buildSamples(curve, 200);
    const n = samples.length;
    const positions = new Float32Array((n + 1) * 2 * 3);
    const uvs = new Float32Array((n + 1) * 2 * 2);
    const indices: number[] = [];

    for (let i = 0; i <= n; i++) {
      const s = samples[i % n];
      const left = s.point.clone().addScaledVector(s.normal, trackHalfWidth);
      const right = s.point.clone().addScaledVector(s.normal, -trackHalfWidth);
      const vi = i * 2;
      positions[vi * 3] = left.x;
      positions[vi * 3 + 1] = 0;
      positions[vi * 3 + 2] = left.z;
      positions[(vi + 1) * 3] = right.x;
      positions[(vi + 1) * 3 + 1] = 0;
      positions[(vi + 1) * 3 + 2] = right.z;

      const v = (i / n) * (trackLength / 12);
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

  return {
    id,
    name,
    description,
    theme,
    laps,
    curve,
    trackWidth,
    trackHalfWidth,
    wallThickness: WALL_THICKNESS,
    wallHeight: WALL_HEIGHT,
    groundSize: GROUND_SIZE,
    trackLength,
    outerWalls,
    innerWalls,
    checkpointCount,
    checkpoints,
    itemBoxes,
    obstacles,
    ramp,
    nearestProgress,
    getStartTransform,
    buildRibbonGeometry,
  };
}
