"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA } from "@/lib/constants";

interface CameraRigProps {
  targetRef: RefObject<THREE.Object3D | null>;
}

export default function CameraRig({ targetRef }: CameraRigProps) {
  const desiredPos = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame(({ camera }, rawDelta) => {
    const target = targetRef.current;
    if (!target) return;
    const dt = Math.min(rawDelta, 1 / 30);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(target.quaternion);
    const behind = forward.clone().multiplyScalar(-CAMERA.followDistance);

    desiredPos.current.set(
      target.position.x + behind.x,
      target.position.y + CAMERA.followHeight,
      target.position.z + behind.z,
    );
    lookAt.current.set(
      target.position.x + forward.x * 2,
      target.position.y + CAMERA.lookHeight,
      target.position.z + forward.z * 2,
    );

    if (!initialized.current) {
      camera.position.copy(desiredPos.current);
      initialized.current = true;
    } else {
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredPos.current.x,
        CAMERA.stiffness,
        dt,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredPos.current.y,
        CAMERA.stiffness,
        dt,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredPos.current.z,
        CAMERA.stiffness,
        dt,
      );
    }
    camera.lookAt(lookAt.current);
  });

  return null;
}
