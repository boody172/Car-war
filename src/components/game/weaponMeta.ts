import type { WeaponKind } from "@/shared/types";

export const WEAPON_KINDS: WeaponKind[] = ["wall", "ball", "blueprint", "scaffold"];

export const WEAPON_LABEL: Record<WeaponKind, string> = {
  wall: "Concrete Wall",
  ball: "Wrecking Ball",
  blueprint: "Blueprint Blindness",
  scaffold: "Speed Scaffold",
};

export const WEAPON_ICON: Record<WeaponKind, string> = {
  wall: "\u{1F9F1}", // bricks
  ball: "\u{1F529}", // wrecking-ball-ish (nut/bolt fallback)
  blueprint: "\u{1F4D0}", // triangular ruler
  scaffold: "\u{1FA9C}", // ladder
};

export const WEAPON_COLOR: Record<WeaponKind, string> = {
  wall: "#c98a4b",
  ball: "#5a5f66",
  blueprint: "#3ca7ff",
  scaffold: "#ffd23c",
};
