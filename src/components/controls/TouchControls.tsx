"use client";

import { useCallback, useRef, useState } from "react";
import { inputState } from "@/lib/input";
import { useItemReveal } from "@/hooks/useItemReveal";
import { WEAPON_ICON, WEAPON_LABEL } from "@/components/game/weaponMeta";

const STICK_RADIUS = 52;

export default function TouchControls() {
  const { icon: itemIcon, revealing } = useItemReveal();
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
  const [gasActive, setGasActive] = useState(false);
  const [brakeActive, setBrakeActive] = useState(false);
  const [driftActive, setDriftActive] = useState(false);
  const stickTouchId = useRef<number | null>(null);
  const stickOrigin = useRef({ x: 0, y: 0 });

  const updateStick = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - stickOrigin.current.x;
    const dy = clientY - stickOrigin.current.y;
    const dist = Math.min(Math.hypot(dx, dy), STICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    setStickPos({ x, y });
    inputState.steer = Math.max(-1, Math.min(1, x / STICK_RADIUS));
  }, []);

  const onStickStart = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      stickTouchId.current = e.pointerId;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      stickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      updateStick(e.clientX, e.clientY);
    },
    [updateStick],
  );

  const onStickMove = useCallback(
    (e: React.PointerEvent) => {
      if (stickTouchId.current !== e.pointerId) return;
      updateStick(e.clientX, e.clientY);
    },
    [updateStick],
  );

  const onStickEnd = useCallback((e: React.PointerEvent) => {
    if (stickTouchId.current !== e.pointerId) return;
    stickTouchId.current = null;
    setStickPos({ x: 0, y: 0 });
    inputState.steer = 0;
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-30 select-none touch-none">
      {/* Steering joystick */}
      <div
        className="pointer-events-auto absolute bottom-6 left-6 h-32 w-32 rounded-full border-2 border-white/25 bg-black/25 backdrop-blur-sm active:border-white/40"
        style={{ touchAction: "none" }}
        onPointerDown={onStickStart}
        onPointerMove={onStickMove}
        onPointerUp={onStickEnd}
        onPointerCancel={onStickEnd}
      >
        <div
          className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/90 shadow-lg shadow-black/40"
          style={{ transform: `translate(calc(-50% + ${stickPos.x}px), calc(-50% + ${stickPos.y}px))` }}
        />
      </div>

      {/* Item button */}
      <button
        className={`pointer-events-auto absolute right-6 top-[max(1.25rem,env(safe-area-inset-top))] flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 text-2xl backdrop-blur-sm active:scale-95 disabled:opacity-30 ${
          revealing ? "border-sky-300/80 bg-sky-500/20" : "border-white/25 bg-black/35"
        }`}
        style={{ touchAction: "none" }}
        disabled={revealing || !itemIcon}
        onPointerDown={(e) => {
          e.preventDefault();
          inputState.itemRequested = true;
        }}
      >
        <span className={revealing ? "animate-spin" : undefined}>
          {itemIcon ? WEAPON_ICON[itemIcon] : "▢"}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-white/70">
          {revealing ? "..." : itemIcon ? WEAPON_LABEL[itemIcon] : "empty"}
        </span>
      </button>

      {/* Drift / brake / gas cluster */}
      <div className="pointer-events-auto absolute bottom-5 right-5 flex items-end gap-3">
        <button
          className={`h-14 w-14 rounded-full border-2 text-xs font-bold uppercase text-white backdrop-blur-sm active:scale-95 ${
            driftActive ? "border-sky-300 bg-sky-500/60" : "border-white/25 bg-black/30"
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.preventDefault();
            setDriftActive(true);
            inputState.drift = true;
          }}
          onPointerUp={() => {
            setDriftActive(false);
            inputState.drift = false;
          }}
          onPointerCancel={() => {
            setDriftActive(false);
            inputState.drift = false;
          }}
        >
          Drift
        </button>

        <div className="flex flex-col gap-2">
          <button
            className={`h-16 w-16 rounded-full border-2 text-sm font-bold uppercase text-white backdrop-blur-sm active:scale-95 ${
              gasActive ? "border-emerald-300 bg-emerald-500/70" : "border-white/25 bg-black/30"
            }`}
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.preventDefault();
              setGasActive(true);
              inputState.throttle = 1;
            }}
            onPointerUp={() => {
              setGasActive(false);
              inputState.throttle = 0;
            }}
            onPointerCancel={() => {
              setGasActive(false);
              inputState.throttle = 0;
            }}
          >
            Gas
          </button>
          <button
            className={`h-11 w-16 rounded-2xl border-2 text-[10px] font-bold uppercase text-white backdrop-blur-sm active:scale-95 ${
              brakeActive ? "border-red-300 bg-red-500/70" : "border-white/25 bg-black/30"
            }`}
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.preventDefault();
              setBrakeActive(true);
              inputState.brake = 1;
            }}
            onPointerUp={() => {
              setBrakeActive(false);
              inputState.brake = 0;
            }}
            onPointerCancel={() => {
              setBrakeActive(false);
              inputState.brake = 0;
            }}
          >
            Brake
          </button>
        </div>
      </div>
    </div>
  );
}
