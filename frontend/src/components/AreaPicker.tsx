import { forwardRef } from "react";
import { shortAreaName } from "../lib/areas";
import type { Area } from "../types";

interface Props {
  areas: Area[];
  value: number | null;
  onChange: (areaId: number) => void;
  onEscape?: () => void;
}

/** Àrees com a botons numerats. Amb el focus aquí, prem 1-9 per triar-ne una. */
export const AreaPicker = forwardRef<HTMLDivElement, Props>(function AreaPicker(
  { areas, value, onChange, onEscape },
  ref,
) {
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="radiogroup"
      aria-label="Àrea"
      className="grid grid-cols-2 gap-2 rounded-lg outline-none"
      onKeyDown={(e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= Math.min(9, areas.length)) {
          e.preventDefault();
          onChange(areas[n - 1].id);
        } else if (e.key === "Escape") {
          onEscape?.();
        }
      }}
    >
      {areas.map((a, i) => {
        const selected = a.id === value;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(a.id)}
            className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
              selected
                ? "border-action bg-action text-white"
                : "border-line bg-card hover:bg-hover"
            }`}
          >
            {i < 9 && (
              <span
                className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded text-sm font-bold sm:flex ${
                  selected ? "bg-white/20" : "bg-hover text-muted"
                }`}
              >
                {i + 1}
              </span>
            )}
            <span className="leading-snug sm:hidden">{shortAreaName(a.name)}</span>
            <span className="hidden leading-snug sm:inline">{a.name}</span>
          </button>
        );
      })}
    </div>
  );
});
