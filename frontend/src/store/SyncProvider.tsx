// Connecta el compte amb l'store: quan la tutora ha entrat, cada canvi es xifra i es puja,
// i el que s'ha fet en altres dispositius es baixa (cada 20 s, en tornar a l'app i en recuperar la connexió).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";
import type * as CloudModule from "../lib/cloud";
import { forgetDataKey, recallDataKey, rememberDataKey } from "../lib/deviceKey";
import { applyRemote, emptyMeta, syncOnce, type SyncMeta } from "../lib/vault";
import { useStore } from "./AppStore";
import { emptyState, type AppState } from "./repository";

export type SyncStatus =
  | "off" // no hi ha servidor configurat: només aquest dispositiu
  | "loading"
  | "signedOut"
  | "locked" // sessió oberta, però cal la contrasenya per obrir les dades
  | "choose" // primera vegada: aquest dispositiu i el compte tenen dades
  | "syncing"
  | "ok"
  | "offline"
  | "error";

interface SyncValue {
  status: SyncStatus;
  email: string | null;
  lastSync: number | null;
  error: string | null;
  /** Codi de recuperació del compte que s'acaba de crear (es mostra una sola vegada). */
  recoveryCode: string | null;
  clearRecovery: () => void;
  signUp: (email: string, password: string, remember: boolean) => Promise<void>;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  unlock: (password: string, remember: boolean) => Promise<void>;
  choose: (mode: "merge" | "account") => Promise<void>;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);

// El mòdul del núvol (Supabase + libsodium) pesa: només es carrega si hi ha comptes configurats.
const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
let cloudPromise: Promise<typeof CloudModule> | null = null;
const loadCloud = () => (cloudPromise ??= import("../lib/cloud"));

const metaKey = (userId: string) => `apunt-sync:${userId}`;
function loadMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(metaKey(userId));
    return raw ? (JSON.parse(raw) as SyncMeta) : emptyMeta();
  } catch {
    return emptyMeta();
  }
}
function saveMeta(userId: string, meta: SyncMeta | null) {
  try {
    if (meta) localStorage.setItem(metaKey(userId), JSON.stringify(meta));
    else localStorage.removeItem(metaKey(userId));
  } catch {
    /* només es tornarà a comparar tot */
  }
}

function hasData(s: AppState): boolean {
  return Boolean(
    s.students.length || s.areas.length || s.notes.length || s.reportGuide.trim() || s.exampleReport.trim() || s.preferences.length || Object.keys(s.reports).length,
  );
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const storeRef = useRef(store);
  storeRef.current = store;

  const [status, setStatus] = useState<SyncStatus>(configured ? "loading" : "off");
  const [email, setEmail] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const unlocked = useRef<CloudModule.Unlocked | null>(null);
  const session = useRef<CloudModule.Session | null>(null);
  const running = useRef(false);
  const again = useRef(false);

  const run = useCallback(async (ignoreLocal = false) => {
    const u = unlocked.current;
    if (!u) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus("syncing");
    try {
      const cloud = await loadCloud();
      const result = await syncOnce(
        storeRef.current.snapshot,
        loadMeta(u.userId),
        cloud.supabaseBackend(u.userId),
        cloud.makeCipher(u.userId, u.dataKey),
        ignoreLocal,
      );
      if (unlocked.current !== u) return; // s'ha tancat la sessió mentrestant
      saveMeta(u.userId, result.meta);
      if (ignoreLocal) storeRef.current.replaceState(() => applyRemote(emptyState(), result.remote));
      else if (result.remote.size) storeRef.current.replaceState((cur) => applyRemote(cur, result.remote));
      setLastSync(Date.now());
      setError(null);
      setStatus("ok");
    } catch (e) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setError(e instanceof Error ? e.message : "No s'ha pogut sincronitzar.");
      setStatus(offline ? "offline" : "error");
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void run();
      }
    }
  }, []);

  /** Primera vegada en aquest dispositiu: decideix què fer amb les dades que ja hi ha. */
  const start = useCallback(
    async (u: CloudModule.Unlocked, remember: boolean | null) => {
      unlocked.current = u;
      session.current = u;
      setEmail(u.email);
      if (remember) await rememberDataKey(u.userId, u.dataKey);
      const meta = loadMeta(u.userId);
      if (meta.cursor) return run();
      setStatus("syncing");
      let remoteHasData = false;
      try {
        const cloud = await loadCloud();
        const rows = await cloud.supabaseBackend(u.userId).pull(null);
        remoteHasData = rows.some((r) => !r.deleted);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No s'ha pogut connectar.");
        setStatus("error");
        return;
      }
      const localHasData = hasData(storeRef.current.snapshot);
      if (!remoteHasData) return run(); // compte nou: es pugen les dades d'aquest dispositiu
      if (!localHasData) return run(true); // dispositiu nou: es baixen les del compte
      setStatus("choose");
    },
    [run],
  );

  // En obrir l'app: sessió guardada?
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      const cloud = await loadCloud();
      const s = await cloud.currentSession();
      if (cancelled) return;
      if (!s) return setStatus("signedOut");
      session.current = s;
      setEmail(s.email);
      const key = await recallDataKey(s.userId);
      if (cancelled) return;
      if (key) await start({ ...s, dataKey: key }, null);
      else setStatus("locked");
    })();
    return () => {
      cancelled = true;
    };
  }, [start]);

  // Cada canvi local es puja (després d'1,5 s sense canvis).
  const snapshot = store.snapshot;
  useEffect(() => {
    if (!unlocked.current || status === "choose" || status === "loading") return;
    const t = window.setTimeout(() => void run(), 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, run]);

  // Canvis d'altres dispositius: cada 20 s, en tornar a l'app i en recuperar la connexió.
  useEffect(() => {
    const tick = () => {
      if (unlocked.current && document.visibilityState === "visible") void run();
    };
    const t = window.setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [run]);

  const value = useMemo<SyncValue>(
    () => ({
      status,
      email,
      lastSync,
      error,
      recoveryCode,
      clearRecovery: () => setRecoveryCode(null),
      signUp: async (e, pw, remember) => {
        const acc = await (await loadCloud()).signUp(e, pw);
        saveMeta(acc.userId, null);
        setRecoveryCode(acc.recoveryCode);
        await start(acc, remember);
      },
      signIn: async (e, pw, remember) => {
        const u = await (await loadCloud()).signIn(e, pw);
        await start(u, remember);
      },
      unlock: async (pw, remember) => {
        if (!session.current) throw new Error("Torna a entrar al compte.");
        const u = await (await loadCloud()).unlock(session.current, pw);
        await start(u, remember);
      },
      choose: async (mode) => run(mode === "account"),
      syncNow: () => run(),
      signOut: async () => {
        const u = unlocked.current;
        if (u) await run().catch(() => {});
        unlocked.current = null;
        session.current = null;
        if (u) saveMeta(u.userId, null);
        await forgetDataKey();
        await (await loadCloud()).signOut();
        storeRef.current.replaceState(() => emptyState());
        setEmail(null);
        setLastSync(null);
        setError(null);
        setStatus("signedOut");
      },
    }),
    [status, email, lastSync, error, recoveryCode, start, run],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const v = useContext(SyncContext);
  if (!v) throw new Error("useSync fora de SyncProvider");
  return v;
}
