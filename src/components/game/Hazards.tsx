"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBox } from "@react-three/cannon";
import * as THREE from "three";
import { useHazardStore, type PlacedHazard, type ProjectileVisual } from "@/state/hazardStore";

function ConcreteWall({ hazard }: { hazard: PlacedHazard }) {
  const [ref] = useBox(() => ({
    type: "Static",
    args: [4.2, 1.5, 0.7],
    position: [hazard.position[0], 0.75, hazard.position[2]],
    rotation: [0, hazard.rotationY, 0],
    material: { friction: 0.4, restitution: 0.2 },
  }));
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame(() => {
    const now = Date.now();
    const timeLeft = Math.max(0, hazard.expiresAt - now);
    const fading = timeLeft < 2000;
    const opacity = fading ? 0.4 + 0.4 * Math.sin(now / 90) : 1;
    for (const mat of matRefs.current) {
      if (mat) mat.opacity = opacity;
    }
  });

  return (
    <group ref={ref as never}>
      {[-1.4, 0, 1.4].map((x, i) => (
        <mesh key={x} castShadow receiveShadow position={[x, 0, 0]}>
          <boxGeometry args={[1.3, 1.5, 0.6]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) matRefs.current[i] = m;
            }}
            color="#a9926f"
            roughness={0.85}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function SpeedScaffold({ hazard }: { hazard: PlacedHazard }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 4) * 0.05;
    }
  });
  return (
    <group position={hazard.position} rotation={[0, hazard.rotationY, 0]}>
      <group ref={groupRef}>
        <mesh castShadow receiveShadow position={[0, 0.15, 0]}>
          <boxGeometry args={[4, 0.3, 3]} />
          <meshStandardMaterial
            color="#ffd23c"
            emissive="#ff9c1a"
            emissiveIntensity={0.6}
            roughness={0.3}
            metalness={0.5}
          />
        </mesh>
        {[-1.7, 1.7].map((x) => (
          <mesh key={x} position={[x, 0.9, -1.4]}>
            <boxGeometry args={[0.15, 1.6, 0.15]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function BallProjectile({ p }: { p: ProjectileVisual }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min(1, (Date.now() - p.spawnedAt) / p.durationMs);
    const x = THREE.MathUtils.lerp(p.from[0], p.to[0], t);
    const z = THREE.MathUtils.lerp(p.from[2], p.to[2], t);
    const arc = Math.sin(t * Math.PI) * 4.5;
    ref.current.position.set(x, 1.4 + arc, z);
    ref.current.rotation.x += 0.25;
    ref.current.rotation.z += 0.18;
  });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshStandardMaterial color="#4a4e57" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.66, 8, 8]} />
        <meshBasicMaterial color="#ff5a3c" wireframe transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function BlueprintProjectile({ p }: { p: ProjectileVisual }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min(1, (Date.now() - p.spawnedAt) / p.durationMs);
    const x = THREE.MathUtils.lerp(p.from[0], p.to[0], t);
    const z = THREE.MathUtils.lerp(p.from[2], p.to[2], t);
    ref.current.position.set(x, 1.1, z);
    ref.current.rotation.y += 0.4;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[1.1, 1.1]} />
      <meshStandardMaterial color="#3ca7ff" emissive="#3ca7ff" emissiveIntensity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default function Hazards() {
  const hazards = useHazardStore((s) => s.hazards);
  const projectiles = useHazardStore((s) => s.projectiles);
  const sweep = useHazardStore((s) => s.sweep);

  useEffect(() => {
    const id = setInterval(() => sweep(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sweep]);

  return (
    <group>
      {hazards.map((h) =>
        h.kind === "wall" ? (
          <ConcreteWall key={h.id} hazard={h} />
        ) : (
          <SpeedScaffold key={h.id} hazard={h} />
        ),
      )}
      {projectiles.map((p) =>
        p.kind === "ball" ? (
          <BallProjectile key={p.id} p={p} />
        ) : (
          <BlueprintProjectile key={p.id} p={p} />
        ),
      )}
    </group>
  );
}
