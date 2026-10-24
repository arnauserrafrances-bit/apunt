import type { Id } from "../types";

/**
 * UUID v4. No fem servir crypto.randomUUID() perquè només existeix en contextos segurs
 * (HTTPS o localhost) i falla en provar l'app des del mòbil amb http://192.168.x.x.
 */
export function newId(): Id {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
