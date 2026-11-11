import { useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { APP_NAME } from "../config";
import { useStore } from "../store/AppStore";
import { Icon, LogoMark, Wordmark, type IconName } from "./Brand";
import { useSync } from "../store/SyncProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { TermSwitcher } from "./TermSwitcher";
import { useToast } from "./Toast";

/** Carrega la classe inventada. Només si la tutora ho demana; si ja hi ha dades, les substitueix. */
export function LoadFakeDataButton() {
  const { loadFakeData, isEmpty } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={() => setOpen(true)}>
        Carrega dades de prova
      </button>
      <ConfirmDialog
        open={open}
        title="Carregar les dades de prova?"
        confirmLabel={isEmpty ? "Carrega" : "Substitueix-ho tot"}
        danger={!isEmpty}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          loadFakeData();
          setOpen(false);
          toast({ message: "S'han carregat les dades de prova." });
        }}
      >
        {isEmpty
          ? "Es carregarà una classe inventada de 5è (25 alumnes, 7 àrees i unes 60 notes) per provar l'aplicació."
          : "Ja tens dades. Si continues, s'esborraran tots els alumnes, àrees, notes i informes actuals i se substituiran per una classe inventada."}
      </ConfirmDialog>
    </>
  );
}

const DOT: Record<string, string> = { ok: "bg-[#1F9D6B]", syncing: "bg-marker", offline: "bg-[#E8A33D]", error: "bg-danger", locked: "bg-[#E8A33D]", choose: "bg-[#E8A33D]" };

/** Enllaç al compte amb l'estat de la sincronització. */
function AccountLink() {
  const sync = useSync();
  const label =
    sync.status === "off" || sync.status === "signedOut" || sync.status === "loading"
      ? "Entra o crea un compte"
      : { ok: "Sincronitzat", syncing: "Sincronitzant…", offline: "Sense connexió", error: "Error de sincronització", locked: "Cal la contrasenya", choose: "Cal decidir què fer" }[sync.status];
  return (
    <NavLink to="/compte" className="flex items-center gap-3 rounded-[10px] border border-line bg-card px-3 py-2.5 hover:bg-hover">
      <span className="text-ink"><Icon name="compte" size={26} highlight="#8CCBF5" /></span>
      <span className="min-w-0">
        <span className="block text-sm font-bold">Compte</span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted">
          {DOT[sync.status] && <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[sync.status]}`} />}
          <span className="truncate">{label}</span>
        </span>
      </span>
    </NavLink>
  );
}

/** Obre Nota ràpida i comença a gravar (el micròfon de la barra i el botó de la barra lateral). */
function useStartRecording() {
  const navigate = useNavigate();
  return () => navigate("/", { state: { record: Date.now() } });
}

const SIDE_NAV: { to: string; label: string; icon: IconName; highlight: string }[] = [
  { to: "/", label: "Notes", icon: "notes", highlight: "#FFD23F" },
  { to: "/classe", label: "Classe", icon: "classe", highlight: "#FFD23F" },
  { to: "/informe", label: "Informe", icon: "informe", highlight: "#FFD23F" },
  { to: "/alumnes", label: "Alumnes", icon: "alumnes", highlight: "#FFD23F" },
  { to: "/arees", label: "Àrees", icon: "arees", highlight: "#FFD23F" },
  { to: "/model", label: "Model", icon: "model", highlight: "#FFD23F" },
];

const TABS: { to: string; label: string; icon: IconName; match: string[] }[] = [
  { to: "/classe", label: "Classe", icon: "classe", match: ["/classe", "/alumne"] },
  { to: "/", label: "Notes", icon: "notes", match: ["/"] },
  { to: "/informe", label: "Informe", icon: "informe", match: ["/informe"] },
  { to: "/mes", label: "Més", icon: "mes", match: ["/mes", "/alumnes", "/arees", "/model", "/compte"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const startRecording = useStartRecording();
  const isActive = (t: { to: string; match: string[] }) =>
    t.to === "/" ? pathname === "/" : t.match.some((m) => pathname.startsWith(m));
  const tab = (t: (typeof TABS)[number]) => {
    const active = isActive(t);
    return (
      <NavLink
        key={t.to}
        to={t.to}
        end={t.to === "/"}
        className={`flex flex-col items-center justify-center gap-1 text-xs font-bold ${active ? "text-action" : "text-muted"}`}
      >
        <Icon name={t.icon} size={26} stroke={3.5} highlight={active ? "#FFD23F" : undefined} />
        {t.label}
      </NavLink>
    );
  };

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral (ordinador) */}
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line px-[18px] py-6 md:flex">
        <NavLink to="/" className="flex items-center gap-2.5" aria-label={APP_NAME}>
          <LogoMark size={34} />
          <Wordmark />
        </NavLink>
        <TermSwitcher />
        <button className="btn btn-primary min-h-[46px] w-full" onClick={startRecording}>
          <Icon name="mic" size={20} stroke={4} />
          Grava una nota
        </button>
        <nav aria-label="Seccions" className="flex flex-col gap-0.5">
          {SIDE_NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[10px] border px-2.5 py-2 transition-colors ${
                  isActive ? "border-line bg-card font-bold text-ink" : "border-transparent text-soft hover:bg-hover hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={n.icon} highlight={isActive ? n.highlight : undefined} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <AccountLink />
          <LoadFakeDataButton />
        </div>
      </aside>

      {/* Capçalera (mòbil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-paper/95 px-5 py-3 backdrop-blur md:hidden">
        <NavLink to="/" className="flex items-center gap-2" aria-label={APP_NAME}>
          <LogoMark size={32} />
          <Wordmark className="text-[24px]" />
        </NavLink>
        <TermSwitcher compact />
      </header>

      <main className="min-w-0 flex-1 px-5 pt-4 pb-36 md:px-12 md:pt-9 md:pb-16">{children}</main>

      {/* Barra flotant (mòbil): el micròfon al mig */}
      <nav
        aria-label="Seccions"
        className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 grid h-[76px] grid-cols-5 items-center rounded-[30px] bg-card shadow-[0_12px_32px_rgba(20,33,61,0.16),0_1px_0_#E4E8F1] md:hidden"
      >
        {tab(TABS[0])}
        {tab(TABS[1])}
        <div className="flex justify-center">
          <button
            aria-label="Grava una nota de veu"
            onClick={startRecording}
            className="relative -mt-[26px] flex h-[70px] w-[70px] items-center justify-center rounded-[26px] border-[5px] border-paper bg-action text-white shadow-[0_10px_22px_rgba(27,47,94,0.35)] active:scale-95"
          >
            <Icon name="mic" size={30} stroke={4} />
            <span className="absolute top-[9px] right-[9px] h-2.5 w-2.5 rounded-full bg-marker" />
          </button>
        </div>
        {tab(TABS[2])}
        {tab(TABS[3])}
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-[30px] leading-tight md:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
