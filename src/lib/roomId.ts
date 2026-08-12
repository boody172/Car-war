import { customAlphabet } from "nanoid";

// No ambiguous characters (0/O, 1/I/L) — easy to read aloud and type from a
// shared link.
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const generateRoomId = customAlphabet(alphabet, 6);

export function isValidRoomId(id: string): boolean {
  return /^[a-zA-Z0-9]{3,32}$/.test(id);
}
