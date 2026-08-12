"use client";

import { useEffect, useState } from "react";
import { inputState } from "@/lib/input";

const LEFT_KEYS = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const THROTTLE_KEYS = new Set(["ArrowUp", "KeyW"]);
const BRAKE_KEYS = new Set(["ArrowDown", "KeyS"]);
const DRIFT_KEYS = new Set(["Space", "ShiftLeft", "ShiftRight"]);
const ITEM_KEYS = new Set(["KeyE", "Enter", "ControlLeft"]);

export function useKeyboardControls(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const pressed = new Set<string>();

    const recompute = () => {
      const left = [...LEFT_KEYS].some((k) => pressed.has(k));
      const right = [...RIGHT_KEYS].some((k) => pressed.has(k));
      inputState.steer = (right ? 1 : 0) - (left ? 1 : 0);
      inputState.throttle = [...THROTTLE_KEYS].some((k) => pressed.has(k)) ? 1 : 0;
      inputState.brake = [...BRAKE_KEYS].some((k) => pressed.has(k)) ? 1 : 0;
      inputState.drift = [...DRIFT_KEYS].some((k) => pressed.has(k));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        LEFT_KEYS.has(e.code) ||
        RIGHT_KEYS.has(e.code) ||
        THROTTLE_KEYS.has(e.code) ||
        BRAKE_KEYS.has(e.code) ||
        DRIFT_KEYS.has(e.code) ||
        ITEM_KEYS.has(e.code)
      ) {
        e.preventDefault();
      }
      if (!pressed.has(e.code)) {
        pressed.add(e.code);
        if (ITEM_KEYS.has(e.code)) inputState.itemRequested = true;
        recompute();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      pressed.delete(e.code);
      recompute();
    };
    const onBlur = () => {
      pressed.clear();
      recompute();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      recompute();
    };
  }, [enabled]);
}

export function useIsTouchDevice(): boolean {
  // Read post-mount so server and first client render agree (no `window`
  // during SSR); touch controls pop in a frame later on real touch devices.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const isTouch =
      "ontouchstart" in window ||
      (navigator.maxTouchPoints ?? 0) > 0 ||
      window.matchMedia?.("(pointer: coarse)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTouch(isTouch);
  }, []);
  return touch;
}
