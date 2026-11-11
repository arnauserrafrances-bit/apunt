import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { AreaPicker } from "../components/AreaPicker";
import { LoadFakeDataButton, PageTitle } from "../components/Layout";
import { StudentSearch } from "../components/StudentSearch";
import { useToast } from "../components/Toast";
import { VoiceNote } from "../components/VoiceNote";
import { Icon, ProgressRing } from "../components/Brand";
import { fullName } from "../lib/names";
import { speechSupported } from "../lib/speech";
import { TERMS } from "../config";
import { areaColor, initials, shortAreaName } from "../lib/areas";
import { formatDate, todayIso } from "../lib/text";
import { useStore } from "../store/AppStore";
import type { Id } from "../types";

type Focus = "student" | "area" | "text" | null;

const LAST_AREA_KEY = "apunt-darrera-area";

function readLastArea(): Id | null {
  try {
    return sessionStorage.getItem(LAST_AREA_KEY);
  } catch {
    return null;
  }
}

export default function NotaRapida() {
  const store = useStore();
  const { students, areas, notes, currentTerm } = store;
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [studentId, setStudentId] = useState<Id | null>(
    () => students.find((s) => s.code === params.get("alumne"))?.id ?? null,
  );
  const [areaId, setAreaId] = useState<Id | null>(() => {
    const fromUrl = params.get("area");
    const candidate = fromUrl || readLastArea();
    return areas.some((a) => a.id === candidate) ? candidate : null;
  });
  // Pantalla inicial: nota de veu (gran) o nota manual. Si s'hi entra amb un alumne o àrea a l'URL, directament manual.
  const [mode, setMode] = useState<"home" | "manual">(() => (params.get("alumne") || params.get("area") ? "manual" : "home"));
  // Gravació: el micròfon de la barra (o de la barra lateral) hi arriba amb state.record; la targeta gran, amb un clic.
  const [recordSignal, setRecordSignal] = useState(0);
  const [voiceActive, setVoiceActive] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const canDictate = speechSupported();
  useEffect(() => {
    const r = (location.state as { record?: number } | null)?.record;
    if (!r) return;
    setMode("home");
    setRecordSignal(r);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
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
  const areaIndex = new Map(areas.map((a, i) => [a.id, i]));
  const withNotes = new Set(notes.filter((n) => n.term === currentTerm).map((n) => n.studentId)).size;
  const hour = new Date().getHours();
  const greeting = hour < 14 ? "Bon dia!" : hour < 21 ? "Bona tarda!" : "Bona nit!";
  const today = new Date().toLocaleDateString("ca", { weekday: "long", day: "numeric", month: "long" });

  if (!students.length || !areas.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageTitle title="Nota ràpida" />
        <div className="space-y-4 rounded-xl border border-line bg-card p-5">
          <p>Per començar a escriure notes, primer cal:</p>
          <ul className="list-disc space-y-1 pl-6">
            {!students.length && (
              <li>
                <Link to="/alumnes" className="font-bold underline underline-offset-4">
                  Afegir la llista de la classe
                </Link>
              </li>
            )}
            {!areas.length && (
              <li>
                <Link to="/arees" className="font-bold underline underline-offset-4">
                  Afegir les àrees
                </Link>
              </li>
            )}
          </ul>
          {store.isEmpty && (
            <div className="border-t border-line pt-4 text-muted">
              Només vols fer una prova? <LoadFakeDataButton />
            </div>
          )}
        </div>
      </div>
    );
  }

  const recentList = recent.length > 0 && (
    <section className="rounded-[20px] border border-line bg-card md:rounded-[14px]">
      <div className="flex items-baseline justify-between px-4 pt-4 pb-3 md:px-5">
        <h2 className="display text-[20px] md:text-[19px]">Últimes notes</h2>
        <Link to="/classe" className="text-sm font-bold text-action no-underline">
          Veure-les totes
        </Link>
      </div>
      <ul>
        {recent.map((n) => {
          const s = byStudent.get(n.studentId);
          const a = byArea.get(n.areaId);
          if (!s || !a) return null;
          const c = areaColor(areaIndex.get(a.id) ?? 0);
          return (
            <li key={n.id} className="border-t border-[#EEF1F6]">
              <Link to={`/alumne/${s.code}`} className="flex items-center gap-3.5 px-4 py-3 hover:bg-hover md:px-5">
                <span className="avatar h-10 w-10 text-sm md:h-9 md:w-9">{initials(s.firstName, s.lastName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-[15px]">{fullName(s)}</strong>
                    <span className="area-tag" style={{ background: c.bg, color: c.ink }}>
                      {shortAreaName(a.name)}
                    </span>
                  </span>
                  <span className="block text-[15px] leading-snug">{n.text}</span>
                </span>
                <span className="hidden text-[13px] whitespace-nowrap text-muted sm:block">{formatDate(n.date)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto max-w-[920px]">
      {mode === "home" && <VoiceNote startSignal={recordSignal} onActiveChange={setVoiceActive} />}

      {mode === "home" && !voiceActive && (
        <div className="space-y-6 md:space-y-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="display text-[34px] leading-none md:text-[32px] md:leading-tight">{greeting}</h1>
              <p className="mt-1 hidden text-[15px] text-muted md:block">
                {TERMS[currentTerm]} · {today}
              </p>
            </div>
            <div className="flex w-full items-center gap-4 rounded-[22px] border border-line bg-card px-4 py-3.5 md:w-auto md:rounded-[14px] md:py-2.5">
              <ProgressRing value={withNotes} total={students.length} size={52} />
              <span className="flex flex-col">
                <strong className="text-[16px]">
                  {withNotes} de {students.length} alumnes
                </strong>
                <span className="text-sm text-muted">ja tenen notes aquest trimestre</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
            <button
              type="button"
              disabled={!canDictate}
              onClick={() => setRecordSignal(Date.now())}
              className="hidden items-center gap-[18px] rounded-[16px] bg-action px-6 py-[22px] text-left text-white shadow-[0_4px_14px_rgba(27,47,94,0.18)] transition hover:bg-action-hover disabled:opacity-50 md:flex"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-marker text-ink">
                <Icon name="mic" size={28} stroke={4} />
              </span>
              <span className="flex flex-col gap-1">
                <strong className="display text-[20px]">Grava una nota de veu</strong>
                <span className="text-sm text-white/80">
                  {canDictate
                    ? "Digues el nom i què has vist: Apunt la reparteix per àrees."
                    : "Aquest navegador no permet dictar. Fes servir Chrome o Safari."}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("manual");
                setFocus(studentId ? (areaId ? "text" : "area") : "student");
              }}
              className="flex items-center gap-4 rounded-[20px] border border-line bg-card px-4 py-3.5 text-left transition hover:bg-hover md:gap-[18px] md:rounded-[16px] md:px-6 md:py-[22px]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-paper text-ink md:h-14 md:w-14">
                <Icon name="pen" size={30} highlight="#5FD3B3" />
              </span>
              <span className="flex flex-col gap-0.5">
                <strong className="display text-[17px] md:text-[20px]">Crea una nota manualment</strong>
                <span className="text-sm text-muted">Tria l'alumne i l'àrea i escriu. Enter per desar.</span>
              </span>
            </button>
          </div>

          {recentList}
        </div>
      )}

      {mode === "manual" && (
        <div className="max-w-2xl">
          <button type="button" className="btn btn-ghost -ml-3 mb-2" onClick={() => setMode("home")}>
            ← Nota de veu o manual
          </button>
          <PageTitle title="Nota escrita" />
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
          {recentList && <div className="mt-10">{recentList}</div>}
        </div>
      )}
    </div>
  );
}
