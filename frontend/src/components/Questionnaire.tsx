import { useState } from "react";
import { QUESTIONNAIRE } from "../data/questionnaire";
import { reportKey, useStore } from "../store/AppStore";
import type { Student } from "../types";

/** Qüestionari per blocs (1-7). Les respostes es desen soles. No cal respondre-ho tot. */
export function Questionnaire({ student }: { student: Student }) {
  const store = useStore();
  const key = reportKey(student.id, store.currentTerm);
  const answers = store.answers[key] ?? {};
  const [current, setCurrent] = useState(0);
  const block = QUESTIONNAIRE[current];
  const total = QUESTIONNAIRE.reduce((n, b) => n + b.sections.reduce((m, s) => m + s.questions.length, 0), 0);
  const answered = Object.values(answers).filter((a) => a.trim()).length;
  const answeredIn = (i: number) =>
    QUESTIONNAIRE[i].sections.flatMap((s) => s.questions).filter((q) => answers[q.id]?.trim()).length;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Qüestionari</h2>
        <span className="text-sm text-muted">
          Bloc {current + 1} de {QUESTIONNAIRE.length} · {answered} de {total} respostes · no cal respondre-ho tot
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Blocs del qüestionari">
        {QUESTIONNAIRE.map((b, i) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={i === current}
            title={b.name}
            onClick={() => setCurrent(i)}
            className={`min-h-10 min-w-10 rounded-full border px-3 text-base ${
              i === current
                ? "border-ink bg-ink font-bold text-white"
                : answeredIn(i)
                  ? "border-action bg-card text-ink"
                  : "border-line bg-card text-muted hover:bg-hover"
            }`}
          >
            {i + 1}
            {answeredIn(i) > 0 && i !== current ? " ✓" : ""}
          </button>
        ))}
      </div>

      <div>
        <h3 className="text-2xl font-bold">{block.name}</h3>
        <p className="text-muted">{block.subtitle}</p>
      </div>

      {block.sections.map((section, si) => (
        <div key={si} className="space-y-3">
          {section.title && <h4 className="pt-2 text-lg font-bold">{section.title}</h4>}
          {section.questions.map((q, qi) => (
            <label key={q.id} className="block">
              <span className="mb-1 block text-base">
                {section.title ? "" : `${qi + 1}. `}
                {q.text}
              </span>
              <textarea
                className="field min-h-16 leading-relaxed"
                placeholder="Escriu les teves observacions…"
                value={answers[q.id] ?? ""}
                onChange={(e) => store.setAnswer(student.id, store.currentTerm, q.id, e.target.value)}
              />
            </label>
          ))}
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button className="btn btn-secondary" disabled={current === 0} onClick={() => setCurrent(current - 1)}>
          ‹ Anterior
        </button>
        {current < QUESTIONNAIRE.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setCurrent(current + 1)}>
            Següent ›
          </button>
        ) : (
          <span className="text-sm text-muted">Últim bloc. Quan acabis, genera l'informe aquí sota.</span>
        )}
      </div>
    </section>
  );
}
