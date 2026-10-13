import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageTitle } from "../components/Layout";
import { TERMS } from "../config";
import { shortAreaName } from "../lib/areas";
import { fullName } from "../lib/names";
import { plural } from "../lib/text";
import { useStore } from "../store/AppStore";

export default function Classe() {
  const { students, areas, notes, currentTerm } = useStore();
  const navigate = useNavigate();
  const [sortByGaps, setSortByGaps] = useState(false);

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of notes) {
      if (n.term !== currentTerm) continue;
      const k = `${n.studentId}-${n.areaId}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const r = students.map((s) => {
      const perArea = areas.map((a) => counts.get(`${s.id}-${a.id}`) ?? 0);
      return { student: s, perArea, gaps: perArea.filter((c) => c === 0).length };
    });
    if (sortByGaps) r.sort((a, b) => b.gaps - a.gaps || a.student.code.localeCompare(b.student.code));
    return r;
  }, [students, areas, notes, currentTerm, sortByGaps]);

  const withGaps = rows.filter((r) => r.gaps > 0).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageTitle
        title="Classe"
        subtitle={
          <>
            {TERMS[currentTerm]} · {plural(students.length, "alumne", "alumnes")}
            {withGaps > 0 && (
              <>
                {" · "}
                <span className="font-bold text-warn-ink">
                  {withGaps} amb àrees sense notes
                </span>
              </>
            )}
          </>
        }
      >
        <div className="flex rounded-lg border border-line bg-card p-0.5 text-base">
          {[
            [false, "Per codi"],
            [true, "Més buits primer"],
          ].map(([value, label]) => (
            <button
              key={String(value)}
              onClick={() => setSortByGaps(value as boolean)}
              className={`min-h-10 rounded-md px-3 ${
                sortByGaps === value ? "bg-action font-bold text-white" : "text-muted hover:bg-hover"
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>
      </PageTitle>

      {students.length === 0 && (
        <p className="text-muted">
          Encara no hi ha alumnes.{" "}
          <Link to="/alumnes" className="font-bold text-ink underline">
            Afegeix-los
          </Link>
          .
        </p>
      )}

      {/* Taula (portàtil) */}
      {students.length > 0 && (
        <div className="hidden overflow-x-auto rounded-xl border border-line bg-card md:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th className="sticky left-0 bg-card px-4 py-3 font-normal">Alumne</th>
                {areas.map((a) => (
                  <th key={a.id} title={a.name} className="px-2 py-3 text-center font-normal">
                    {shortAreaName(a.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ student: s, perArea, gaps }) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/alumne/${s.code}`)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-hover"
                >
                  <td className="sticky left-0 bg-inherit px-4 py-2">
                    <Link
                      to={`/alumne/${s.code}`}
                      className="whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="mr-2 font-bold text-muted">{s.code}</span>
                      {fullName(s)}
                    </Link>
                    {gaps > 0 && <span className="sr-only">, {gaps} àrees sense notes</span>}
                  </td>
                  {perArea.map((c, i) => (
                    <td key={areas[i].id} className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex h-8 min-w-10 items-center justify-center rounded-md ${
                          c === 0 ? "bg-warn-bg font-bold text-warn-ink" : ""
                        }`}
                        title={`${areas[i].name}: ${plural(c, "nota", "notes")}`}
                      >
                        {c}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Targetes (mòbil) */}
      <ul className="space-y-3 md:hidden">
        {rows.map(({ student: s, perArea, gaps }) => (
          <li key={s.id}>
            <Link to={`/alumne/${s.code}`} className="card block p-4 active:bg-hover">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <span className="mr-2 font-bold text-muted">{s.code}</span>
                  {fullName(s)}
                </div>
                {gaps > 0 && (
                  <span className="shrink-0 text-sm font-bold text-warn-ink">
                    {gaps} sense notes
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {perArea.map((c, i) => (
                  <span
                    key={areas[i].id}
                    className={`rounded-md px-2 py-0.5 text-sm ${
                      c === 0 ? "bg-warn-bg font-bold text-warn-ink" : "bg-hover text-muted"
                    }`}
                  >
                    {shortAreaName(areas[i].name)} {c}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {students.length > 0 && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted">
          <span className="inline-block h-4 w-6 rounded bg-warn-bg" /> Sense cap nota en aquesta
          àrea al {TERMS[currentTerm]}. Clica un alumne per veure la fitxa.
        </p>
      )}
    </div>
  );
}
