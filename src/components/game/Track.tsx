"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { usePlane, useBox, useCylinder } from "@react-three/cannon";
import { useTrack } from "@/hooks/useTrack";
import type { ObstacleDef, TrackData } from "@/lib/tracks/build";

function GroundCollider() {
  usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    material: { friction: 0, restitution: 0.05 },
  }));
  return null;
}

function GroundVisual({ track }: { track: TrackData }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[track.groundSize, track.groundSize]} />
      <meshStandardMaterial color={track.theme.ground} roughness={0.95} />
    </mesh>
  );
}

function TrackRibbon({ track }: { track: TrackData }) {
  const geometry = useMemo(() => {
    const { positions, uvs, indices } = track.buildRibbonGeometry();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt only when the track id changes
  }, [track.id]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={track.theme.asphalt} roughness={0.92} metalness={0.02} />
    </mesh>
  );
}

interface WallSegmentProps {
  position: [number, number, number];
  rotationY: number;
  length: number;
  thickness: number;
  height: number;
  wallColor: string;
  curbColor: string;
}

function WallSegment({
  position,
  rotationY,
  length,
  thickness,
  height,
  wallColor,
  curbColor,
}: WallSegmentProps) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [thickness, height, length],
    position,
    rotation: [0, rotationY, 0],
    material: { friction: 0.2, restitution: 0.35 },
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[thickness, height, length]} />
        <meshStandardMaterial color={wallColor} roughness={0.75} />
      </mesh>
      <mesh position={[0, height / 2 + 0.03, 0]}>
        <boxGeometry args={[thickness + 0.05, 0.06, length]} />
        <meshStandardMaterial color={curbColor} roughness={0.5} />
      </mesh>
    </group>
  );
}

function Walls({ track }: { track: TrackData }) {
  return (
    <>
      {track.outerWalls.map((w, i) => (
        <WallSegment
          key={`out-${i}`}
          position={w.position}
          rotationY={w.rotationY}
          length={w.length}
          thickness={track.wallThickness}
          height={track.wallHeight}
          wallColor={track.theme.wall}
          curbColor={i % 2 === 0 ? track.theme.curbA : track.theme.curbB}
        />
      ))}
      {track.innerWalls.map((w, i) => (
        <WallSegment
          key={`in-${i}`}
          position={w.position}
          rotationY={w.rotationY}
          length={w.length}
          thickness={track.wallThickness}
          height={track.wallHeight}
          wallColor={track.theme.wall}
          curbColor={i % 2 === 0 ? track.theme.curbB : track.theme.curbA}
        />
      ))}
    </>
  );
}

function Ramp({ track }: { track: TrackData }) {
  const { ramp } = track;
  const angle = Math.atan2(ramp.height, ramp.length);
  const thickness = 0.9;
  const [ref] = useBox(() => ({
    type: "Static",
    args: [ramp.width, thickness, ramp.length],
    position: [ramp.position[0], ramp.height / 2 - 0.3, ramp.position[2]],
    rotation: [-angle, ramp.rotationY, 0],
    material: { friction: 0.15, restitution: 0.05 },
  }));
  return (
    <group ref={ref as never}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[ramp.width, thickness, ramp.length]} />
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

function Obstacles({ track }: { track: TrackData }) {
  return (
    <>
      {track.obstacles.map((o, i) => {
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
  const track = useTrack();
  return (
    <group key={track.id}>
      <GroundCollider />
      <GroundVisual track={track} />
      <TrackRibbon track={track} />
      <Walls track={track} />
      <Ramp track={track} />
      <Obstacles track={track} />
    </group>
  );
}
