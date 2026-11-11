// Comptes (Supabase Auth) i còpia xifrada al núvol. La contrasenya no surt mai del dispositiu:
// d'ella se'n treuen dues claus (Argon2id, lib/crypto.ts). Una fa de contrasenya per a Supabase
// (authKey); l'altra obre la clau de dades, que és la que xifra tot el que es puja.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import {
  createKeyring,
  CryptoError,
  decryptItem,
  deriveKeys,
  encryptItem,
  normalizeEmail,
  openKeyring,
  recoveryProof,
  recoveryVerifier,
  rewrapForNewPassword,
  unlockWithRecovery,
  type Keyring,
} from "./crypto";
import type { Backend, Cipher, PushRow, RemoteRow } from "./vault";

let client: SupabaseClient | null = null;

export function cloudConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "apunt-auth" },
    });
  }
  return client;
}

export { MIN_PASSWORD } from "../config";
import { MIN_PASSWORD } from "../config";

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "El correu o la contrasenya no són correctes.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ja hi ha un compte amb aquest correu. Entra-hi.";
  if (m.includes("email not confirmed")) return "Cal confirmar el correu (o desactivar la confirmació a Supabase).";
  if (m.includes("rate limit")) return "Massa intents seguits. Espera un minut i torna-ho a provar.";
  if (m.includes("failed to fetch") || m.includes("network")) return "No hi ha connexió amb el servidor.";
  if (m.includes("invalid") && m.includes("email")) return "El correu no és vàlid.";
  return message;
}

export interface Session {
  userId: string;
  email: string;
}

export interface Unlocked extends Session {
  dataKey: Uint8Array;
}

export interface NewAccountResult extends Unlocked {
  recoveryCode: string;
}

export async function signUp(emailRaw: string, password: string): Promise<NewAccountResult> {
  const email = normalizeEmail(emailRaw);
  if (password.length < MIN_PASSWORD) throw new Error(`La contrasenya ha de tenir com a mínim ${MIN_PASSWORD} caràcters.`);
  const acc = await createKeyring(email, password);
  const sb = supabase();
  const { data, error } = await sb.auth.signUp({ email, password: acc.authKey });
  if (error) throw new Error(friendly(error.message));
  if (!data.session || !data.user) throw new Error("El compte s'ha creat però cal confirmar el correu. Desactiva «Confirm email» a Supabase.");
  const { error: kErr } = await sb
    .from("keyrings")
    .insert({ user_id: data.user.id, keyring: acc.keyring, recovery_verifier: recoveryVerifier(acc.dataKey) });
  if (kErr) throw new Error(friendly(kErr.message));
  return { userId: data.user.id, email, dataKey: acc.dataKey, recoveryCode: acc.recoveryCode };
}

async function fetchKeyring(userId: string): Promise<Keyring> {
  const { data, error } = await supabase().from("keyrings").select("keyring").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(friendly(error.message));
  if (!data) throw new Error("Aquest compte no té clau de dades. Torna a crear-lo.");
  return data.keyring as Keyring;
}

export async function signIn(emailRaw: string, password: string): Promise<Unlocked> {
  const email = normalizeEmail(emailRaw);
  const { authKey, wrapKey } = await deriveKeys(email, password);
  const sb = supabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: authKey });
  if (error || !data.user) throw new Error(friendly(error?.message ?? "No s'ha pogut entrar."));
  const keyring = await fetchKeyring(data.user.id);
  return { userId: data.user.id, email, dataKey: openKeyring(keyring, wrapKey) };
}

/** Sessió oberta però sense la clau (no s'ha recordat el dispositiu): només cal la contrasenya. */
export async function unlock(session: Session, password: string): Promise<Unlocked> {
  const { wrapKey } = await deriveKeys(session.email, password);
  const keyring = await fetchKeyring(session.userId);
  try {
    return { ...session, dataKey: openKeyring(keyring, wrapKey) };
  } catch (e) {
    throw e instanceof CryptoError ? new Error("La contrasenya no és correcta.") : e;
  }
}

export async function currentSession(): Promise<Session | null> {
  if (!cloudConfigured()) return null;
  const { data } = await supabase().auth.getSession();
  const u = data.session?.user;
  return u ? { userId: u.id, email: u.email ?? "" } : null;
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut().catch(() => {});
}

export function makeCipher(userId: string, dataKey: Uint8Array): Cipher {
  return {
    encrypt: (id, value) => encryptItem(dataKey, userId, id, value),
    decrypt: (id, sealed) => decryptItem(dataKey, userId, id, sealed),
  };
}

const PAGE = 500;

export function supabaseBackend(userId: string): Backend {
  const sb = supabase();
  return {
    async pull(since) {
      const out: RemoteRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let q = sb.from("items").select("id, sealed, deleted, updated_at").order("updated_at").order("id").range(from, from + PAGE - 1);
        if (since) q = q.gt("updated_at", since);
        const { data, error } = await q;
        if (error) throw new Error(friendly(error.message));
        out.push(...((data ?? []) as RemoteRow[]));
        if (!data || data.length < PAGE) return out;
      }
    },
    async push(rows: PushRow[]) {
      const out: { id: string; updated_at: string }[] = [];
      for (let i = 0; i < rows.length; i += PAGE) {
        const batch = rows.slice(i, i + PAGE).map((r) => ({ user_id: userId, ...r }));
        const { data, error } = await sb.from("items").upsert(batch, { onConflict: "user_id,id" }).select("id, updated_at");
        if (error) throw new Error(friendly(error.message));
        out.push(...((data ?? []) as { id: string; updated_at: string }[]));
      }
      return out;
    },
  };
}

/**
 * Comptes creats abans que existís la recuperació: en entrar, es guarda el hash de la prova
 * perquè el codi de recuperació també serveixi per canviar la contrasenya.
 */
export async function ensureRecovery(u: Unlocked): Promise<void> {
  const sb = supabase();
  const { data } = await sb.from("keyrings").select("recovery_verifier").eq("user_id", u.userId).maybeSingle();
  if (data && !data.recovery_verifier) {
    await sb.from("keyrings").update({ recovery_verifier: recoveryVerifier(u.dataKey) }).eq("user_id", u.userId);
  }
}

async function recoverCall(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch("/api/recover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("No hi ha connexió amb el servidor.");
  }
  if (r.status === 404 && !(r.headers.get("content-type") ?? "").includes("json"))
    throw new Error("La recuperació només funciona a la versió publicada (Vercel).");
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : `Error del servidor (${r.status}).`);
  return data;
}

/** «He oblidat la contrasenya»: amb el codi de recuperació es posa una contrasenya nova. Les dades no es perden. */
export async function recover(emailRaw: string, code: string, newPassword: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (newPassword.length < MIN_PASSWORD) throw new Error(`La contrasenya ha de tenir com a mínim ${MIN_PASSWORD} caràcters.`);
  const started = await recoverCall({ step: "start", email });
  const stub: Keyring = { version: Number(started.version) || 1, wrappedPw: "", wrappedRecovery: String(started.wrappedRecovery ?? "") };
  const dataKey = await unlockWithRecovery(stub, code); // codi equivocat → CryptoError amb missatge clar
  const { keyring, authKey } = await rewrapForNewPassword(stub, dataKey, email, newPassword);
  await recoverCall({ step: "finish", email, proof: recoveryProof(dataKey), authKey, wrappedPw: keyring.wrappedPw });
}
