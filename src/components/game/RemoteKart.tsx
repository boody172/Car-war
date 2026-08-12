"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBox } from "@react-three/cannon";
import * as THREE from "three";
import KartModel, { type KartModelHandle } from "./KartModel";
import { KART } from "@/lib/constants";
import { getInterpolated } from "@/net/snapshotBuffer";

interface RemoteKartProps {
  playerId: string;
  name: string;
  color: string;
  startPosition: [number, number, number];
  startRotationY: number;
}

export default function RemoteKart({
  playerId,
  name,
  color,
  startPosition,
  startRotationY,
}: RemoteKartProps) {
  const modelRef = useRef<KartModelHandle>(null);
  const lastSteer = useRef(0);

  const [kinematicRef, api] = useBox<THREE.Group>(() => ({
    type: "Kinematic",
    args: KART.chassisSize,
    position: startPosition,
    rotation: [0, startRotationY, 0],
    angularFactor: [0, 1, 0],
  }));

  useFrame(() => {
    const pose = getInterpolated(playerId, Date.now());
    if (!pose) return;
    api.position.set(pose.p[0], pose.p[1], pose.p[2]);
    api.quaternion.set(pose.q[0], pose.q[1], pose.q[2], pose.q[3]);
    lastSteer.current = pose.steer;
    if (modelRef.current?.frontWheels) {
      modelRef.current.frontWheels.rotation.y = pose.steer * -1;
    }
  });

  return (
    <group ref={kinematicRef}>
      <KartModel ref={modelRef} color={color} name={name} showLabel />
    </group>
  );
}
