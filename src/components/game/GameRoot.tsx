"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import Track from "./Track";
import ItemBoxes from "./ItemBoxes";
import Hazards from "./Hazards";
import Kart from "./Kart";
import RemoteKart from "./RemoteKart";
import { useGameStore } from "@/state/gameStore";
import { useTrack } from "@/hooks/useTrack";
import { CAMERA } from "@/lib/constants";
import { useKeyboardControls, useIsTouchDevice } from "@/hooks/useKeyboardControls";
import TouchControls from "@/components/controls/TouchControls";

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#bcd7ff", "#3c6b3f", 0.65]} />
      <directionalLight
        position={[60, 90, 40]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-far={260}
      />
      <ambientLight intensity={0.28} />
    </>
  );
}

function Racers() {
  const track = useTrack();
  const players = useGameStore((s) => s.players);
  const selfId = useGameStore((s) => s.selfId);
  const startOrder = useGameStore((s) => s.startOrder);

  const order = startOrder.length > 0 ? startOrder : Object.keys(players);

  return (
    <>
      {order.map((id, index) => {
        const player = players[id];
        if (!player) return null;
        const { position, rotationY } = track.getStartTransform(index);
        if (id === selfId) {
          return (
            <Kart
              key={id}
              startPosition={position}
              startRotationY={rotationY}
              color={player.color}
              cameraEnabled
            />
          );
        }
        return (
          <RemoteKart
            key={id}
            playerId={id}
            name={player.name}
            color={player.color}
            startPosition={position}
            startRotationY={rotationY}
          />
        );
      })}
    </>
  );
}

export default function GameRoot() {
  const track = useTrack();
  const isTouch = useIsTouchDevice();
  useKeyboardControls(!isTouch);

  const dpr = useMemo<[number, number]>(() => [1, 1.75], []);
  const sky = track.theme.sky;

  return (
    <div className="fixed inset-0" style={{ backgroundColor: sky }}>
      <Canvas
        shadows
        dpr={dpr}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ fov: CAMERA.fov, near: 0.1, far: 500, position: [0, 6, 12] }}
      >
        <color attach="background" args={[sky]} />
        <fog attach="fog" args={[sky, 90, 260]} />
        <Lighting />
        <Suspense fallback={null}>
          <Physics
            gravity={[0, -22, 0]}
            broadphase="SAP"
            // Kart traction/grip is fully hand-modeled in Kart.tsx via direct
            // velocity control; leaving cannon's own contact friction at its
            // default fights that every step and caps speed far below the
            // velocity we explicitly set, so it's zeroed out here. Bounce off
            // walls/obstacles still comes through via restitution.
            defaultContactMaterial={{ friction: 0, restitution: 0.2 }}
            allowSleep={false}
          >
            <Track />
            <ItemBoxes />
            <Hazards />
            <Racers />
          </Physics>
        </Suspense>
      </Canvas>
      {isTouch && <TouchControls />}
    </div>
  );
}
