"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

export interface KartModelHandle {
  frontWheels: THREE.Group | null;
}

interface KartModelProps {
  color: string;
  name?: string;
  showLabel?: boolean;
  stunned?: boolean;
  boosting?: boolean;
}

const KartModel = forwardRef<KartModelHandle, KartModelProps>(function KartModel(
  { color, name, showLabel, stunned, boosting },
  ref,
) {
  const frontWheelsRef = useRef<THREE.Group>(null);

  useImperativeHandle(ref, () => ({
    get frontWheels() {
      return frontWheelsRef.current;
    },
  }));

  const wheelMat = { color: "#1c1c20", roughness: 0.9, metalness: 0.1 };

  return (
    <group>
      {showLabel && name && (
        <Html position={[0, 1.55, 0]} center distanceFactor={12} occlude={false} zIndexRange={[0, 0]}>
          <div className="whitespace-nowrap rounded-md bg-black/50 px-2 py-0.5 font-mono text-xs font-bold text-white shadow-md">
            {name}
          </div>
        </Html>
      )}

      {/* Chassis */}
      <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[1.5, 0.5, 2.5]} />
        <meshStandardMaterial
          color={stunned ? "#555" : color}
          roughness={0.4}
          metalness={0.35}
          emissive={boosting ? new THREE.Color(color) : undefined}
          emissiveIntensity={boosting ? 0.55 : 0}
        />
      </mesh>

      {/* Nose taper */}
      <mesh castShadow position={[0, 0.34, -1.35]}>
        <boxGeometry args={[1.1, 0.36, 0.5]} />
        <meshStandardMaterial color={stunned ? "#555" : color} roughness={0.4} metalness={0.35} />
      </mesh>

      {/* Cabin / roll cage */}
      <mesh castShadow position={[0, 0.72, 0.15]}>
        <boxGeometry args={[0.95, 0.42, 1.1]} />
        <meshStandardMaterial color="#20242c" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Hard-hat marker */}
      <mesh position={[0, 1.05, 0.15]} castShadow>
        <coneGeometry args={[0.26, 0.28, 12]} />
        <meshStandardMaterial color="#ffd23c" roughness={0.5} />
      </mesh>

      {/* Spoiler */}
      <mesh position={[0, 0.66, 1.28]} castShadow>
        <boxGeometry args={[1.3, 0.08, 0.22]} />
        <meshStandardMaterial color="#111318" roughness={0.5} />
      </mesh>
      <mesh position={[-0.55, 0.5, 1.22]}>
        <boxGeometry args={[0.08, 0.32, 0.08]} />
        <meshStandardMaterial color="#111318" />
      </mesh>
      <mesh position={[0.55, 0.5, 1.22]}>
        <boxGeometry args={[0.08, 0.32, 0.08]} />
        <meshStandardMaterial color="#111318" />
      </mesh>

      {/* Headlights */}
      <mesh position={[-0.42, 0.35, -1.58]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff7d6" emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0.42, 0.35, -1.58]}>
        <boxGeometry args={[0.22, 0.14, 0.05]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff7d6" emissiveIntensity={1.4} />
      </mesh>

      {/* Wheels */}
      <group ref={frontWheelsRef}>
        <mesh castShadow position={[-0.82, 0.32, -0.95]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.36, 0.36, 0.3, 16]} />
          <meshStandardMaterial {...wheelMat} />
        </mesh>
        <mesh castShadow position={[0.82, 0.32, -0.95]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.36, 0.36, 0.3, 16]} />
          <meshStandardMaterial {...wheelMat} />
        </mesh>
      </group>
      <mesh castShadow position={[-0.82, 0.32, 0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 0.3, 16]} />
        <meshStandardMaterial {...wheelMat} />
      </mesh>
      <mesh castShadow position={[0.82, 0.32, 0.95]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 0.3, 16]} />
        <meshStandardMaterial {...wheelMat} />
      </mesh>
    </group>
  );
});

export default KartModel;
