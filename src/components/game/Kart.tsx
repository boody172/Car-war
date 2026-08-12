"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useBox } from "@react-three/cannon";
import * as THREE from "three";
import { nanoid } from "nanoid";
import KartModel, { type KartModelHandle } from "./KartModel";
import CameraRig from "./CameraRig";
import {
  KART,
  STATE_SEND_HZ,
  WALL_HIT_RADIUS,
  STUN_DURATION_MS,
  ITEM_BOX_PICKUP_RADIUS,
} from "@/lib/constants";
import { inputState, consumeItemRequest } from "@/lib/input";
import { useGameStore } from "@/state/gameStore";
import { useHazardStore } from "@/state/hazardStore";
import { RaceProgressTracker, computePlace, findLeader, findNearest } from "@/lib/raceProgress";
import { getConnection } from "@/net/connection";
import { getLatest } from "@/net/snapshotBuffer";
import { useTrack } from "@/hooks/useTrack";
import type { Vec3, WeaponKind } from "@/shared/types";

interface KartProps {
  startPosition: [number, number, number];
  startRotationY: number;
  color: string;
  cameraEnabled: boolean;
}

export default function Kart({ startPosition, startRotationY, color, cameraEnabled }: KartProps) {
  const track = useTrack();
  const modelRef = useRef<KartModelHandle>(null);
  const steerAngleRef = useRef(0);
  const driftChargeRef = useRef(0);
  const driftHeldPrevRef = useRef(false);
  const tracker = useRef(new RaceProgressTracker(track));
  const seqRef = useRef(0);
  const lastSendRef = useRef(0);
  const boxCooldowns = useRef(new Map<string, number>());
  const weaponCooldownUntil = useRef(0);

  const posRef = useRef(new THREE.Vector3(...startPosition));
  const quatRef = useRef(new THREE.Quaternion());
  const velRef = useRef(new THREE.Vector3());
  const angVelRef = useRef(new THREE.Vector3());
  // Authoritative horizontal (XZ) velocity, owned entirely by this
  // component rather than read back from the physics worker each frame.
  // The worker's position/quaternion subscriptions have a multi-frame
  // round trip; feeding that lagged readback back into the accel integrator
  // created a fight-with-itself loop that capped speed far below intent.
  // Vertical motion (gravity, ramps) still comes straight from the body.
  const localVel = useRef(new THREE.Vector2(0, 0));

  const [chassisRef, api] = useBox<THREE.Group>(() => ({
    type: "Dynamic",
    mass: KART.mass,
    args: KART.chassisSize,
    position: startPosition,
    rotation: [0, startRotationY, 0],
    angularFactor: [0, 1, 0],
    linearDamping: 0.28,
    angularDamping: KART.angularDamping,
    material: { friction: 0, restitution: 0.2 },
    allowSleep: false,
  }));

  useEffect(() => {
    const unsubP = api.position.subscribe((p) => posRef.current.set(p[0], p[1], p[2]));
    const unsubQ = api.quaternion.subscribe((q) => quatRef.current.set(q[0], q[1], q[2], q[3]));
    const unsubV = api.velocity.subscribe((v) => velRef.current.set(v[0], v[1], v[2]));
    const unsubAV = api.angularVelocity.subscribe((v) => angVelRef.current.set(v[0], v[1], v[2]));
    return () => {
      unsubP();
      unsubQ();
      unsubV();
      unsubAV();
    };
  }, [api]);

  useEffect(() => {
    const onBoxConsumed = (e: Event) => {
      const detail = (e as CustomEvent).detail as { boxId: string; respawnAt: number };
      boxCooldowns.current.set(detail.boxId, detail.respawnAt);
    };
    window.addEventListener("carwar:boxConsumed", onBoxConsumed);
    return () => window.removeEventListener("carwar:boxConsumed", onBoxConsumed);
  }, []);

  const fireWeapon = useMemo(
    () => (kind: WeaponKind) => {
      const conn = getConnection();
      if (!conn) return;
      const now = Date.now();
      if (now < weaponCooldownUntil.current) return;
      weaponCooldownUntil.current = now + 850;

      const selfId = useGameStore.getState().selfId ?? "";
      const pos = posRef.current;
      const quat = quatRef.current;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
      const yaw = Math.atan2(forward.x, forward.z);
      const id = nanoid(8);

      if (kind === "wall") {
        const behind = pos.clone().addScaledVector(forward, -2.6);
        conn.send({ t: "weapon", id, kind, p: [behind.x, 0, behind.z], yaw });
      } else if (kind === "scaffold") {
        const front = pos.clone().addScaledVector(forward, 4.5);
        conn.send({ t: "weapon", id, kind, p: [front.x, 0, front.z], yaw });
      } else if (kind === "ball") {
        const battleMode = useGameStore.getState().mode === "battle";
        const targetId = battleMode ? findNearest(pos, selfId)?.id ?? null : findLeader(selfId);
        if (!targetId) return;
        const snap = getLatest(targetId);
        const targetP: Vec3 = snap ? snap.p : [pos.x, pos.y, pos.z];
        conn.send({ t: "weapon", id, kind, p: [pos.x, pos.y, pos.z], yaw, targetId, targetP });
      } else if (kind === "blueprint") {
        const nearest = findNearest(pos, selfId);
        if (!nearest) return;
        const targetP: [number, number, number] = [
          nearest.position.x,
          nearest.position.y,
          nearest.position.z,
        ];
        conn.send({
          t: "weapon",
          id,
          kind,
          p: [pos.x, pos.y, pos.z],
          yaw,
          targetId: nearest.id,
          targetP,
        });
      }

      useGameStore.getState().setHeldItem(null);
    },
    [],
  );

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const now = Date.now();
    const gameState = useGameStore.getState();
    const effects = gameState.effects;
    const stunned = effects.stunnedUntil > now;
    const boosting = effects.boostUntil > now;

    const pos = posRef.current;
    const quat = quatRef.current;
    const vel = velRef.current;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const forwardFlat = new THREE.Vector3(forward.x, 0, forward.z);
    if (forwardFlat.lengthSq() < 1e-6) forwardFlat.set(0, 0, -1);
    forwardFlat.normalize();

    // Forward/lateral speed decomposed from our own authoritative velocity,
    // not the physics worker's (lagged) readback — see localVel above.
    const forwardSpeed = localVel.current.x * forwardFlat.x + localVel.current.y * forwardFlat.z;

    const driftHeld = inputState.drift && !stunned && Math.abs(forwardSpeed) > KART.driftMinSpeed;
    const rawSteer = stunned ? 0 : inputState.steer;
    const driftMult = driftHeld ? KART.driftSteerMult : 1;
    const targetSteer = rawSteer * KART.steerMax * driftMult;
    steerAngleRef.current = THREE.MathUtils.damp(
      steerAngleRef.current,
      targetSteer,
      KART.steerSpeed,
      dt,
    );

    const speedFactor = Math.min(1, Math.abs(forwardSpeed) / 7);
    const dirSign = forwardSpeed < -0.2 ? -1 : 1;
    const turnRate = -steerAngleRef.current * (2.6 * (0.35 + 0.65 * speedFactor)) * dirSign;
    api.angularVelocity.set(0, turnRate, 0);

    // --- Throttle / brake / reverse ---
    // Driven directly through velocity rather than applyForce/applyImpulse:
    // @react-three/cannon's force/impulse ops silently no-op unless the body
    // type resolves to DYNAMIC through the worker bridge, which proved
    // unreliable across steps; velocity.set is a plain property write and
    // lands every frame, so acceleration is integrated here in JS instead.
    const throttle = stunned ? 0 : inputState.throttle;
    const brake = stunned ? 0 : inputState.brake;
    const power = boosting ? effects.boostPower : KART.engineForce;
    const speedCap = boosting ? KART.maxBoostSpeed : KART.maxSpeed;

    let targetForwardSpeed = forwardSpeed;
    if (throttle > 0) {
      targetForwardSpeed = Math.min(forwardSpeed + power * throttle * dt, speedCap);
    } else if (brake > 0) {
      if (forwardSpeed > 0.4) {
        targetForwardSpeed = Math.max(forwardSpeed - KART.brakeForce * brake * dt, 0);
      } else {
        targetForwardSpeed = Math.max(
          forwardSpeed - KART.reverseForce * brake * dt,
          -KART.maxReverseSpeed,
        );
      }
    } else if (Math.abs(forwardSpeed) > 0.02) {
      const coast = 6.5 * dt;
      targetForwardSpeed =
        forwardSpeed > 0 ? Math.max(0, forwardSpeed - coast) : Math.min(0, forwardSpeed + coast);
    } else {
      targetForwardSpeed = 0;
    }

    // --- Lateral grip / drift ---
    const grip = driftHeld ? KART.gripDrifting : KART.gripGrounded;
    const lateral = new THREE.Vector2(
      localVel.current.x - forwardFlat.x * forwardSpeed,
      localVel.current.y - forwardFlat.z * forwardSpeed,
    );
    const keep = Math.max(0, 1 - grip * dt);
    const newVx = forwardFlat.x * targetForwardSpeed + lateral.x * keep;
    const newVz = forwardFlat.z * targetForwardSpeed + lateral.y * keep;
    localVel.current.set(newVx, newVz);
    api.velocity.set(newVx, vel.y, newVz);

    // --- Drift boost charge/release ---
    if (driftHeld) {
      driftChargeRef.current += dt;
    } else if (driftHeldPrevRef.current) {
      const charge = driftChargeRef.current;
      const tiers = KART.driftBoostTiers;
      let tier = -1;
      for (let i = tiers.length - 1; i >= 0; i--) {
        if (charge >= tiers[i]) {
          tier = i;
          break;
        }
      }
      if (tier >= 0) {
        useGameStore
          .getState()
          .boost(KART.driftBoostDuration[tier] * 1000, KART.driftBoostPower[tier]);
      }
      driftChargeRef.current = 0;
    }
    driftHeldPrevRef.current = driftHeld;

    // --- Race progress ---
    const { lapChanged } = tracker.current.update(pos);
    if (lapChanged || Math.random() < 0.34) {
      const place = computePlace(gameState.selfId ?? "", {
        lap: tracker.current.lap,
        cp: tracker.current.checkpointsPassed,
        dist: tracker.current.dist,
      });
      gameState.updateSelfRace({
        lap: Math.min(tracker.current.lap, track.laps),
        checkpoint: tracker.current.checkpointsPassed,
        place,
        speed: Math.abs(forwardSpeed),
      });
    } else {
      gameState.updateSelfRace({ speed: Math.abs(forwardSpeed) });
    }

    if (
      gameState.mode !== "battle" &&
      !gameState.selfRace.finished &&
      tracker.current.lap > track.laps
    ) {
      const raceStartedAt = gameState.selfRace.raceStartedAt ?? now;
      const timeMs = now - raceStartedAt;
      gameState.updateSelfRace({ finished: true, finishTimeMs: timeMs });
      getConnection()?.send({ t: "finish", timeMs });
    }

    if (gameState.phase === "racing" && !gameState.selfRace.raceStartedAt) {
      gameState.updateSelfRace({ raceStartedAt: gameState.raceStartAt ?? now });
    }

    // --- Item box pickups ---
    if (gameState.phase === "racing" && !gameState.heldItem) {
      for (const box of track.itemBoxes) {
        const cd = boxCooldowns.current.get(box.id) ?? 0;
        if (cd > now) continue;
        const dx = pos.x - box.position[0];
        const dz = pos.z - box.position[2];
        if (dx * dx + dz * dz < ITEM_BOX_PICKUP_RADIUS * ITEM_BOX_PICKUP_RADIUS) {
          boxCooldowns.current.set(box.id, now + 4800);
          getConnection()?.send({ t: "pickup", boxId: box.id });
          break;
        }
      }
    }

    // --- Hazard collisions (self-authoritative) ---
    const hazardState = useHazardStore.getState();
    const selfId = gameState.selfId;
    if (selfId) {
      for (const h of hazardState.hazards) {
        if (h.ownerId === selfId) continue;
        if (h.triggeredBy.includes(selfId)) continue;
        const dx = pos.x - h.position[0];
        const dz = pos.z - h.position[2];
        const distSq = dx * dx + dz * dz;
        if (h.kind === "wall" && distSq < WALL_HIT_RADIUS * WALL_HIT_RADIUS) {
          hazardState.markTriggered(h.id, selfId);
          gameState.stun(STUN_DURATION_MS);
          localVel.current.multiplyScalar(0.15);
          api.velocity.set(localVel.current.x, vel.y, localVel.current.y);
          gameState.pushToast(`Smashed into ${h.ownerName}'s wall!`, "hit");
        }
        if (h.kind === "scaffold" && distSq < 3.2 * 3.2 && !boosting) {
          hazardState.markTriggered(h.id, selfId);
          gameState.boost(KART.scaffoldBoostDuration * 1000, KART.scaffoldBoostPower);
          api.velocity.set(localVel.current.x, vel.y + 3.2, localVel.current.y);
        }
      }
    }

    // --- Item use ---
    if (consumeItemRequest() && gameState.heldItem) {
      fireWeapon(gameState.heldItem);
    }

    // --- Network state broadcast ---
    const sendInterval = 1000 / STATE_SEND_HZ;
    if (now - lastSendRef.current >= sendInterval) {
      lastSendRef.current = now;
      getConnection()?.send({
        t: "state",
        p: [pos.x, pos.y, pos.z],
        q: [quat.x, quat.y, quat.z, quat.w],
        v: [localVel.current.x, vel.y, localVel.current.y],
        steer: steerAngleRef.current,
        throttle,
        lap: tracker.current.lap,
        cp: tracker.current.checkpointsPassed,
        dist: tracker.current.dist,
        place: gameState.selfRace.place,
        seq: seqRef.current++,
        ts: now,
      });
    }

    // --- Visual: front wheel steer ---
    if (modelRef.current?.frontWheels) {
      modelRef.current.frontWheels.rotation.y = steerAngleRef.current * -1;
    }

  });

  return (
    <group ref={chassisRef}>
      <KartModel ref={modelRef} color={color} />
      {cameraEnabled && <CameraRig targetRef={chassisRef} />}
    </group>
  );
}
