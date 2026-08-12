import { create } from "zustand";
import type { Vec3, WeaponKind } from "@/shared/types";
import { WEAPON_DURATION } from "@/lib/constants";

export interface PlacedHazard {
  id: string;
  kind: "wall" | "scaffold";
  ownerId: string;
  ownerName: string;
  position: Vec3;
  rotationY: number;
  spawnedAt: number;
  expiresAt: number;
  /** Kart ids that already triggered this hazard once (wall: crash, scaffold: local cooldown). */
  triggeredBy: string[];
}

export interface ProjectileVisual {
  id: string;
  kind: "ball" | "blueprint";
  ownerId: string;
  ownerName: string;
  targetId: string;
  from: Vec3;
  to: Vec3;
  spawnedAt: number;
  durationMs: number;
}

interface HazardState {
  hazards: PlacedHazard[];
  projectiles: ProjectileVisual[];
  spawnHazard: (h: PlacedHazard) => void;
  markTriggered: (id: string, byId: string) => void;
  spawnProjectile: (p: ProjectileVisual) => void;
  sweep: (now: number) => void;
  reset: () => void;
}

export const useHazardStore = create<HazardState>((set) => ({
  hazards: [],
  projectiles: [],

  spawnHazard: (h) => set((s) => ({ hazards: [...s.hazards, h] })),

  markTriggered: (id, byId) =>
    set((s) => ({
      hazards: s.hazards.map((h) =>
        h.id === id && !h.triggeredBy.includes(byId)
          ? { ...h, triggeredBy: [...h.triggeredBy, byId] }
          : h,
      ),
    })),

  spawnProjectile: (p) => set((s) => ({ projectiles: [...s.projectiles, p] })),

  sweep: (now) =>
    set((s) => ({
      hazards: s.hazards.filter((h) => h.expiresAt > now),
      projectiles: s.projectiles.filter(
        (p) => p.spawnedAt + p.durationMs + 400 > now,
      ),
    })),

  reset: () => set({ hazards: [], projectiles: [] }),
}));

export function hazardExpiryFor(kind: WeaponKind, now: number): number {
  return now + WEAPON_DURATION[kind];
}
