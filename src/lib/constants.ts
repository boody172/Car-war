// Tunable arcade-physics and gameplay constants.

export const KART = {
  mass: 165,
  // Full box dimensions [width, height, depth] — matches both the Three.js
  // chassis geometry and the @react-three/cannon `args` (halved internally).
  chassisSize: [1.5, 0.62, 2.5] as [number, number, number],

  engineForce: 15.5,
  reverseForce: 7.5,
  brakeForce: 20,

  maxSpeed: 26,
  maxReverseSpeed: 11,
  maxBoostSpeed: 38,

  steerMax: 0.58,
  steerSpeed: 3.4,
  driftSteerMult: 1.55,

  angularDamping: 0.92,
  gripGrounded: 10.5,
  gripDrifting: 3.2,

  driftMinSpeed: 6,
  driftBoostTiers: [1.4, 2.4, 3.6], // seconds held to reach mini/super/ultra boost
  driftBoostPower: [22, 30, 40], // acceleration (m/s^2) applied while the boost is active
  driftBoostDuration: [0.6, 0.9, 1.3],

  scaffoldBoostPower: 34,
  scaffoldBoostDuration: 1.3,
} as const;

export const WEAPON_DURATION = {
  wall: 14000,
  ball: 1900,
  blueprint: 3200,
  scaffold: 16000,
} as const;

export const WEAPON_COOLDOWN_MS = 850;
export const ITEM_BOX_RESPAWN_MS = 5000;
export const ITEM_BOX_PICKUP_RADIUS = 2.3;

// Manual-aim targeting for the wrecking ball and blueprint blindness: you
// only hit whoever is actually in front of you within this cone and range —
// no auto-lock onto the leader or nearest rival regardless of where you're
// pointed. Missing (nobody in the cone) still fires and still consumes the
// item, same as landing a hit.
export const WEAPON_AIM_HALF_ANGLE_RAD = (28 * Math.PI) / 180;
export const WEAPON_AIM_RANGE = 50;

// How long the item-box reveal spins through weapon icons before landing on
// the granted item — the classic kart-racer "roulette" beat.
export const ITEM_REVEAL_MS = 900;
export const ITEM_REVEAL_TICK_MS = 90;

export const STUN_DURATION_MS = 1150;
export const WALL_HIT_RADIUS = 1.9;
export const BALL_HIT_RADIUS = 2.4;

export const STATE_SEND_HZ = 18;
export const INTERP_DELAY_MS = 120; // playback buffer delay for remote karts
export const SNAPSHOT_BUFFER_MAX = 40;

export const CAMERA = {
  followDistance: 7.2,
  followHeight: 3.1,
  lookHeight: 1.0,
  stiffness: 4.5,
  fov: 68,
};

export const COUNTDOWN_MS = 3400;
export const BATTLE_DURATION_MS = 120000;

// How long a player's seat is held after an unintentional disconnect (network
// blip, tab reload, backgrounded phone) before they're actually removed from
// the room. An explicit "Leave" always removes immediately, regardless of
// this window.
export const DISCONNECT_GRACE_MS = 45000;
