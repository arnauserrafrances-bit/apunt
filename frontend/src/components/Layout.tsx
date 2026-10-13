import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { APP_NAME } from "../config";
import { useStore } from "../store/AppStore";
import { ConfirmDialog } from "./ConfirmDialog";
import { TermSwitcher } from "./TermSwitcher";
import { useToast } from "./Toast";

const NAV = [
  { to: "/", label: "Nota ràpida" },
  { to: "/classe", label: "Classe" },
  { to: "/informe", label: "Informe" },
  { to: "/alumnes", label: "Alumnes" },
  { to: "/arees", label: "Àrees" },
];

const MOBILE_NAV = [
  { to: "/", label: "Nota", match: ["/"] },
  { to: "/classe", label: "Classe", match: ["/classe", "/alumne"] },
  { to: "/informe", label: "Informe", match: ["/informe"] },
  { to: "/mes", label: "Més", match: ["/mes", "/alumnes", "/arees"] },
];

export function ResetDataButton() {
  const { resetData } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={() => setOpen(true)}>
        Reinicia les dades de prova
      </button>
      <ConfirmDialog
        open={open}
        title="Reiniciar les dades de prova?"
        confirmLabel="Reinicia"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          resetData();
          setOpen(false);
          toast({ message: "S'han restaurat les dades de prova." });
        }}
      >
        Es perdran tots els canvis que hagis fet (alumnes, àrees, notes i informes) i es tornarà a
        la classe inventada inicial.
      </ConfirmDialog>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-lg px-3 py-2 transition-colors ${
      isActive ? "bg-card font-bold text-ink shadow-sm" : "text-muted hover:bg-hover hover:text-ink"
    }`;

  return (
    <div className="min-h-dvh md:flex">
      {/* Barra lateral (portàtil) */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line p-5 md:flex">
        <div className="text-2xl font-bold tracking-tight">{APP_NAME}</div>
        <TermSwitcher />
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={linkClass}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <ResetDataButton />
        </div>
      </aside>

      {/* Capçalera (mòbil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-2 backdrop-blur md:hidden">
        <div className="text-xl font-bold">{APP_NAME}</div>
        <TermSwitcher compact />
      </header>

      <main className="min-w-0 flex-1 px-4 pt-6 pb-28 md:px-10 md:pt-10 md:pb-16">{children}</main>

      {/* Navegació inferior (mòbil) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_NAV.map((n) => {
          const active =
            n.to === "/" ? pathname === "/" : n.match.some((m) => pathname.startsWith(m));
          return (
            <NavLink
              key={n.to}
              to={n.to}
              className={`flex min-h-14 items-center justify-center text-base ${
                active ? "font-bold text-ink" : "text-muted"
              }`}
            >
              <span className={active ? "border-b-2 border-action pb-0.5" : ""}>{n.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
