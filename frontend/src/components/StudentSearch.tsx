import { forwardRef, useId, useMemo, useState } from "react";
import { fullName, matchesStudent } from "../lib/names";
import type { Student } from "../types";

interface Props {
  students: Student[];
  value: Student | null;
  onChange: (s: Student | null) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * Cercador d'alumne per nom o codi. Teclat: escriu, ↑/↓ per moure't, Enter per triar.
 * Quan hi ha un alumne triat, es mostra com a etiqueta; Retrocés o clic el treuen.
 */
export const StudentSearch = forwardRef<HTMLInputElement, Props>(function StudentSearch(
  { students, value, onChange, autoFocus, placeholder = "Nom o codi (p. ex. «mar» o «07»)" },
  ref,
) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(
    () => students.filter((s) => matchesStudent(s, query)),
    [students, query],
  );

  const choose = (s: Student) => {
    setQuery("");
    setOpen(false);
    setActive(0);
    onChange(s);
  };

  if (value) {
    return (
      <div className="field flex items-center justify-between gap-3 text-lg">
        <span>
          <span className="mr-2 font-bold">{value.code}</span>
          {fullName(value)}
        </span>
        <button
          ref={ref as never}
          type="button"
          className="btn btn-ghost min-h-9 text-base"
          onClick={() => onChange(null)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" || e.key === "Delete") onChange(null);
          }}
        >
          Canvia
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        autoFocus={autoFocus}
        className="field text-lg"
        placeholder={placeholder}
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[active]) choose(results[active]);
          } else if (e.key === "Escape") {
            setQuery("");
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-line bg-card py-1 shadow-lg"
        >
          {results.length === 0 && <li className="px-4 py-2 text-muted">Cap alumne coincideix.</li>}
          {results.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer gap-3 px-4 py-2 ${i === active ? "bg-hover" : ""}`}
            >
              <span className="w-12 shrink-0 font-bold text-muted">{s.code}</span>
              <span>{fullName(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
