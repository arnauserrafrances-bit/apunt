// Compte: entrar, crear-lo, i veure l'estat de la sincronització entre dispositius.
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageTitle } from "../components/Layout";
import { useToast } from "../components/Toast";
import { MIN_PASSWORD } from "../config";
import { useSync } from "../store/SyncProvider";

function ago(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 10) return "ara mateix";
  if (s < 60) return `fa ${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `fa ${m} min` : `fa ${Math.round(m / 60)} h`;
}

export function syncLabel(status: string): string {
  return (
    {
      ok: "Sincronitzat",
      syncing: "Sincronitzant…",
      offline: "Sense connexió",
      error: "Error de sincronització",
      locked: "Cal la contrasenya",
      choose: "Cal decidir què fer",
      signedOut: "Sense compte",
      loading: "Carregant…",
      off: "Només aquest dispositiu",
    } as Record<string, string>
  )[status] ?? status;
}

function RememberBox({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" className="mt-1.5 h-5 w-5" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span>
        Recorda'm en aquest dispositiu
        <span className="block text-sm text-muted">Desmarca-ho si l'ordinador és compartit.</span>
      </span>
    </label>
  );
}

function AuthForms() {
  const sync = useSync();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "forgot") return <Forgot initialEmail={email} onBack={() => setMode("in")} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "up" && password !== repeat) return setError("Les dues contrasenyes no coincideixen.");
    setBusy(true);
    try {
      if (mode === "up") await sync.signUp(email, password, remember);
      else await sync.signIn(email, password, remember);
      setPassword("");
      setRepeat("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut fer.");
    } finally {
      setBusy(false);
    }
  };

  const tab = (m: "in" | "up", label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={`flex-1 rounded-lg px-4 py-2 font-bold ${mode === m ? "bg-card shadow-sm" : "text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="card space-y-2 p-5">
        <p>
          Amb un compte, les teves dades (alumnes, notes, informes, model i preferències) es guarden i les pots fer servir al
          mòbil i a qualsevol ordinador.
        </p>
        <p className="text-muted">
          Tot es xifra en aquest dispositiu abans de pujar-ho: ni el servidor ni nosaltres no podem llegir les notes. Per això, si
          perds la contrasenya, només el codi de recuperació et deixarà tornar a entrar.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl bg-hover p-1">
        {tab("in", "Entra")}
        {tab("up", "Crea un compte")}
      </div>

      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <div>
          <label htmlFor="email" className="mb-1 block font-bold">
            Correu electrònic
          </label>
          <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pw" className="mb-1 block font-bold">
            Contrasenya
          </label>
          <input
            id="pw"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            required
            minLength={mode === "up" ? MIN_PASSWORD : undefined}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === "up" && <p className="mt-1 text-sm text-muted">Com a mínim {MIN_PASSWORD} caràcters.</p>}
        </div>
        {mode === "up" && (
          <div>
            <label htmlFor="pw2" className="mb-1 block font-bold">
              Repeteix la contrasenya
            </label>
            <input id="pw2" type="password" autoComplete="new-password" required className="field" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </div>
        )}
        <RememberBox value={remember} onChange={setRemember} />
        {mode === "up" && <p className="text-muted">Les dades que ja tens en aquest dispositiu es pujaran al compte nou.</p>}
        {error && <div className="warn-box">{error}</div>}
        <button type="submit" className="btn btn-primary w-full py-3 text-lg" disabled={busy}>
          {busy ? "Un moment…" : mode === "up" ? "Crea el compte" : "Entra"}
        </button>
        {mode === "in" && (
          <button
            type="button"
            className="block w-full text-center text-muted underline underline-offset-4 hover:text-ink"
            onClick={() => {
              setMode("forgot");
              setError(null);
            }}
          >
            He oblidat la contrasenya
          </button>
        )}
      </form>
    </div>
  );
}

function Forgot({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const sync = useSync();
  const toast = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== repeat) return setError("Les dues contrasenyes no coincideixen.");
    setBusy(true);
    try {
      await sync.recover(email, code, password, remember);
      toast({ message: "Contrasenya canviada. Ja has entrat amb la nova." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut canviar la contrasenya.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <button type="button" className="btn btn-ghost -ml-3" onClick={onBack}>
        ← Torna a entrar
      </button>
      <div className="card space-y-2 p-5">
        <p className="font-bold">He oblidat la contrasenya</p>
        <p className="text-muted">
          Necessites el <strong className="text-ink">codi de recuperació</strong> que vas guardar en crear el compte (8 grups de 4
          lletres i números). Amb ell pots posar una contrasenya nova sense perdre cap dada. El codi continua servint després.
        </p>
      </div>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <div>
          <label htmlFor="r-email" className="mb-1 block font-bold">
            Correu electrònic
          </label>
          <input id="r-email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="r-code" className="mb-1 block font-bold">
            Codi de recuperació
          </label>
          <input
            id="r-code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            className="field font-mono tracking-wider"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="r-pw" className="mb-1 block font-bold">
            Contrasenya nova
          </label>
          <input id="r-pw" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD} className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-sm text-muted">Com a mínim {MIN_PASSWORD} caràcters.</p>
        </div>
        <div>
          <label htmlFor="r-pw2" className="mb-1 block font-bold">
            Repeteix la contrasenya nova
          </label>
          <input id="r-pw2" type="password" autoComplete="new-password" required className="field" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </div>
        <RememberBox value={remember} onChange={setRemember} />
        {error && <div className="warn-box">{error}</div>}
        <button type="submit" className="btn btn-primary w-full py-3 text-lg" disabled={busy}>
          {busy ? "Un moment…" : "Canvia la contrasenya i entra"}
        </button>
        <p className="text-sm text-muted">Si has perdut la contrasenya i també el codi, no es poden recuperar les dades: ningú no les pot obrir.</p>
      </form>
    </div>
  );
}

function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-5">
      <div className="warn-box space-y-2">
        <p className="font-bold">Guarda aquest codi de recuperació</p>
        <p>
          És l'única manera de tornar a obrir les teves dades si oblides la contrasenya. Apunta'l en paper o guarda'l en un lloc
          segur. No el tornaràs a veure.
        </p>
      </div>
      <div className="card p-5 text-center font-mono text-xl tracking-wider break-all select-all" data-testid="recovery-code">
        {code}
      </div>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => setCopied(true));
        }}
      >
        {copied ? "Copiat ✓" : "Copia el codi"}
      </button>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        He guardat el codi en un lloc segur
      </label>
      <button type="button" className="btn btn-primary w-full py-3 text-lg" disabled={!saved} onClick={onDone}>
        Continua
      </button>
    </div>
  );
}

function Unlock() {
  const sync = useSync();
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        sync
          .unlock(password, remember)
          .catch((err) => setError(err instanceof Error ? err.message : "No s'ha pogut obrir."))
          .finally(() => setBusy(false));
      }}
    >
      <p>
        Has entrat com a <strong>{sync.email}</strong>. Escriu la contrasenya per obrir les teves dades en aquest dispositiu.
      </p>
      <input type="password" autoComplete="current-password" aria-label="Contrasenya" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
      <RememberBox value={remember} onChange={setRemember} />
      {error && <div className="warn-box">{error}</div>}
      <p className="text-sm text-muted">Si l'has oblidada, tanca la sessió i fes servir «He oblidat la contrasenya».</p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary px-6" disabled={busy || !password}>
          {busy ? "Un moment…" : "Obre les dades"}
        </button>
        <SignOutButton />
      </div>
    </form>
  );
}

function Choose() {
  const sync = useSync();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-4">
      <div className="warn-box">
        Aquest dispositiu ja té dades, i el teu compte també. Què vols fer amb les d'aquest dispositiu?
      </div>
      <button type="button" className="btn btn-primary w-full py-3 text-left" onClick={() => void sync.choose("merge")}>
        Ajunta-les amb les del compte
      </button>
      <p className="-mt-2 text-sm text-muted">Si són teves (per exemple, notes que has fet aquí abans de crear el compte).</p>
      <button type="button" className="btn btn-secondary w-full py-3" onClick={() => setConfirm(true)}>
        Fes servir només les del compte
      </button>
      <p className="-mt-2 text-sm text-muted">Si són dades de prova: s'esborraran d'aquest dispositiu.</p>
      <ConfirmDialog
        open={confirm}
        title="Fer servir només les dades del compte?"
        confirmLabel="Sí, esborra les d'aquest dispositiu"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void sync.choose("account");
        }}
      >
        Les dades que hi ha ara en aquest dispositiu i que no són al compte es perdran.
      </ConfirmDialog>
    </div>
  );
}

function SignOutButton() {
  const sync = useSync();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Tanca la sessió
      </button>
      <ConfirmDialog
        open={open}
        title="Tancar la sessió en aquest dispositiu?"
        confirmLabel="Tanca la sessió"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          void sync.signOut();
        }}
      >
        Les dades s'esborraran d'aquest dispositiu, però continuen guardades al teu compte. Per tornar-les a veure, només caldrà
        entrar-hi.
      </ConfirmDialog>
    </>
  );
}

function Status() {
  const sync = useSync();
  return (
    <div className="space-y-5">
      <div className="card space-y-1 p-5">
        <p>
          Has entrat com a <strong>{sync.email}</strong>
        </p>
        <p className={sync.status === "error" || sync.status === "offline" ? "text-warn-ink" : "text-muted"} data-testid="sync-status">
          {syncLabel(sync.status)}
          {sync.lastSync && sync.status === "ok" ? ` · ${ago(sync.lastSync)}` : ""}
        </p>
      </div>
      {sync.error && sync.status !== "ok" && (
        <div className="warn-box">
          {sync.error}
          {sync.status === "offline" && " Els canvis es desen en aquest dispositiu i es pujaran quan tornis a tenir connexió."}
        </div>
      )}
      <p className="text-muted">
        Els canvis es pugen sols i els dels altres dispositius es baixen cada pocs segons. Al mòbil o a un altre ordinador, obre
        Apunt i entra amb el mateix correu i contrasenya.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-secondary" disabled={sync.status === "syncing"} onClick={() => void sync.syncNow()}>
          Sincronitza ara
        </button>
        <SignOutButton />
      </div>
    </div>
  );
}

export default function Compte() {
  const sync = useSync();
  let body;
  if (sync.recoveryCode) body = <RecoveryCode code={sync.recoveryCode} onDone={sync.clearRecovery} />;
  else if (sync.status === "off")
    body = <p className="card p-5">Els comptes encara no estan activats: les dades només es guarden en aquest dispositiu.</p>;
  else if (sync.status === "loading") body = <p className="text-muted">Carregant…</p>;
  else if (sync.status === "signedOut") body = <AuthForms />;
  else if (sync.status === "locked") body = <Unlock />;
  else if (sync.status === "choose") body = <Choose />;
  else body = <Status />;
  return (
    <div className="mx-auto max-w-lg">
      <PageTitle title="Compte" />
      {body}
    </div>
  );
}
