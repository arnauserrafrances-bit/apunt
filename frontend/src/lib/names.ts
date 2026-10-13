// Mateixes regles que core/db.py: nom i cognoms obligatoris, sense duplicats,
// codis que no es reutilitzen.
import { STUDENT_CODE_DIGITS, STUDENT_CODE_PREFIX } from "../config";
import type { Student } from "../types";
import { clean, fold } from "./text";

export function formatCode(n: number): string {
  return STUDENT_CODE_PREFIX + String(n).padStart(STUDENT_CODE_DIGITS, "0");
}

export function fullName(s: Pick<Student, "firstName" | "lastName">): string {
  return `${s.firstName} ${s.lastName}`;
}

export function nameKey(firstName: string, lastName: string): string {
  return clean(`${firstName} ${lastName}`).toLocaleLowerCase("ca");
}

/**
 * Converteix una línia en [nom, cognoms].
 *  - "Nom Cognom1 Cognom2"  -> la primera paraula és el nom
 *  - "Cognom1 Cognom2, Nom" -> amb coma, el nom va després (noms compostos)
 * Retorna null si no hi ha com a mínim nom i un cognom.
 */
export function parseNameLine(line: string): [string, string] | null {
  const l = clean(line);
  if (l.includes(",")) {
    const i = l.indexOf(",");
    const last = l.slice(0, i).trim();
    const first = l.slice(i + 1).trim();
    return first && last ? [first, last] : null;
  }
  const words = l.split(" ");
  if (words.length < 2) return null;
  return [words[0], words.slice(1).join(" ")];
}

export interface BulkParseResult {
  valid: [string, string][];
  invalid: string[];
  duplicates: string[];
}

export function parseNameList(text: string, existing: Student[]): BulkParseResult {
  const seen = new Set(existing.map((s) => nameKey(s.firstName, s.lastName)));
  const result: BulkParseResult = { valid: [], invalid: [], duplicates: [] };
  for (const raw of text.split("\n")) {
    const line = clean(raw);
    if (!line) continue;
    const parsed = parseNameLine(line);
    if (!parsed) {
      result.invalid.push(line);
      continue;
    }
    const key = nameKey(...parsed);
    if (seen.has(key)) {
      result.duplicates.push(line);
      continue;
    }
    seen.add(key);
    result.valid.push(parsed);
  }
  return result;
}

/** Cerca per nom, cognoms o codi ("07", "a07", "A-07"), sense accents. */
export function matchesStudent(s: Student, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const digits = q.replace(/^a-?/, "");
  if (/^\d+$/.test(digits)) {
    return Number(s.code.slice(STUDENT_CODE_PREFIX.length)) === Number(digits);
  }
  const name = fold(fullName(s));
  return q.split(/\s+/).every((w) => name.split(" ").some((p) => p.startsWith(w)));
}
