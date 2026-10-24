import { useState } from "react";
import { Link } from "react-router";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageTitle } from "../components/Layout";
import { useToast } from "../components/Toast";
import { formatCode, fullName } from "../lib/names";
import { plural } from "../lib/text";
import { useStore } from "../store/AppStore";
import type { Id, Student } from "../types";

interface BulkResult {
  added: Student[];
  invalid: string[];
  duplicates: string[];
}

export default function Alumnes() {
  const store = useStore();
  const { students, notes } = store;
  const toast = useToast();

  const [bulk, setBulk] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [oneError, setOneError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Student | null>(null);

  const noteCount = (id: Id) => notes.filter((n) => n.studentId === id).length;
  const deleteCount = toDelete ? noteCount(toDelete.id) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageTitle
        title="Alumnes"
        subtitle="Cada alumne rep un codi (A-01, A-02…) que no canvia mai. A la IA només li arriba el codi."
      />

      <section>
        <h2 className="text-xl font-bold">Enganxa la llista de la classe</h2>
        <p className="mb-3 text-muted">
          Un alumne per línia: «Nom Cognoms». Si el nom és compost, escriu «Cognoms, Nom».
        </p>
        <textarea
          rows={6}
          className="field resize-y"
          placeholder={"Maria Puig Soler\nJordi Vila Roca\nGarcía López, Ana María"}
          value={bulk}
          onChange={(e) => setBulk(e.target.value)}
        />
        <button
          className="btn btn-primary mt-3"
          disabled={!bulk.trim()}
          onClick={() => {
            const r = store.addStudents(bulk);
            setResult(r);
            // Deixem a la caixa només les línies que han fallat, per corregir-les.
            setBulk([...r.invalid, ...r.duplicates].join("\n"));
          }}
        >
          Afegeix alumnes
        </button>

        {result && (
          <div className="mt-4 space-y-2">
            {result.added.length > 0 && (
              <div className="rounded-lg border border-line bg-card px-4 py-3">
                S'han afegit {plural(result.added.length, "alumne", "alumnes")}:{" "}
                {result.added.map((s) => `${s.code} ${fullName(s)}`).join(", ")}.
              </div>
            )}
            {result.invalid.length > 0 && (
              <div className="warn-box">
                <strong>No s'han afegit</strong> perquè falta el nom o els cognoms (calen com a mínim
                dues paraules):
                <ul className="mt-1 list-disc pl-6">
                  {result.invalid.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.duplicates.length > 0 && (
              <div className="warn-box">
                <strong>No s'han afegit</strong> perquè ja són a la classe:
                <ul className="mt-1 list-disc pl-6">
                  {result.duplicates.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Afegeix un alumne</h2>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const r = store.addStudent(first, last);
            if (typeof r === "string") return setOneError(r);
            setOneError(null);
            setFirst("");
            setLast("");
            toast({ message: `Afegit: ${r.code} ${fullName(r)}` });
          }}
        >
          <label className="text-sm text-muted">
            Nom
            <input className="field mt-1 text-base text-ink" value={first} onChange={(e) => setFirst(e.target.value)} />
          </label>
          <label className="text-sm text-muted">
            Cognoms
            <input className="field mt-1 text-base text-ink" value={last} onChange={(e) => setLast(e.target.value)} />
          </label>
          <button className="btn btn-primary">Afegeix</button>
        </form>
        {oneError && <div className="warn-box mt-2">{oneError}</div>}
      </section>

      <section>
        <h2 className="mb-1 text-xl font-bold">La classe ({students.length})</h2>
        <p className="mb-3 text-sm text-muted">
          El pròxim alumne serà {formatCode(store.nextStudentNumber)}.
        </p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {students.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2">
              <span className="w-12 shrink-0 font-bold text-muted">{s.code}</span>
              <Link to={`/alumne/${s.code}`} className="min-w-0 flex-1 hover:underline">
                {fullName(s)}
              </Link>
              <span className="hidden text-sm text-muted sm:inline">
                {plural(noteCount(s.id), "nota", "notes")}
              </span>
              <button className="btn btn-ghost min-h-9 text-base hover:text-danger" onClick={() => setToDelete(s)}>
                Esborra
              </button>
            </li>
          ))}
          {students.length === 0 && <li className="px-4 py-3 text-muted">Encara no hi ha cap alumne.</li>}
        </ul>
      </section>

      <ConfirmDialog
        open={!!toDelete}
        title={toDelete ? `Esborrar ${toDelete.code} ${fullName(toDelete)}?` : ""}
        confirmLabel={deleteCount ? `Esborra l'alumne i ${plural(deleteCount, "nota", "notes")}` : "Esborra l'alumne"}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          store.deleteStudent(toDelete!.id);
          toast({ message: `S'ha esborrat ${toDelete!.code}.` });
          setToDelete(null);
        }}
      >
        {deleteCount > 0 ? (
          <p>
            Això també esborrarà <strong className="text-ink">{plural(deleteCount, "nota", "notes")}</strong>{" "}
            i el seu informe, si en té.
          </p>
        ) : (
          <p>No té cap nota.</p>
        )}
        <p className="mt-2">El codi {toDelete?.code} no es tornarà a fer servir.</p>
      </ConfirmDialog>
    </div>
  );
}
