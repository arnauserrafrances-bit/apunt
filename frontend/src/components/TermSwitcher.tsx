import { TERMS } from "../config";
import { useStore } from "../store/AppStore";
import type { Term } from "../types";

/** Selector del trimestre actual: sempre visible (barra lateral a l'ordinador, capçalera al mòbil). */
export function TermSwitcher({ compact = false }: { compact?: boolean }) {
  const { currentTerm, setTerm } = useStore();
  return (
    <div
      role="radiogroup"
      aria-label="Trimestre actual"
      className={`flex border border-line bg-card p-[3px] ${compact ? "rounded-full" : "w-full rounded-[10px]"}`}
    >
      {([1, 2, 3] as Term[]).map((t) => (
        <button
          key={t}
          role="radio"
          aria-checked={currentTerm === t}
          title={TERMS[t]}
          onClick={() => setTerm(t)}
          className={`min-h-9 min-w-11 flex-1 px-2 text-[15px] font-bold transition-colors ${compact ? "rounded-full" : "rounded-[7px]"} ${
            currentTerm === t ? "bg-action text-white" : "text-muted hover:bg-hover hover:text-ink"
          }`}
        >
          {TERMS[t].split(" ")[0]}
        </button>
      ))}
    </div>
  );
}
