// Sincronització xifrada. Cada cosa de l'app (un alumne, una nota, un informe, una preferència…) és un
// "registre" amb id propi, xifrat al dispositiu abans de pujar-lo. El servidor només veu ids i text xifrat.
//
// Com es resolen els canvis de dos dispositius (per exemple, notes al mòbil i el model a l'ordinador):
// - Cada registre es compara amb l'última versió sincronitzada (el seu "hash").
// - Si només ha canviat al servidor, es baixa. Si només ha canviat aquí, es puja.
// - Si ha canviat als dos llocs alhora (molt poc habitual), guanya el d'aquest dispositiu.
// - Esborrar és pujar una "làpida" (deleted = true), perquè l'altre dispositiu també l'esborri.
import { emptyState, type AppState } from "../store/repository";
import type { Area, LearningEntry, Note, Preference, Report, Student } from "../types";

export type Items = Map<string, unknown>;

const SETTINGS = ["currentTerm", "nextStudentNumber", "reportGuide", "exampleReport", "learningEnabled"] as const;

export function stateToItems(s: AppState): Items {
  const items: Items = new Map();
  for (const k of SETTINGS) items.set(`set:${k}`, s[k]);
  items.set("set:areaOrder", s.areas.map((a) => a.id));
  for (const st of s.students) items.set(`st:${st.id}`, st);
  for (const a of s.areas) items.set(`ar:${a.id}`, a);
  for (const n of s.notes) items.set(`no:${n.id}`, n);
  for (const [k, r] of Object.entries(s.reports)) items.set(`rp:${k}`, r);
  for (const [k, t] of Object.entries(s.freeTexts)) if (t) items.set(`ft:${k}`, t);
  for (const [k, a] of Object.entries(s.answers)) if (a && Object.keys(a).length) items.set(`an:${k}`, a);
  for (const p of s.preferences) items.set(`pr:${p.id}`, p);
  for (const l of s.learningLog) items.set(`lg:${l.studentId}-${l.term}-${l.generatedAt}`, l);
  return items;
}

function codeNumber(code: string): number {
  const m = /(\d+)\s*$/.exec(code);
  return m ? Number(m[1]) : 0;
}

export function itemsToState(items: Items): AppState {
  const s = emptyState();
  const students: Student[] = [];
  const areas: Area[] = [];
  const notes: Note[] = [];
  const prefs: Preference[] = [];
  const log: LearningEntry[] = [];
  let areaOrder: string[] = [];
  for (const [id, v] of items) {
    const sep = id.indexOf(":");
    const kind = id.slice(0, sep);
    const key = id.slice(sep + 1);
    if (kind === "set") {
      if (key === "areaOrder") areaOrder = Array.isArray(v) ? (v as string[]) : [];
      else if ((SETTINGS as readonly string[]).includes(key)) (s as unknown as Record<string, unknown>)[key] = v;
    } else if (kind === "st") students.push(v as Student);
    else if (kind === "ar") areas.push(v as Area);
    else if (kind === "no") notes.push(v as Note);
    else if (kind === "rp") s.reports[key] = v as Report;
    else if (kind === "ft") s.freeTexts[key] = v as string;
    else if (kind === "an") s.answers[key] = v as Record<string, string>;
    else if (kind === "pr") prefs.push(v as Preference);
    else if (kind === "lg") log.push(v as LearningEntry);
  }
  const pos = (id: string) => {
    const i = areaOrder.indexOf(id);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  s.areas = areas.sort((a, b) => pos(a.id) - pos(b.id) || a.name.localeCompare(b.name));
  s.students = students.sort((a, b) => codeNumber(a.code) - codeNumber(b.code));
  s.notes = notes.sort((a, b) => a.createdAt - b.createdAt);
  s.preferences = prefs.sort((a, b) => a.createdAt - b.createdAt);
  s.learningLog = log.sort((a, b) => a.generatedAt - b.generatedAt);
  // Si dos dispositius han afegit alumnes alhora, el comptador no pot repetir codis.
  const maxCode = students.reduce((m, st) => Math.max(m, codeNumber(st.code)), 0);
  s.nextStudentNumber = Math.max(Number(s.nextStudentNumber) || 1, maxCode + 1);
  return s;
}

export interface RemoteRow {
  id: string;
  sealed: string;
  deleted: boolean;
  updated_at: string;
}
export interface PushRow {
  id: string;
  sealed: string;
  deleted: boolean;
}
export interface Backend {
  /** Registres canviats després de `since` (o tots, si és null), en ordre. */
  pull(since: string | null): Promise<RemoteRow[]>;
  /** Puja els registres i retorna la seva data al servidor. */
  push(rows: PushRow[]): Promise<{ id: string; updated_at: string }[]>;
}
export interface Cipher {
  encrypt(id: string, value: unknown): string;
  decrypt(id: string, sealed: string): unknown;
}

/** Què recorda aquest dispositiu de l'última sincronització. */
export interface SyncMeta {
  cursor: string | null;
  hashes: Record<string, string>;
}
export const emptyMeta = (): SyncMeta => ({ cursor: null, hashes: {} });

export interface SyncResult {
  /** Canvis baixats del servidor: valor nou, o undefined si s'ha esborrat. */
  remote: Map<string, unknown>;
  meta: SyncMeta;
  pulled: number;
  pushed: number;
}

const hashOf = (v: unknown) => JSON.stringify(v);

// Marge per no perdre canvis que el servidor confirma gairebé alhora.
const OVERLAP_MS = 10_000;
function since(cursor: string | null): string | null {
  if (!cursor) return null;
  return new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString();
}

/**
 * Una ronda de sincronització: baixa el que ha canviat, puja el que ha canviat aquí.
 * `ignoreLocal`: primera vegada en un dispositiu buit o quan la tutora tria «només les del compte».
 */
export async function syncOnce(local: AppState, meta: SyncMeta, backend: Backend, cipher: Cipher, ignoreLocal = false): Promise<SyncResult> {
  const localItems = ignoreLocal ? new Map<string, unknown>() : stateToItems(local);
  const localHash = new Map([...localItems].map(([id, v]) => [id, hashOf(v)]));
  const hashes = { ...meta.hashes };
  const merged = new Map(localItems);
  const remote = new Map<string, unknown>();
  let cursor = meta.cursor;

  const rows = await backend.pull(since(meta.cursor));
  for (const row of rows) {
    if (!cursor || row.updated_at > cursor) cursor = row.updated_at;
    const known = hashes[row.id];
    const value = row.deleted ? undefined : cipher.decrypt(row.id, row.sealed);
    const remoteHash = value === undefined ? undefined : hashOf(value);
    if (remoteHash === known) continue; // ja el tenim (o és el nostre propi canvi)
    const localDirty = !ignoreLocal && localHash.get(row.id) !== known;
    if (localDirty && localHash.get(row.id) !== remoteHash) continue; // conflicte: guanya aquest dispositiu
    if (value === undefined) {
      merged.delete(row.id);
      delete hashes[row.id];
    } else {
      merged.set(row.id, value);
      hashes[row.id] = remoteHash!;
    }
    remote.set(row.id, value);
  }

  const toPush: PushRow[] = [];
  for (const [id, v] of merged) {
    const h = hashOf(v);
    if (hashes[id] !== h) toPush.push({ id, sealed: cipher.encrypt(id, v), deleted: false });
  }
  if (!ignoreLocal) for (const id of Object.keys(hashes)) if (!merged.has(id)) toPush.push({ id, sealed: "", deleted: true });

  if (toPush.length) {
    const done = await backend.push(toPush);
    for (const d of done) if (!cursor || d.updated_at > cursor) cursor = d.updated_at;
    for (const p of toPush) {
      if (p.deleted) delete hashes[p.id];
      else hashes[p.id] = hashOf(merged.get(p.id));
    }
  }
  return { remote, meta: { cursor, hashes }, pulled: rows.length, pushed: toPush.length };
}

/** Aplica els canvis baixats sobre l'estat actual (que pot haver canviat mentre se sincronitzava). */
export function applyRemote(current: AppState, remote: Map<string, unknown>): AppState {
  if (!remote.size) return current;
  const items = stateToItems(current);
  for (const [id, v] of remote) {
    if (v === undefined) items.delete(id);
    else items.set(id, v);
  }
  return itemsToState(items);
}
