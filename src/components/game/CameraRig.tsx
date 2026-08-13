"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA } from "@/lib/constants";

interface CameraRigProps {
  // @react-three/cannon drives the physics body's Object3D by setting
  // matrixAutoUpdate = false and writing straight into object.matrix each
  // step — it never touches object.position/quaternion, so reading those
  // off the ref (as this used to do) just returns the kart's spawn
  // transform forever. posRef/quatRef are the same live values Kart.tsx
  // already keeps in sync via api.position.subscribe/api.quaternion.subscribe,
  // so the camera tracks what the kart is actually doing.
  posRef: RefObject<THREE.Vector3>;
  quatRef: RefObject<THREE.Quaternion>;
}

export default function CameraRig({ posRef, quatRef }: CameraRigProps) {
  const desiredPos = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  useFrame(({ camera }, rawDelta) => {
    const pos = posRef.current;
    const quat = quatRef.current;
    if (!pos || !quat) return;
    // This is a closed-loop exponential damp toward the target, stable for
    // any dt — unlike Kart.tsx's own physics integration, it doesn't need a
    // tight clamp to stay numerically sound. A large ceiling here only
    // guards against a single absurd frame (e.g. a backgrounded tab).
    const dt = Math.min(rawDelta, 0.5);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const behind = forward.clone().multiplyScalar(-CAMERA.followDistance);

    desiredPos.current.set(
      pos.x + behind.x,
      pos.y + CAMERA.followHeight,
      pos.z + behind.z,
    );
    lookAt.current.set(
      pos.x + forward.x * 2,
      pos.y + CAMERA.lookHeight,
      pos.z + forward.z * 2,
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
