"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useTrack } from "@/hooks/useTrack";

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
        <ItemBoxVisual
          key={box.id}
          position={box.position}
          respawnAt={respawns[box.id] ?? 0}
        />
      ))}
    </group>
  );
}

function ItemBoxVisual({
  position,
  respawnAt,
}: {
  position: [number, number, number];
  respawnAt: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const hidden = Date.now() < respawnAt;
    groupRef.current.visible = !hidden;
    groupRef.current.rotation.y = t * 1.2;
    if (!hidden) groupRef.current.position.y = position[1] + Math.sin(t * 2) * 0.15;
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.1, 1.1, 1.1]} />
        <meshStandardMaterial
          color="#ffd23c"
          emissive="#ffb020"
          emissiveIntensity={0.5}
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[1.22, 0.12, 1.22]} />
        <meshStandardMaterial color="#2b2f36" />
      </mesh>
      <pointLight color="#ffd23c" intensity={4} distance={4} />
    </group>
  );
}
