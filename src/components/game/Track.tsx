"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { usePlane, useBox, useCylinder } from "@react-three/cannon";
import {
  OUTER_WALLS,
  INNER_WALLS,
  WALL_THICKNESS_M,
  WALL_HEIGHT_M,
  OBSTACLES,
  RAMP,
  GROUND_SIZE,
  buildRibbonGeometry,
  type ObstacleDef,
} from "@/lib/track";

function GroundCollider() {
  usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: { friction: 0, restitution: 0.05 },
  }));
  return null;
}

function GroundVisual() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial color="#3c6b3f" roughness={0.95} />
    </mesh>
  );
}

function TrackRibbon() {
  const geometry = useMemo(() => {
    const { positions, uvs, indices } = buildRibbonGeometry();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#454851" roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

interface WallSegmentProps {
  position: [number, number, number];
  rotationY: number;
  length: number;
  curbColor: string;
}

function WallSegment({ position, rotationY, length, curbColor }: WallSegmentProps) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [WALL_THICKNESS_M, WALL_HEIGHT_M, length],
    position,
    rotation: [0, rotationY, 0],
    material: { friction: 0.2, restitution: 0.35 },
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[WALL_THICKNESS_M, WALL_HEIGHT_M, length]} />
        <meshStandardMaterial color="#e8ddb5" roughness={0.75} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT_M / 2 + 0.03, 0]}>
        <boxGeometry args={[WALL_THICKNESS_M + 0.05, 0.06, length]} />
        <meshStandardMaterial color={curbColor} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Walls() {
  return (
    <>
      {OUTER_WALLS.map((w, i) => (
        <WallSegment
          key={`out-${i}`}
          position={w.position}
          rotationY={w.rotationY}
          length={w.length}
          curbColor={i % 2 === 0 ? "#ff5a3c" : "#f4f2ea"}
        />
      ))}
      {INNER_WALLS.map((w, i) => (
        <WallSegment
          key={`in-${i}`}
          position={w.position}
          rotationY={w.rotationY}
          length={w.length}
          curbColor={i % 2 === 0 ? "#ffd23c" : "#f4f2ea"}
        />
      ))}
    </>
  );
}

function Ramp() {
  const angle = Math.atan2(RAMP.height, RAMP.length);
  const thickness = 0.9;
  const [ref] = useBox(() => ({
    type: "Static",
    args: [RAMP.width, thickness, RAMP.length],
    position: [RAMP.position[0], RAMP.height / 2 - 0.3, RAMP.position[2]],
    rotation: [-angle, RAMP.rotationY, 0],
    material: { friction: 0.15, restitution: 0.05 },
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[RAMP.width, thickness, RAMP.length]} />
        <meshStandardMaterial color="#b9762f" roughness={0.8} />
      </mesh>
    </group>
  );
}

function CrateStack({ position, rotationY }: ObstacleDef) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [1.6, 1.6, 1.6],
    position: [position[0], 0.8, position[2]],
    rotation: [0, rotationY, 0],
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.6, 1.6, 1.6]} />
        <meshStandardMaterial color="#c98a4b" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.81]}>
        <boxGeometry args={[1.3, 1.3, 0.02]} />
        <meshStandardMaterial color="#9c6530" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Pipe({ position, rotationY }: ObstacleDef) {
  const [ref] = useCylinder(() => ({
    type: "Static",
    args: [0.75, 0.75, 3.2, 16],
    position: [position[0], 0.75, position[2]],
    rotation: [0, 0, Math.PI / 2],
  }));
  void rotationY;
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.75, 0.75, 3.2, 16]} />
        <meshStandardMaterial color="#7d8590" roughness={0.6} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Barrier({ position, rotationY }: ObstacleDef) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [2.6, 1.1, 0.5],
    position: [position[0], 0.55, position[2]],
    rotation: [0, rotationY, 0],
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.6, 1.1, 0.5]} />
        <meshStandardMaterial color="#ff8a3c" roughness={0.6} />
      </mesh>
      {[-1, 0, 1].map((k) => (
        <mesh key={k} position={[k * 0.75, 0, 0.26]}>
          <boxGeometry args={[0.4, 1.15, 0.02]} />
          <meshStandardMaterial color="#1c1c20" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Cone({ position }: ObstacleDef) {
  const [ref] = useCylinder(() => ({
    type: "Static",
    args: [0.05, 0.4, 0.9, 12],
    position: [position[0], 0.45, position[2]],
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.4, 0.9, 12]} />
        <meshStandardMaterial color="#ff5a3c" roughness={0.7} />
      </mesh>
    </group>
  );
}

function Obstacles() {
  return (
    <>
      {OBSTACLES.map((o, i) => {
        switch (o.kind) {
          case "crateStack":
            return <CrateStack key={i} {...o} />;
          case "pipe":
            return <Pipe key={i} {...o} />;
          case "barrier":
            return <Barrier key={i} {...o} />;
          case "cone":
            return <Cone key={i} {...o} />;
          default:
            return null;
        }
      })}
    </>
  );
}

export default function Track() {
  return (
    <group>
      <GroundCollider />
      <GroundVisual />
      <TrackRibbon />
      <Walls />
      <Ramp />
      <Obstacles />
    </group>
  );
}
