// «He oblidat la contrasenya». La tutora escriu el correu, el codi de recuperació i una contrasenya nova.
// Al dispositiu, el codi obre la clau de dades; amb ella es fa una prova (recoveryProof) i un clauer nou.
// Aquí només es comprova la prova contra el hash guardat i es canvia la contrasenya de Supabase.
// El servidor no veu mai ni el codi, ni la contrasenya, ni la clau de dades.
// Fitxer independent (no importa res d'altres fitxers del projecte): a Vercel cada funció és un mòdul ESM.
import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_URL = "https://jjxggzewgbqovyirpcyp.supabase.co";

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

function config(env: Env) {
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Falta la clau secreta de Supabase al servidor (SUPABASE_SECRET_KEY).");
  const url = (env.SUPABASE_URL || DEFAULT_URL).replace(/\/+$/, "");
  // Les claus noves (sb_secret_…) van només a «apikey»; les antigues (JWT) també a Authorization.
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (!key.startsWith("sb_")) headers.authorization = `Bearer ${key}`;
  return { url, headers };
}

async function call(env: Env, path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const { url, headers } = config(env);
  const r = await fetch(`${url}${path}`, {
    method: init.method ?? "GET",
    headers: { ...headers, ...(init.prefer ? { prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(`Supabase (${r.status}): ${data?.message ?? data?.msg ?? "error"}`);
  return data;
}

interface KeyringRow {
  keyring: { version: number; wrappedPw: string; wrappedRecovery: string; pendingWrappedPw?: string | null };
  recovery_verifier: string | null;
}

async function findAccount(env: Env, email: string): Promise<{ userId: string; row: KeyringRow } | null> {
  const userId = (await call(env, "/rest/v1/rpc/user_id_by_email", { method: "POST", body: { p_email: email } })) as string | null;
  if (!userId) return null;
  const rows = (await call(env, `/rest/v1/keyrings?user_id=eq.${encodeURIComponent(userId)}&select=keyring,recovery_verifier`)) as KeyringRow[];
  return rows?.[0] ? { userId, row: rows[0] } : null;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

const isEmail = (e: unknown): e is string => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const isB64 = (s: unknown, max = 400): s is string => typeof s === "string" && s.length > 10 && s.length <= max && /^[A-Za-z0-9_-]+$/.test(s);

export interface RecoverEnv extends Env {}

/** Pas 1: retorna el clauer xifrat amb el codi de recuperació (sense el codi, no serveix de res). */
export async function start(email: string, env: Env) {
  const acc = await findAccount(env, email.trim().toLowerCase());
  if (!acc) return { status: 404, body: { error: "No hi ha cap compte amb aquest correu." } };
  if (!acc.row.recovery_verifier)
    return { status: 409, body: { error: "Aquest compte encara no té la recuperació activada. Entra-hi un cop amb la contrasenya i s'activarà." } };
  return { status: 200, body: { wrappedRecovery: acc.row.keyring.wrappedRecovery, version: acc.row.keyring.version } };
}

/** Pas 2: comprova la prova, canvia la contrasenya de Supabase i desa el clauer nou. */
export async function finish(email: string, proof: string, authKey: string, wrappedPw: string, env: Env) {
  const acc = await findAccount(env, email.trim().toLowerCase());
  if (!acc || !acc.row.recovery_verifier || !sameHex(sha256(proof), acc.row.recovery_verifier))
    return { status: 403, body: { error: "El codi de recuperació no és correcte." } };
  const where = `/rest/v1/keyrings?user_id=eq.${encodeURIComponent(acc.userId)}`;
  // 1) El clauer nou es desa com a «pendent» (així, passi el que passi, la contrasenya nova obrirà les dades).
  await call(env, where, { method: "PATCH", body: { keyring: { ...acc.row.keyring, pendingWrappedPw: wrappedPw } }, prefer: "return=minimal" });
  // 2) Contrasenya nova a Supabase (és l'authKey, derivada de la contrasenya al dispositiu).
  await call(env, `/auth/v1/admin/users/${encodeURIComponent(acc.userId)}`, { method: "PUT", body: { password: authKey } });
  // 3) El clauer nou passa a ser el bo.
  await call(env, where, {
    method: "PATCH",
    body: { keyring: { ...acc.row.keyring, wrappedPw, pendingWrappedPw: null } },
    prefer: "return=minimal",
  });
  return { status: 200, body: { ok: true } };
}

interface Req {
  method?: string;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Només POST." });
  let b: Record<string, unknown>;
  try {
    b = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as Record<string, unknown>;
  } catch {
    return res.status(400).json({ error: "Petició no vàlida." });
  }
  if (!b || !isEmail(b.email)) return res.status(400).json({ error: "El correu no és vàlid." });
  try {
    if (b.step === "start") {
      const r = await start(b.email, process.env);
      return res.status(r.status).json(r.body);
    }
    if (b.step === "finish") {
      if (!isB64(b.proof) || !isB64(b.authKey) || !isB64(b.wrappedPw, 2000)) return res.status(400).json({ error: "Petició no vàlida." });
      const r = await finish(b.email, b.proof, b.authKey, b.wrappedPw, process.env);
      return res.status(r.status).json(r.body);
    }
    return res.status(400).json({ error: "Petició no vàlida." });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "Error desconegut." });
  }
}
