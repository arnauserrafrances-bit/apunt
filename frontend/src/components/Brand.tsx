// Logo, nom i icones d'Apunt (sistema de disseny «Tinta i retolador»).
import type { ReactNode } from "react";

/** Icona: una nota (dues línies) amb el punt groc al final. */
export function LogoMark({ size = 34, light = false }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" aria-hidden="true" className="shrink-0">
      <rect width="160" height="160" rx="38" fill={light ? "#FFFFFF" : "#1B2F5E"} />
      <line x1="42" y1="62" x2="118" y2="62" stroke={light ? "#1B2F5E" : "#FFFFFF"} strokeWidth="15" strokeLinecap="round" />
      <line x1="42" y1="98" x2="86" y2="98" stroke={light ? "#1B2F5E" : "#FFFFFF"} strokeWidth="15" strokeLinecap="round" />
      <circle cx="113" cy="98" r="12" fill="#FFD23F" />
    </svg>
  );
}

/** «apunt.» amb el punt groc. */
export function Wordmark({ className = "text-[26px]" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-[-0.03em] text-action ${className}`}>
      apunt<span className="text-marker">.</span>
    </span>
  );
}

export type IconName = "notes" | "classe" | "informe" | "alumnes" | "arees" | "model" | "mes" | "compte" | "mic" | "pen";

const PATHS: Record<IconName, ReactNode> = {
  notes: (
    <>
      <rect x="12" y="7" width="24" height="30" rx="5" fill="none" />
      <line x1="18" y1="16" x2="30" y2="16" />
      <line x1="18" y1="23" x2="25" y2="23" />
    </>
  ),
  classe: (
    <>
      <circle cx="24" cy="15" r="6" fill="none" />
      <path d="M13 38c0-6 5-10 11-10s11 4 11 10" fill="none" />
      <circle cx="10" cy="20" r="4" fill="none" />
      <circle cx="38" cy="20" r="4" fill="none" />
    </>
  ),
  informe: (
    <>
      <path d="M12 5h16l8 8v28a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="none" strokeLinejoin="round" />
      <path d="M16 28l5 5 9-10" fill="none" strokeLinejoin="round" />
    </>
  ),
  alumnes: (
    <>
      <rect x="6" y="10" width="36" height="28" rx="6" fill="none" />
      <circle cx="17" cy="21" r="4" fill="none" />
      <path d="M11 32c1-3 3-5 6-5s5 2 6 5" fill="none" />
      <line x1="28" y1="20" x2="36" y2="20" />
    </>
  ),
  arees: (
    <>
      <rect x="7" y="7" width="15" height="15" rx="4" fill="none" />
      <rect x="27" y="7" width="15" height="15" rx="4" fill="none" />
      <rect x="7" y="27" width="15" height="15" rx="4" fill="none" />
      <rect x="27" y="27" width="15" height="15" rx="4" fill="none" />
    </>
  ),
  model: (
    <>
      <rect x="8" y="8" width="32" height="34" rx="5" fill="none" />
      <rect x="14" y="14" width="10" height="8" rx="2" fill="none" />
      <line x1="14" y1="29" x2="34" y2="29" />
      <line x1="14" y1="35" x2="27" y2="35" />
    </>
  ),
  mes: (
    <>
      <rect x="7" y="7" width="14" height="14" rx="4" fill="none" />
      <rect x="27" y="7" width="14" height="14" rx="4" fill="none" />
      <rect x="7" y="27" width="14" height="14" rx="4" fill="none" />
      <rect x="27" y="27" width="14" height="14" rx="4" fill="none" />
    </>
  ),
  compte: (
    <>
      <path d="M8 30a8 8 0 0 1 4-15 11 11 0 0 1 21 1 7 7 0 0 1 3 14z" fill="none" />
      <rect x="16" y="24" width="18" height="16" rx="4" fill="none" />
      <path d="M20 24v-4a5 5 0 0 1 10 0v4" fill="none" />
    </>
  ),
  mic: (
    <>
      <rect x="17" y="6" width="14" height="23" rx="7" fill="none" />
      <path d="M11 23a13 13 0 0 0 26 0" fill="none" />
      <line x1="24" y1="36" x2="24" y2="42" />
    </>
  ),
  pen: (
    <>
      <rect x="12" y="7" width="24" height="30" rx="5" fill="none" />
      <line x1="18" y1="16" x2="30" y2="16" />
      <line x1="18" y1="23" x2="25" y2="23" />
      <path d="M30 41l11-11 4 4-11 11h-4z" fill="#FFFFFF" strokeLinejoin="round" />
    </>
  ),
};

/** Taca de retolador darrere la icona (la secció activa, o les icones grans). */
const BLOB: Partial<Record<IconName, ReactNode>> = {
  notes: <rect x="6" y="12" width="24" height="28" rx="5" />,
  classe: <rect x="4" y="22" width="40" height="16" rx="8" />,
  informe: <circle cx="31" cy="31" r="12" />,
  alumnes: <rect x="4" y="16" width="22" height="22" rx="11" />,
  arees: <rect x="25" y="25" width="17" height="17" rx="5" />,
  model: <rect x="5" y="5" width="20" height="16" rx="4" />,
  mes: <rect x="25" y="25" width="17" height="17" rx="5" />,
  compte: <circle cx="20" cy="22" r="13" />,
  mic: <circle cx="20" cy="21" r="13" />,
  pen: <rect x="6" y="12" width="24" height="28" rx="5" />,
};

export function Icon({
  name,
  size = 26,
  stroke = 3,
  highlight,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  /** Color de la taca de darrere (p. ex. el groc del retolador per a la secció activa). */
  highlight?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="shrink-0"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
    >
      {highlight && BLOB[name] && <g fill={highlight} stroke="none">{BLOB[name]}</g>}
      {PATHS[name]}
    </svg>
  );
}

/** Cercle de progrés: quants alumnes ja tenen notes. */
export function ProgressRing({ value, total, size = 52 }: { value: number; total: number; size?: number }) {
  const c = 2 * Math.PI * 25;
  const part = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true" className="shrink-0">
      <circle cx="30" cy="30" r="25" fill="none" stroke="#E8ECF5" strokeWidth="8" />
      {part > 0 && (
        <circle
          cx="30"
          cy="30"
          r="25"
          fill="none"
          stroke="#FFD23F"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${part * c} ${c}`}
          transform="rotate(-90 30 30)"
        />
      )}
    </svg>
  );
}
