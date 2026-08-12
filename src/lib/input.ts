// Shared, non-reactive input state. Both keyboard and touch controls write
// into this single object; the kart controller reads it once per physics
// tick inside useFrame. Kept outside React state deliberately — steering
// input changes far faster than we'd want to trigger component re-renders.

export interface InputState {
  steer: number; // -1 (left) .. 1 (right)
  throttle: number; // 0..1
  brake: number; // 0..1
  drift: boolean;
  itemRequested: boolean;
}

export const inputState: InputState = {
  steer: 0,
  throttle: 0,
  brake: 0,
  drift: false,
  itemRequested: false,
};

export function resetInput() {
  inputState.steer = 0;
  inputState.throttle = 0;
  inputState.brake = 0;
  inputState.drift = false;
  inputState.itemRequested = false;
}

export function consumeItemRequest(): boolean {
  if (inputState.itemRequested) {
    inputState.itemRequested = false;
    return true;
  }
  return false;
}
