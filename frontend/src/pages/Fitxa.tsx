import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FreeTextEditor } from "../components/FreeTextEditor";
import { NoteCard } from "../components/NoteCard";
import { useToast } from "../components/Toast";
import { TERMS } from "../config";
import { fullName } from "../lib/names";
import { plural } from "../lib/text";
import { useStore } from "../store/AppStore";
import type { Note, Term } from "../types";

export default function Fitxa() {
  const store = useStore();
  const { students, areas, notes, currentTerm } = store;
  const { code } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [termFilter, setTermFilter] = useState<Term | "tots" | "actual">("actual");
  const [toDelete, setToDelete] = useState<Note | null>(null);

  const index = students.findIndex((s) => s.code === code);
  const student = students[index];
  if (!student) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted">No existeix cap alumne amb el codi {code}.</p>
        <Link to="/classe" className="font-bold underline">
          Torna a la classe
        </Link>
      </div>
    );
  }
  const prev = students[index - 1];
  const next = students[index + 1];

  const term: Term | null =
    termFilter === "actual" ? currentTerm : termFilter === "tots" ? null : termFilter;
  const mine = notes
    .filter((n) => n.studentId === student.id && (term === null || n.term === term))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const emptyAreas = areas.filter((a) => !mine.some((n) => n.areaId === a.id));
  const termLabel = term ? ` al ${TERMS[term]}` : "";

  const filterOptions: [typeof termFilter, string][] = [
    ["actual", `${TERMS[currentTerm]} (actual)`],
    ...([1, 2, 3] as Term[]).filter((t) => t !== currentTerm).map((t) => [t, TERMS[t]] as [Term, string]),
    ["tots", "Tots"],
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-base">
        <Link to="/classe" className="text-muted hover:text-ink">
          ← Classe
        </Link>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost"
            disabled={!prev}
            onClick={() => prev && navigate(`/alumne/${prev.code}`)}
            aria-label="Alumne anterior"
          >
            ‹ Anterior
          </button>
          <button
            className="btn btn-ghost"
            disabled={!next}
            onClick={() => next && navigate(`/alumne/${next.code}`)}
            aria-label="Alumne següent"
          >
            Següent ›
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-bold text-muted">{student.code}</div>
          <h1 className="text-3xl font-bold tracking-tight">{fullName(student)}</h1>
          <p className="mt-1 text-muted">
            {plural(mine.length, "nota", "notes")}
            {termLabel}
            {emptyAreas.length > 0 && (
              <>
                {" · "}
                <span className="font-bold text-warn-ink">
                  {plural(emptyAreas.length, "àrea", "àrees")} sense notes
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/?alumne=${student.code}`} className="btn btn-primary">
            Nova nota
          </Link>
          <Link to={`/informe/${student.code}`} className="btn btn-secondary">
            Informe
          </Link>
        </div>
      </div>

      <div className="mb-8">
        <FreeTextEditor
          key={`${student.id}-${currentTerm}`}
          student={student}
          action={
            <Link to={`/informe/${student.code}`} className="btn btn-primary">
              Continua amb el qüestionari i l'informe →
            </Link>
          }
        />
      </div>

      <h2 className="mb-3 text-xl font-bold">Notes</h2>
      <div className="mb-8 flex flex-wrap gap-2" role="radiogroup" aria-label="Filtre de trimestre">
        {filterOptions.map(([value, label]) => (
          <button
            key={String(value)}
            role="radio"
            aria-checked={termFilter === value}
            onClick={() => setTermFilter(value)}
            className={`min-h-10 rounded-full border px-4 text-base ${
              termFilter === value
                ? "border-action bg-action font-bold text-white"
                : "border-line bg-card text-muted hover:bg-hover"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {areas.map((a) => {
          const areaNotes = mine.filter((n) => n.areaId === a.id);
          return (
            <section key={a.id}>
              <h2 className="mb-3 flex items-baseline gap-2 text-xl font-bold">
                {a.name}
                <span className="text-base font-normal text-muted">{areaNotes.length}</span>
              </h2>
              {areaNotes.length === 0 ? (
                <div className="warn-box flex flex-wrap items-center justify-between gap-2">
                  <span>Cap nota{termLabel}.</span>
                  <Link
                    to={`/?alumne=${student.code}&area=${a.id}`}
                    className="font-bold underline underline-offset-4"
                  >
                    Escriu-ne una
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {areaNotes.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      areas={areas}
                      onSave={(changes) => {
                        store.updateNote(n.id, changes);
                        toast({ message: "Nota actualitzada." });
                      }}
                      onDelete={() => setToDelete(n)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Esborrar aquesta nota?"
        confirmLabel="Esborra"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const n = toDelete!;
          store.deleteNote(n.id);
          setToDelete(null);
          toast({ message: "Nota esborrada.", action: { label: "Desfés", onClick: () => store.restoreNote(n) } });
        }}
      >
        «{toDelete?.text}»
      </ConfirmDialog>
    </div>
  );
}
