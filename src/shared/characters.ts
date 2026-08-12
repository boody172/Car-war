// Original driver roster — six construction-crew mascots, one per player
// color slot. Deliberately not a licensed likeness of anything: distinct
// names, roles, and a construction/demolition flavor matching the rest of
// Car War's identity.

import { PLAYER_COLORS } from "./types";

export interface CharacterDef {
  id: string;
  name: string;
  role: string;
  tagline: string;
  color: (typeof PLAYER_COLORS)[number];
  icon: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "blaze",
    name: "Blaze",
    role: "Demolition Foreman",
    tagline: "Clears the road the fast way.",
    color: PLAYER_COLORS[0],
    icon: "\u{1F9EF}", // fire extinguisher-ish / safety
  },
  {
    id: "nova",
    name: "Nova",
    role: "Site Engineer",
    tagline: "Plans the perfect line, then breaks it.",
    color: PLAYER_COLORS[1],
    icon: "\u{1F477}", // construction worker
  },
  {
    id: "ricochet",
    name: "Ricochet",
    role: "Crane Operator",
    tagline: "Never met a shortcut she didn't swing on.",
    color: PLAYER_COLORS[2],
    icon: "\u{1F3D7}️", // building construction
  },
  {
    id: "turf",
    name: "Turf",
    role: "Landscaper",
    tagline: "Cool, steady, and always first to the dirt.",
    color: PLAYER_COLORS[3],
    icon: "\u{1F33F}", // herb/turf
  },
  {
    id: "vex",
    name: "Vex",
    role: "Site Surveyor",
    tagline: "Measures twice, wrecks once.",
    color: PLAYER_COLORS[4],
    icon: "\u{1F4D0}", // triangular ruler
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "Junior Drafter",
    tagline: "New to the crew. Fastest reflexes on site.",
    color: PLAYER_COLORS[5],
    icon: "\u{1F4D0}\u{FE0F}", // fallback reuse below overridden
  },
];

// Fix Pixel's icon (drafting compass reads better than a duplicated ruler).
CHARACTERS[5].icon = "\u{1F4D0}";
CHARACTERS[5].icon = "\u{270F}️";

export function getCharacter(id: string | null | undefined): CharacterDef | null {
  if (!id) return null;
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

export function unclaimedCharacter(takenIds: Iterable<string>): CharacterDef {
  const taken = new Set(takenIds);
  return CHARACTERS.find((c) => !taken.has(c.id)) ?? CHARACTERS[0];
}
