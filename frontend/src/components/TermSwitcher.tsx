import { TERMS } from "../config";
import { useStore } from "../store/AppStore";
import type { Term } from "../types";

/** Selector del trimestre actual: sempre visible a la capçalera. */
export function TermSwitcher({ compact = false }: { compact?: boolean }) {
  const { currentTerm, setTerm } = useStore();
  return (
    <div role="radiogroup" aria-label="Trimestre actual" className="flex items-center gap-2">
      {!compact && <span className="text-sm text-muted">Trimestre</span>}
      <div className="flex rounded-lg border border-line bg-card p-0.5">
        {([1, 2, 3] as Term[]).map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={currentTerm === t}
            title={TERMS[t]}
            onClick={() => setTerm(t)}
            className={`min-h-9 min-w-11 rounded-md px-2 text-base font-bold transition-colors ${
              currentTerm === t ? "bg-action text-white" : "text-muted hover:bg-hover hover:text-ink"
            }`}
          >
            {TERMS[t].split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}
