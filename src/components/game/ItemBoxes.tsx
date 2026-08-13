"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTrack } from "@/hooks/useTrack";

// Local-space lateral offsets for the 3-box cluster rendered at each pickup
// point (CTR/Mario-Kart style: a row of boxes across the track rather than a
// single crate), so grabbing one feels eventful and other racers still have
// a shot at the same spot without physically fighting over one box.
const CLUSTER_OFFSETS = [-1.35, 0, 1.35];

export default function ItemBoxes() {
  const track = useTrack();
  const [respawns, setRespawns] = useState<Record<string, number>>({});

  useEffect(() => {
    const onConsumed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { boxId: string; respawnAt: number };
      setRespawns((prev) => ({ ...prev, [detail.boxId]: detail.respawnAt }));
    };
    window.addEventListener("carwar:boxConsumed", onConsumed);
    return () => window.removeEventListener("carwar:boxConsumed", onConsumed);
  }, []);

  return (
    <group>
      {track.itemBoxes.map((box) => (
        <ItemBoxCluster
          key={box.id}
          position={box.position}
          rotationY={box.rotationY}
          respawnAt={respawns[box.id] ?? 0}
        />
      ))}
    </group>
  );
}

function ItemBoxCluster({
  position,
  rotationY,
  respawnAt,
}: {
  position: [number, number, number];
  rotationY: number;
  respawnAt: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = Date.now() >= respawnAt;
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      {CLUSTER_OFFSETS.map((offset, i) => (
        <ItemBoxCrate key={i} localX={offset} phase={i * 0.6} />
      ))}
    </group>
  );
}

function ItemBoxCrate({ localX, phase }: { localX: number; phase: number }) {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = Math.sin(t * 2 + phase) * 0.15;
    meshRef.current.rotation.y = -t * 1.2 + phase;
  });

  return (
    <group position={[localX, 0, 0]}>
      <group ref={meshRef}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.9, 0.9]} />
          <meshStandardMaterial
            color="#ffd23c"
            emissive="#ffb020"
            emissiveIntensity={0.5}
            roughness={0.35}
            metalness={0.4}
          />
        </mesh>
      </group>
      <mesh>
        <boxGeometry args={[1, 0.12, 1]} />
        <meshStandardMaterial color="#2b2f36" />
      </mesh>
      <pointLight color="#ffd23c" intensity={2.4} distance={3.2} />
    </group>
  );
}
