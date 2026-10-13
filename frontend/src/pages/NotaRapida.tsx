import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AreaPicker } from "../components/AreaPicker";
import { PageTitle } from "../components/Layout";
import { StudentSearch } from "../components/StudentSearch";
import { useToast } from "../components/Toast";
import { TERMS } from "../config";
import { shortAreaName } from "../lib/areas";
import { fullName } from "../lib/names";
import { formatDate, todayIso } from "../lib/text";
import { useStore } from "../store/AppStore";

type Focus = "student" | "area" | "text" | null;

const LAST_AREA_KEY = "apunt-darrera-area";

function readLastArea(): number | null {
  try {
    return Number(sessionStorage.getItem(LAST_AREA_KEY)) || null;
  } catch {
    return null;
  }
}

export default function NotaRapida() {
  const store = useStore();
  const { students, areas, notes, currentTerm } = store;
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [studentId, setStudentId] = useState<number | null>(
    () => students.find((s) => s.code === params.get("alumne"))?.id ?? null,
  );
  const [areaId, setAreaId] = useState<number | null>(() => {
    const fromUrl = Number(params.get("area"));
    const candidate = fromUrl || readLastArea();
    return areas.some((a) => a.id === candidate) ? candidate : null;
  });
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayIso());
  const [editingDate, setEditingDate] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(() =>
    studentId ? (areaId ? "text" : "area") : "student",
  );

  const studentRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const student = students.find((s) => s.id === studentId) ?? null;
  const area = areas.find((a) => a.id === areaId) ?? null;

  // Els paràmetres de l'URL només serveixen per entrar; després els traiem.
  useEffect(() => {
    if (params.size) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mou el focus després de renderitzar (el camp pot haver canviat).
  useEffect(() => {
    if (!focus) return;
    const el = { student: studentRef, area: areaRef, text: textRef }[focus].current;
    el?.focus();
    setFocus(null);
  }, [focus]);

  useEffect(() => {
    try {
      if (areaId) sessionStorage.setItem(LAST_AREA_KEY, String(areaId));
    } catch {
      /* no passa res */
    }
  }, [areaId]);

  // Dreceres globals: "/" per cercar, Alt+1…9 per triar àrea.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea, select");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setStudentId(null);
        setFocus("student");
      }
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (e.altKey && digit) {
        const a = areas[Number(digit[1]) - 1];
        if (a) {
          e.preventDefault();
          setAreaId(a.id);
          setFocus("text");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [areas]);

  const save = () => {
    if (!student) {
      setHint("Tria l'alumne.");
      setFocus("student");
      return;
    }
    if (!area) {
      setHint("Tria l'àrea.");
      setFocus("area");
      return;
    }
    if (!text.trim()) {
      setHint("Escriu la nota.");
      setFocus("text");
      return;
    }
    const note = store.addNote({
      studentId: student.id,
      areaId: area.id,
      text,
      date,
      term: currentTerm,
    });
    toast({
      message: `Desada: ${student.code} ${student.firstName} · ${shortAreaName(area.name)}`,
      action: { label: "Desfés", onClick: () => store.deleteNote(note.id) },
    });
    setHint(null);
    setText("");
    setStudentId(null); // l'àrea es manté per repassar la classe
    setFocus("student");
  };

  const recent = [...notes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const byStudent = new Map(students.map((s) => [s.id, s]));
  const byArea = new Map(areas.map((a) => [a.id, a]));

  if (!students.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Nota ràpida" />
        <p className="text-muted">
          Encara no hi ha alumnes.{" "}
          <Link to="/alumnes" className="font-bold text-ink underline">
            Afegeix la llista de la classe
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Nota ràpida" />

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <section>
          <label className="mb-2 block font-bold">1. Alumne</label>
          <StudentSearch
            ref={studentRef}
            students={students}
            value={student}
            onChange={(s) => {
              setStudentId(s?.id ?? null);
              setHint(null);
              setFocus(s ? (areaId ? "text" : "area") : "student");
            }}
          />
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <label className="font-bold">2. Àrea</label>
            <span className="hidden text-sm text-muted sm:inline">
              Tecles <span className="kbd">1</span>–<span className="kbd">{Math.min(9, areas.length)}</span>
            </span>
          </div>
          <AreaPicker
            ref={areaRef}
            areas={areas}
            value={areaId}
            onChange={(id) => {
              setAreaId(id);
              setHint(null);
              setFocus("text");
            }}
            onEscape={() => {
              setStudentId(null);
              setFocus("student");
            }}
          />
        </section>

        <section>
          <label htmlFor="nota" className="mb-2 block font-bold">
            3. Nota
          </label>
          <textarea
            id="nota"
            ref={textRef}
            rows={4}
            className="field resize-y text-lg leading-relaxed"
            placeholder={
              student && area
                ? `Què has observat de ${student.firstName} a ${shortAreaName(area.name)}?`
                : "Què has observat?"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setFocus("area");
              }
            }}
          />
        </section>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button type="submit" className="btn btn-primary px-8 text-lg">
            Desa
          </button>
          <div className="text-muted">
            Es desarà al <strong className="text-ink">{TERMS[currentTerm]}</strong>
            {" · "}
            {editingDate ? (
              <input
                type="date"
                autoFocus
                className="field inline-block min-h-9 w-auto py-1"
                value={date}
                onChange={(e) => setDate(e.target.value || todayIso())}
                onBlur={() => setEditingDate(false)}
              />
            ) : (
              <button
                type="button"
                className="underline underline-offset-4 hover:text-ink"
                onClick={() => setEditingDate(true)}
              >
                {date === todayIso() ? "avui" : formatDate(date)}
              </button>
            )}
          </div>
          {hint && <div className="warn-box py-2">{hint}</div>}
        </div>

        <p className="hidden text-sm text-muted md:block">
          <span className="kbd">Enter</span> desa · <span className="kbd">Shift</span>+
          <span className="kbd">Enter</span> nova línia · <span className="kbd">Esc</span> torna enrere ·{" "}
          <span className="kbd">/</span> cerca alumne · <span className="kbd">Alt</span>+
          <span className="kbd">1</span>… canvia l'àrea
        </p>
      </form>

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 text-lg font-bold">Últimes notes</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {recent.map((n) => {
              const s = byStudent.get(n.studentId);
              const a = byArea.get(n.areaId);
              if (!s || !a) return null;
              return (
                <li key={n.id}>
                  <Link to={`/alumne/${s.code}`} className="block px-4 py-3 hover:bg-hover">
                    <div className="text-sm text-muted">
                      <strong className="text-ink">
                        {s.code} {fullName(s)}
                      </strong>{" "}
                      · {shortAreaName(a.name)} · {formatDate(n.date)}
                    </div>
                    <div>{n.text}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
