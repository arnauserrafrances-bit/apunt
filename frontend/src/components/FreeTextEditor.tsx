import { useState, type ReactNode } from "react";
import { TERMS } from "../config";
import { reportKey, useStore } from "../store/AppStore";
import type { Student } from "../types";

export const MAX_FREE_TEXT_CHARS = 6000;

/**
 * Text lliure sobre un alumne: la tutora hi escriu tot el que vol explicar, en l'ordre que vol.
 * En generar l'informe, la IA reparteix cada informació a l'àmbit que toca. Es desa sol.
 */
export function FreeTextEditor({
  student,
  compact = false,
  action,
}: {
  student: Student;
  compact?: boolean;
  /** Botó per continuar (classificar i generar l'informe). */
  action?: ReactNode;
}) {
  const store = useStore();
  const key = reportKey(student.id, store.currentTerm);
  const [text, setText] = useState(store.freeTexts[key] ?? "");
  const tooLong = text.length > MAX_FREE_TEXT_CHARS;

  return (
    <section className="card space-y-2 p-5">
      <label htmlFor={`free-${key}`} className="block text-xl font-bold">
        Text sobre {student.firstName} · {TERMS[store.currentTerm]}
      </label>
      {!compact && (
        <p className="text-muted">
          Escriu tot el que vulguis explicar d'aquest alumne, en l'ordre que vulguis i barrejant temes: adaptació,
          actitud, lectura, matemàtiques… En generar l'informe, la IA posarà cada cosa al paràgraf de l'àmbit que toca.
        </p>
      )}
      <textarea
        id={`free-${key}`}
        className="field min-h-56 leading-relaxed"
        placeholder="Per exemple: S'ha adaptat bé al curs i ve content. Llegeix amb fluïdesa però li costa l'entonació. En matemàtiques domina la multiplicació…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.length <= MAX_FREE_TEXT_CHARS) store.setFreeText(student.id, store.currentTerm, e.target.value);
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={tooLong ? "text-warn-ink" : "text-sm text-muted"}>
          {tooLong
            ? `El text és massa llarg (màxim ${MAX_FREE_TEXT_CHARS.toLocaleString("ca")} caràcters). No s'ha desat l'últim canvi.`
            : `Es desa automàticament · ${text.length.toLocaleString("ca")} caràcters`}
        </p>
        {text.trim() && !tooLong && action}
      </div>
    </section>
  );
}
