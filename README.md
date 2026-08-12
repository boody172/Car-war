# Car War 🏗️🏎️

A real-time multiplayer 3D kart racer built with **Next.js**, **React Three Fiber**, and **PartyKit** — with a construction & demolition twist instead of traditional weapons.

Race 2–6 players around the **Skyline Loop** on desktop or mobile, smash item crates, and take each other out with a **Concrete Wall**, a homing **Wrecking Ball**, **Blueprint Blindness**, or a **Speed Scaffold** boost pad.

## Tech stack

- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS 4
- **3D:** React Three Fiber + drei, Three.js
- **Physics:** @react-three/cannon (cannon-es), driven with a hand-tuned arcade velocity model
- **Multiplayer:** [PartyKit](https://www.partykit.io/) — a WebSocket room server that deploys independently of Vercel's serverless functions, so connections never hit a serverless timeout
- **State:** Zustand for reactive UI state, plus non-reactive per-frame buffers for network position data (kept out of React state so 60fps rendering never triggers React re-renders)

## Project layout

```
src/
  app/                 Next.js routes (home, /room/[id])
  components/
    game/              3D scene: track, karts, hazards, HUD, lobby, results
    controls/           Touch joystick + buttons for mobile
  hooks/               Keyboard input + touch-device detection
  lib/                 Track geometry/curve, physics tuning constants, race progress
  net/                 PartySocket connection wrapper + interpolation buffer
  shared/              Wire protocol types shared with the PartyKit server
  state/               Zustand stores (game/lobby state, active hazards)
party/
  room.ts              PartyKit room server: lobby, race lifecycle, relay netcode
```

## How the multiplayer netcode works

- Each client **fully simulates its own kart locally** (client-side prediction) — your own driving never waits on the network.
- Position/rotation/velocity snapshots are broadcast ~18×/second and **buffered per remote player**; other karts are rendered from an **interpolated (slightly delayed) playback** of that buffer, with short extrapolation if a peer's updates stall. This is what keeps the game smooth even when someone's connection is choppy — a laggy player's kart just glides on its last known trajectory for a moment instead of the game breaking.
- The PartyKit server is a **thin relay + lobby/race-lifecycle authority**: it tracks room membership, ready state, race start/finish, and grants item-box pickups fairly, but never runs physics itself — so there's no server tick to fall behind and no reason to ever kick a slow client. Reconnection is handled automatically by `partysocket` with exponential backoff.
- Because PartyKit rooms run on Cloudflare's edge (not a Vercel serverless function), the WebSocket connection is long-lived and never subject to a serverless execution timeout.

## Local development

Requires Node 20+.

```bash
npm install

# Run both the Next.js app and the PartyKit room server together:
npm run dev:all

# ...or in two terminals:
npm run dev         # Next.js on http://localhost:3000
npm run party:dev    # PartyKit room server on ws://localhost:1999
```

Copy `.env.example` to `.env.local` (already defaults to `localhost:1999`, so this is only needed if you change the PartyKit port):

```bash
cp .env.example .env.local
```

Open two browser windows at `http://localhost:3000` to test multiplayer locally — create a room in one, copy the invite link into the other.

## Controls

- **Desktop:** Arrow keys / WASD to drive, Space or Shift to drift, `E` / Enter to use your held item.
- **Mobile / touch:** on-screen joystick (steering) bottom-left, Gas/Brake/Drift buttons bottom-right, item button top-right. Touch controls appear automatically on touch-capable devices.

## Deploying

### 1. Deploy the PartyKit server

```bash
npx partykit login
npm run party:deploy
```

This prints a URL like `car-war.<your-partykit-username>.partykit.dev`. Copy the host (no `https://`/`wss://` prefix).

### 2. Deploy the Next.js app to Vercel

Push this repo to GitHub, then import it in [Vercel](https://vercel.com/new), or deploy from the CLI:

```bash
npx vercel
```

Set the environment variable in your Vercel project settings:

```
NEXT_PUBLIC_PARTYKIT_HOST=car-war.<your-partykit-username>.partykit.dev
```

(Set it for Production, Preview, and Development environments, then redeploy.)

That's it — the Next.js app and the PartyKit room server are two independently-deployed pieces that talk to each other over WebSockets; neither depends on the other's deploy process.

## Gameplay notes

- 3 laps around the **Skyline Loop**, checkpoints validated in order (no shortcut-cheesing).
- Drift and hold to charge a mini/super/ultra boost — release to fire it.
- Item boxes grant one random weapon at a time (Concrete Wall, Wrecking Ball, Blueprint Blindness, or Speed Scaffold); you can't hold a second one until you use or lose the first.
- The Wrecking Ball always homes in on whoever is currently in 1st place.
- If a player falls behind after the leader finishes, the race concludes automatically ~22s after the first finisher so one AFK racer can never stall everyone else — stragglers are marked DNF, not kicked.
