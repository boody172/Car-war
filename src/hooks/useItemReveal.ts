"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import { WEAPON_KINDS } from "@/components/game/weaponMeta";
import { ITEM_REVEAL_TICK_MS } from "@/lib/constants";
import type { WeaponKind } from "@/shared/types";

/**
 * Drives the item-box roulette: while a reveal is spinning this cycles
 * through weapon icons CTR-style; once it lands, it just mirrors the actual
 * held item. `revealing` lets callers style the spin distinctly from a
 * settled, usable item.
 */
export function useItemReveal(): { icon: WeaponKind | null; revealing: boolean } {
  const heldItem = useGameStore((s) => s.heldItem);
  const pendingReveal = useGameStore((s) => s.pendingReveal);
  const [cycleIndex, setCycleIndex] = useState(0);

  useEffect(() => {
    if (!pendingReveal) return;
    const id = setInterval(() => setCycleIndex((i) => i + 1), ITEM_REVEAL_TICK_MS);
    return () => clearInterval(id);
  }, [pendingReveal]);

  if (pendingReveal) {
    return { icon: WEAPON_KINDS[cycleIndex % WEAPON_KINDS.length], revealing: true };
  }
  return { icon: heldItem, revealing: false };
}
