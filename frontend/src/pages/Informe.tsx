import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChatPanel, type Quote } from "../components/ChatPanel";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FreeTextEditor } from "../components/FreeTextEditor";
import { Questionnaire } from "../components/Questionnaire";
import { ALL_QUESTIONS, QUESTIONNAIRE } from "../data/questionnaire";
import { PageTitle } from "../components/Layout";
import { StudentSearch } from "../components/StudentSearch";
import { useToast } from "../components/Toast";
import { TERMS } from "../config";
import { areaReportText, fakeAreaReport } from "../data/fakeReport";
import { CLOSING_ID, CLOSING_NAME, loadAccessCode, requestAiReport, saveAccessCode } from "../lib/aiReport";
import { deanonymizeWithArticles, guessGenders } from "../lib/articles";
import { buildLetter } from "../lib/letter";
import {
  analyze,
  countNameLeaks,
  pendingAsks,
  resolve,
  type Decision,
  type Segment,
} from "../lib/anonymize";
import { fullName } from "../lib/names";
import { formatDate, plural, todayIso } from "../lib/text";
import { reportKey, useStore } from "../store/AppStore";
import type { Area, AreaReport, Id, Note, Report, Student } from "../types";

// ------------------------------------------------------------------ Llista

export function InformeIndex() {
  const { students, reports, currentTerm } = useStore();
  const navigate = useNavigate();

  const status = (s: Student) => {
    const r = reports[reportKey(s.id, currentTerm)];
    if (!r) return null;
    const ok = r.areas.filter((a) => a.approved).length;
    return ok === r.areas.length ? "Aprovat" : `En revisió (${ok}/${r.areas.length})`;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Informe" subtitle={`${TERMS[currentTerm]} · Tria l'alumne`} />
      <Steps current={1} />
      <StudentSearch
        autoFocus
        students={students}
        value={null}
        onChange={(s) => s && navigate(`/informe/${s.code}`)}
      />
      <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-card">
        {students.map((s) => {
          const st = status(s);
          return (
            <li key={s.id}>
              <Link to={`/informe/${s.code}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover">
                <span className="w-12 shrink-0 font-bold text-muted">{s.code}</span>
                <span className="flex-1">{fullName(s)}</span>
                {st && <span className="text-sm text-muted">{st}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ["Alumne", "Què s'envia", "Revisa i aprova", "Copia"];
  return (
    <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-1 text-base">
      {steps.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span className="text-line">—</span>}
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                n === current ? "bg-action text-white" : n < current ? "bg-hover text-ink" : "border border-line text-muted"
              }`}
            >
              {n < current ? "✓" : n}
            </span>
            <span className={n === current ? "font-bold" : "text-muted"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ Alumne

export function InformeAlumne() {
  const store = useStore();
  const { code } = useParams();
  const student = store.students.find((s) => s.code === code);
  const report = student ? store.reports[reportKey(student.id, store.currentTerm)] : undefined;

  if (!student) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted">No existeix cap alumne amb el codi {code}.</p>
        <Link to="/informe" className="font-bold underline">
          Torna a la llista
        </Link>
      </div>
    );
  }

  const allApproved = !!report && report.areas.every((a) => a.approved);

  return (
    <div className={`mx-auto ${report ? "max-w-6xl" : "max-w-3xl"}`}>
      <Link to="/informe" className="text-base text-muted hover:text-ink">
        ← Tots els alumnes
      </Link>
      <div className="mt-3">
        <PageTitle
          title={fullName(student)}
          subtitle={`${student.code} · Informe del ${TERMS[store.currentTerm]}`}
        />
      </div>
      <Steps current={!report ? 2 : allApproved ? 4 : 3} />
      {report ? (
        <Review student={student} report={report} />
      ) : (
        <Preview key={`${student.id}-${store.currentTerm}`} student={student} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Pas 2: què s'envia

const INSTRUCTIONS =
  "Escriu en català un paràgraf per a cada àrea sobre l'alumne indicat, amb l'estil d'un informe a la família. " +
  "Fes servir només la informació de les notes. No inventis res i no exageris.";

interface NoteSegments {
  note: Note;
  segments: Segment[];
}

function Preview({ student }: { student: Student }) {
  const store = useStore();
  const { students, areas, notes, currentTerm } = store;
  const free = store.freeTexts[reportKey(student.id, currentTerm)] ?? "";
  const hasFree = free.trim().length > 0;
  const freeNote: Note = useMemo(
    () => ({ id: "free", studentId: student.id, areaId: "", text: free, date: todayIso(), term: currentTerm, createdAt: 0 }),
    [free, student.id, currentTerm],
  );
  const freeSegments = useMemo(() => (free.trim() ? analyze(free, students, "free:") : []), [free, students]);
  const answers = store.answers[reportKey(student.id, currentTerm)];
  const answerItems = useMemo(
    () =>
      ALL_QUESTIONS.filter((q) => answers?.[q.id]?.trim()).map((q) => {
        const text = answers![q.id].trim();
        const note: Note = { id: `q${q.id}`, studentId: student.id, areaId: q.blockId, text, date: todayIso(), term: currentTerm, createdAt: 0 };
        return { q, note, segments: analyze(text, students, `q${q.id}:`) };
      }),
    [answers, student.id, currentTerm, students],
  );
  const hasQ = answerItems.length > 0;
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [phase, setPhase] = useState<"idle" | "writing" | "reviewing">("idle");
  const [accessCode, setAccessCode] = useState(loadAccessCode);
  const [aiError, setAiError] = useState<string | null>(null);
  const useAi = accessCode.trim().length > 0;

  const byArea = useMemo(() => {
    const list: { area: Area; items: NoteSegments[] }[] = [];
    for (const area of areas) {
      const items = notes
        .filter((n) => n.studentId === student.id && n.areaId === area.id && n.term === currentTerm)
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
        .map((note) => ({ note, segments: analyze(note.text, students, `${note.id}:`) }));
      list.push({ area, items });
    }
    return list;
  }, [areas, notes, students, student.id, currentTerm]);

  const withNotes = byArea.filter((a) => a.items.length);
  const empty = byArea.filter((a) => !a.items.length).map((a) => a.area);
  const allItems = [
    ...withNotes.flatMap((a) => a.items),
    ...(hasFree ? [{ note: freeNote, segments: freeSegments }] : []),
    ...answerItems.map(({ note, segments }) => ({ note, segments })),
  ];
  const asks = allItems.flatMap(({ note, segments }) =>
    segments.flatMap((s) => (s.kind === "ask" ? [{ note, ask: s }] : [])),
  );
  const pending = allItems.flatMap((i) => pendingAsks(i.segments, decisions)).length;

  const outgoing = [
    INSTRUCTIONS,
    "",
    `Alumne: ${student.code}`,
    `Trimestre: ${TERMS[currentTerm]}`,
    ...withNotes.flatMap(({ area, items }) => [
      "",
      area.name,
      ...items.map(({ note, segments }) => `- ${formatDate(note.date)}: ${resolve(segments, decisions, students)}`),
    ]),
    ...(hasFree ? ["", "Text lliure de la tutora:", resolve(freeSegments, decisions, students)] : []),
    ...QUESTIONNAIRE.flatMap((b) => {
      const items = answerItems.filter((a) => a.q.blockId === b.id);
      return items.length
        ? ["", `Qüestionari · ${b.name}`, ...items.map((a) => `- ${a.q.text} → ${resolve(a.segments, decisions, students)}`)]
        : [];
    }),
  ].join("\n");
  const leaks = countNameLeaks(outgoing, students);
  const replaced =
    allItems.flatMap((i) => i.segments).filter((s) => s.kind === "name").length +
    Object.values(decisions).filter((d) => d !== "word").length;
  const markedWords = Object.values(decisions).filter((d) => d === "word").length;

  const generate = () => (useAi ? generateWithAi() : generateSimulated());

  const generateWithAi = async () => {
    setAiError(null);
    setPhase("writing");
    saveAccessCode(accessCode.trim());
    try {
      const notesAsText = withNotes
        .flatMap(({ area, items }) => items.map((i) => `- (${area.name}) ${resolve(i.segments, decisions, students)}`))
        .join("\n");
      const aiAreas = await requestAiReport(
        accessCode.trim(),
        student.code,
        TERMS[currentTerm],
        hasQ
          ? QUESTIONNAIRE.filter((b) => hasFree || notesAsText || answerItems.some((a) => a.q.blockId === b.id)).map((b) => ({
              areaId: b.id,
              areaName: b.name,
              notes: answerItems
                .filter((a) => a.q.blockId === b.id)
                .map((a) => ({
                  date: "",
                  text: `Pregunta: ${a.q.section ? `(${a.q.section}) ` : ""}${a.q.text}\nResposta: ${resolve(a.segments, decisions, students)}`,
                })),
            }))
          : (hasFree ? byArea : withNotes).map(({ area, items }) => ({
          areaId: area.id,
          areaName: area.name,
          notes: items.map(({ note, segments }) => ({
            date: formatDate(note.date),
            text: resolve(segments, decisions, students),
          })),
        })),
        store.reportGuide,
        [hasFree ? resolve(freeSegments, decisions, students) : "", hasQ && notesAsText ? `Altres notes del trimestre:\n${notesAsText}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        store.exampleReport,
      );
      store.saveReport({
        studentId: student.id,
        term: currentTerm,
        emptyAreaIds: hasQ ? [] : areas.filter((a) => !aiAreas.some((r) => r.areaId === a.id)).map((a) => a.id),
        areas: aiAreas,
      });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Error desconegut.");
      setPhase("idle");
    }
  };

  const generateSimulated = () => {
    setPhase("writing");
    window.setTimeout(() => setPhase("reviewing"), 1200);
    window.setTimeout(() => {
      // Simulat: el text lliure va tot a la primera àrea (la IA real el reparteix).
      if (hasQ) {
        const blocks = QUESTIONNAIRE.filter((b) => answerItems.some((a) => a.q.blockId === b.id));
        store.saveReport({
          studentId: student.id,
          term: currentTerm,
          emptyAreaIds: [],
          areas: blocks.map((b, i) =>
            fakeAreaReport(
              b.id,
              i + 1,
              student.code,
              answerItems.filter((a) => a.q.blockId === b.id).map((a) => resolve(a.segments, decisions, students)),
              students.indexOf(student) + 1,
            ),
          ),
        });
        return;
      }
      const sim = byArea
        .map(({ area, items }, i) => ({
          area,
          texts: [
            ...items.map((it) => resolve(it.segments, decisions, students)),
            ...(i === 0 && hasFree ? [resolve(freeSegments, decisions, students)] : []),
          ],
        }))
        .filter((a) => a.texts.length);
      const report: Report = {
        studentId: student.id,
        term: currentTerm,
        emptyAreaIds: areas.filter((a) => !sim.some((x) => x.area.id === a.id)).map((a) => a.id),
        areas: sim.map(({ area, texts }) =>
          fakeAreaReport(area.id, areas.indexOf(area) + 1, student.code, texts, students.indexOf(student) + 1),
        ),
      };
      store.saveReport(report);
    }, 2200);
  };

  if (!withNotes.length && !hasFree && !hasQ) {
    return (
      <div className="space-y-6">
        <FreeTextEditor student={student} />
        <Questionnaire student={student} />
        <div className="warn-box">
          Escriu un petit text sobre {student.firstName}, respon algunes preguntes del qüestionari o{" "}
          <Link to={`/?alumne=${student.code}`} className="font-bold underline">
            afegeix notes
          </Link>{" "}
          per poder fer l'informe.
        </div>
      </div>
    );
  }

  if (phase !== "idle") {
    return (
      <div className="card flex items-center gap-4 p-6 text-lg">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-action" />
        {useAi
          ? "La IA està redactant i revisant l'informe… (uns 20-40 segons)"
          : phase === "writing"
            ? "Redactant l'informe…"
            : "Revisant cada frase amb les notes…"}
        {!useAi && <span className="text-sm text-muted">(simulat)</span>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FreeTextEditor student={student} compact />
      <Questionnaire student={student} />

      {asks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">
            {pending > 0
              ? `Decideix ${plural(pending, "paraula", "paraules")}`
              : "Paraules decidides"}
          </h2>
          <p className="text-muted">
            No sabem segur si aquestes paraules són un nom. Si ho són, es canviaran pel codi.
          </p>
          {asks.map(({ note, ask }) => (
            <AskCard
              key={ask.id}
              note={note}
              ask={ask}
              students={students}
              decision={decisions[ask.id]}
              onDecide={(d) => setDecisions((prev) => ({ ...prev, [ask.id]: d }))}
            />
          ))}
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold">Això és exactament el que s'enviarà</h2>
        <p className="mb-3 text-muted">
          Els noms ja són codis. <span className="rounded bg-hover px-1 font-bold text-ink">A-01</span>{" "}
          = nom canviat.
        </p>
        <div className="card p-5 leading-relaxed whitespace-pre-wrap">
          <p className="text-muted">{INSTRUCTIONS}</p>
          {useAi && store.reportGuide && (
            <details className="mt-3 text-muted">
              <summary className="cursor-pointer">
                + El model d'informe de l'escola ({store.reportGuide.length.toLocaleString("ca")} caràcters)
              </summary>
              <p className="mt-2 text-sm">{store.reportGuide}</p>
            </details>
          )}
          <p className="mt-4">
            Alumne: <Code>{student.code}</Code>
            {"\n"}Trimestre: {TERMS[currentTerm]}
          </p>
          {withNotes.map(({ area, items }) => (
            <div key={area.id} className="mt-4">
              <div className="font-bold">{area.name}</div>
              {items.map(({ note, segments }) => (
                <div key={note.id}>
                  - {formatDate(note.date)}: <Segments segments={segments} decisions={decisions} students={students} />
                </div>
              ))}
            </div>
          ))}
          {hasFree && (
            <div className="mt-4">
              <div className="font-bold">Text lliure de la tutora</div>
              <Segments segments={freeSegments} decisions={decisions} students={students} />
            </div>
          )}
          {QUESTIONNAIRE.map((b) => {
            const items = answerItems.filter((x) => x.q.blockId === b.id);
            if (!items.length) return null;
            return (
              <div key={b.id} className="mt-4">
                <div className="font-bold">Qüestionari · {b.name}</div>
                {items.map(({ q, segments }) => (
                  <div key={q.id}>
                    - <span className="text-muted">{q.text}</span> →{" "}
                    <Segments segments={segments} decisions={decisions} students={students} />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {hasQ ? (
        <div className="card p-4 text-muted">
          {useAi
            ? "La IA escriurà un paràgraf per a cada bloc del qüestionari que hagis respost, seguint el model de l'escola i l'informe d'exemple."
            : "Informe simulat: les respostes es copien tal qual. Amb el codi d'accés, la IA redactarà l'informe."}
        </div>
      ) : hasFree ? (
        <div className="card p-4 text-muted">
          {useAi
            ? "La IA repartirà el text entre les àrees i escriurà un paràgraf per a cada àrea de què parli. Les àrees de què no hi hagi res quedaran buides."
            : "Informe simulat: el text lliure anirà tot a la primera àrea. Amb el codi d'accés, la IA el repartirà per àrees."}
        </div>
      ) : (
        empty.length > 0 && (
          <div className="warn-box">
            <strong>Sense notes, no s'escriurà res:</strong> {empty.map((a) => a.name).join(", ")}.
          </div>
        )
      )}

      <section className="card space-y-1 p-5">
        <Check ok>{plural(replaced, "nom canviat", "noms canviats")} per codis</Check>
        {markedWords > 0 && (
          <Check ok>{plural(markedWords, "paraula marcada", "paraules marcades")} com a normals</Check>
        )}
        <Check ok={pending === 0}>
          {pending === 0 ? "Cap paraula pendent de decidir" : `${plural(pending, "paraula", "paraules")} per decidir`}
        </Check>
        <Check ok={leaks === 0}>
          {leaks === 0 ? "Comprovació final: cap nom real al text" : `Comprovació final: queden ${leaks} noms`}
        </Check>
      </section>

      <section className="card space-y-2 p-5">
        <label className="block font-bold" htmlFor="access-code">
          Codi d'accés a la IA
        </label>
        <input
          id="access-code"
          type="password"
          autoComplete="off"
          className="field max-w-xs"
          placeholder="Sense codi: informe simulat"
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
        />
        <p className="text-sm text-muted">
          {useAi
            ? "S'enviarà el text de dalt (només amb codis) a la IA real."
            : "Sense codi, l'informe és simulat i no s'envia res enlloc."}
        </p>
        {useAi && (
          <p className="text-sm text-muted">
            {store.reportGuide ? "La IA seguirà el model d'informe de l'escola. " : "Encara no has afegit el model d'informe de l'escola. "}
            <Link to="/model" className="underline">
              {store.reportGuide ? "Revisa'l" : "Afegeix-lo"}
            </Link>
          </p>
        )}
      </section>

      {aiError && (
        <div className="warn-box" role="alert">
          <strong>No s'ha pogut generar l'informe:</strong> {aiError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn btn-primary px-6 text-lg" disabled={pending > 0 || leaks > 0} onClick={generate}>
          {useAi ? "Confirma i genera l'informe amb IA" : "Genera un informe simulat"}
        </button>
        {pending > 0 && <span className="text-warn-ink">Primer decideix les paraules de dalt.</span>}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return <span className="rounded bg-hover px-1 font-bold">{children}</span>;
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div className={`flex gap-2 ${ok ? "" : "font-bold text-warn-ink"}`}>
      <span aria-hidden>{ok ? "✓" : "!"}</span>
      <span>{children}</span>
    </div>
  );
}

function Segments({
  segments,
  decisions,
  students,
}: {
  segments: Segment[];
  decisions: Record<string, Decision>;
  students: Student[];
}) {
  return (
    <>
      {segments.map((s, i) => {
        if (s.kind === "text") return <Fragment key={i}>{s.text}</Fragment>;
        if (s.kind === "name") return <Code key={i}>{s.code}</Code>;
        const d = decisions[s.id];
        if (d === undefined) {
          return (
            <a
              key={i}
              href={`#ask-${s.id}`}
              className="rounded bg-warn-bg px-1 font-bold text-warn-ink underline decoration-dotted"
              title="Pendent de decidir: no s'enviarà fins que ho decideixis"
            >
              ?
            </a>
          );
        }
        if (d === "word") return <Fragment key={i}>{s.original}</Fragment>;
        return <Code key={i}>{students.find((st) => st.id === d)?.code ?? "?"}</Code>;
      })}
    </>
  );
}

function AskCard({
  note,
  ask,
  students,
  decision,
  onDecide,
}: {
  note: Note;
  ask: Extract<Segment, { kind: "ask" }>;
  students: Student[];
  decision: Decision | undefined;
  onDecide: (d: Decision) => void;
}) {
  const start = Number(ask.id.split(":")[1]);
  const before = note.text.slice(0, start);
  const after = note.text.slice(start + ask.original.length);
  const choice = (d: Decision, label: string) => (
    <button
      key={String(d)}
      onClick={() => onDecide(d)}
      aria-pressed={decision === d}
      className={`btn min-h-10 border text-base ${
        decision === d ? "border-action bg-action text-white" : "border-line bg-card font-normal hover:bg-hover"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div
      id={`ask-${ask.id}`}
      className={`scroll-mt-24 rounded-xl border p-4 ${decision === undefined ? "border-warn-line bg-warn-bg" : "border-line bg-card"}`}
    >
      <p className="text-lg">
        «{before}
        <mark className="rounded bg-white px-1 font-bold text-ink ring-2 ring-warn-line">{ask.original}</mark>
        {after}»
      </p>
      <p className="mt-1 text-sm text-muted">{ask.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ask.candidates.map((id) => {
          const s = students.find((st) => st.id === id)!;
          return choice(id, `És ${s.code} · ${fullName(s)}`);
        })}
        {ask.allowWord && choice("word", "És una paraula normal")}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Pas 3 i 4: revisa, aprova i copia

function Review({ student, report }: { student: Student; report: Report }) {
  const store = useStore();
  const toast = useToast();
  const [showNames, setShowNames] = useState(false);
  const [restart, setRestart] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selection, setSelection] = useState<(Quote & { x: number; y: number }) | null>(null);
  const chatInput = useRef<HTMLTextAreaElement>(null);

  // Quan la tutora marca text dins d'un paràgraf, apareix el botó «Assistència».
  useEffect(() => {
    const check = () =>
      window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? "";
        if (!sel || sel.isCollapsed || !text || !sel.rangeCount) return setSelection(null);
        const host = (n: Node | null) => (n instanceof Element ? n : n?.parentElement)?.closest("[data-area-id]");
        const a = host(sel.anchorNode);
        if (!a || a !== host(sel.focusNode)) return setSelection(null);
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({ areaId: a.getAttribute("data-area-id")!, text, x: r.left + r.width / 2, y: r.bottom });
      }, 0);
    document.addEventListener("mouseup", check);
    document.addEventListener("touchend", check);
    document.addEventListener("keyup", check);
    return () => {
      document.removeEventListener("mouseup", check);
      document.removeEventListener("touchend", check);
      document.removeEventListener("keyup", check);
    };
  }, []);

  const areaById = new Map<Id, Area>([
    ...store.areas.map((a) => [a.id, a] as const),
    ...QUESTIONNAIRE.map((b) => [b.id, { id: b.id, name: b.name }] as const),
    [CLOSING_ID, { id: CLOSING_ID, name: CLOSING_NAME }],
  ]);
  const ordered = [...store.areas.map((a) => a.id), ...QUESTIONNAIRE.map((b) => b.id), CLOSING_ID]
    .map((id) => report.areas.find((r) => r.areaId === id))
    .filter((r): r is AreaReport => !!r);
  const approved = ordered.filter((a) => a.approved).length;
  const allApproved = approved === ordered.length;
  const empty = report.emptyAreaIds.map((id) => areaById.get(id)?.name).filter(Boolean);

  const updateArea = (areaId: Id, changes: Partial<AreaReport>) =>
    store.saveReport({
      ...report,
      areas: report.areas.map((a) => (a.areaId === areaId ? { ...a, ...changes } : a)),
    });

  const paragraphs = ordered.map((r) => areaReportText(r));
  const genders = guessGenders(paragraphs.join("\n"));
  const display = (t: string) => (showNames ? deanonymizeWithArticles(t, store.students, genders) : t);
  // Si es veuen els noms, el fragment marcat els porta: els tornem a canviar pels codis abans d'enviar-lo.
  const toCodes = (t: string) =>
    showNames
      ? store.students.reduce(
          (acc, st) => acc.replace(new RegExp(`(?<![\\p{L}])${st.firstName}(?![\\p{L}])`, "gu"), st.code),
          t,
        )
      : t;
  const askAssistance = () => {
    if (!selection) return;
    setQuote({ areaId: selection.areaId, text: toCodes(selection.text) });
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    window.setTimeout(() => chatInput.current?.focus(), 0);
  };

  const finalText = [
    `${fullName(student)} · ${TERMS[report.term]}`,
    "",
    buildLetter(student, report.term, paragraphs, store.students),
  ].join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(finalText);
      toast({ message: "Informe copiat amb els noms. Ja el pots enganxar." });
    } catch {
      toast({ message: "No s'ha pogut copiar. Selecciona el text i copia'l a mà." });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    {selection && (
      <button
        className="btn btn-primary fixed z-40 min-h-9 -translate-x-1/2 px-3 text-base shadow-lg"
        style={{ left: selection.x, top: selection.y + 8 }}
        onMouseDown={(e) => e.preventDefault()}
        onClick={askAssistance}
      >
        ✦ Assistència
      </button>
    )}
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg">
          <strong>
            {approved} de {ordered.length}
          </strong>{" "}
          àrees aprovades
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-base text-muted hover:bg-hover">
            <input type="checkbox" className="h-5 w-5 accent-action" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} />
            Mostra els noms
          </label>
          {!allApproved && (
            <button
              className="btn btn-secondary text-base"
              onClick={() => store.saveReport({ ...report, areas: report.areas.map((a) => ({ ...a, approved: true })) })}
            >
              Aprova-ho tot
            </button>
          )}
          <button className="btn btn-ghost text-base" onClick={() => setRestart(true)}>
            Torna a començar
          </button>
        </div>
      </div>

      {empty.length > 0 && (
        <div className="warn-box">
          <strong>No s'ha escrit res per a</strong> {empty.join(", ")}: no hi havia notes.
        </div>
      )}

      {ordered.map((r) => (
        <AreaReportCard
          key={r.areaId}
          area={areaById.get(r.areaId)!}
          report={r}
          display={display}
          onChange={(changes) => updateArea(r.areaId, changes)}
        />
      ))}

      <section className={`card p-5 ${allApproved ? "border-action" : ""}`}>
        <h2 className="text-xl font-bold">Informe final</h2>
        {allApproved ? (
          <>
            <p className="mb-3 text-muted">
              Els codis s'han canviat pels noms aquí, al teu ordinador.
            </p>
            <div className="max-h-96 overflow-auto rounded-lg bg-paper p-4 leading-relaxed whitespace-pre-wrap">
              {finalText}
            </div>
            <button className="btn btn-primary mt-4 px-6 text-lg" onClick={copy}>
              Copia l'informe
            </button>
          </>
        ) : (
          <p className="mt-1 text-muted">
            Aprova totes les àrees per poder copiar l'informe amb els noms ({approved} de{" "}
            {ordered.length}).
          </p>
        )}
      </section>

      <ConfirmDialog
        open={restart}
        title="Tornar a començar l'informe?"
        confirmLabel="Torna a començar"
        danger
        onCancel={() => setRestart(false)}
        onConfirm={() => {
          store.deleteReport(student.id, report.term);
          setRestart(false);
        }}
      >
        Es perdrà aquest informe, amb les teves edicions i aprovacions, i tornaràs a la vista prèvia
        del que s'envia.
      </ConfirmDialog>
    </div>
    <aside className="self-start lg:sticky lg:top-6">
      <ChatPanel
        paragraphs={ordered.map((r) => ({ areaId: r.areaId, name: areaById.get(r.areaId)?.name ?? r.areaId, text: areaReportText(r) }))}
        areaName={(id) => areaById.get(id)?.name ?? id}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        onApply={(areaId, paragraph) => updateArea(areaId, { editedText: paragraph, approved: false })}
        display={display}
        students={store.students}
        inputRef={chatInput}
      />
    </aside>
    </div>
  );
}

function countSentences(text: string): number {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length;
}

function AreaReportCard({
  area,
  report,
  display,
  onChange,
}: {
  area: Area;
  report: AreaReport;
  display: (t: string) => string;
  onChange: (changes: Partial<AreaReport>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const flags = report.editedText === undefined ? report.sentences.filter((s) => s.flag) : [];
  const count = countSentences(areaReportText(report));
  const title = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-xl font-bold">{area.name}</h3>
      <span className="text-sm text-muted">
        {report.approved ? (
          <span className="font-bold text-ink">✓ Aprovada</span>
        ) : flags.length ? (
          <span className="font-bold text-warn-ink">
            {plural(flags.length, "frase marcada", "frases marcades")}
          </span>
        ) : (
          "Per aprovar"
        )}
      </span>
    </div>
  );

  if (report.approved) {
    return (
      <section className="card p-5">
        {title}
        <p data-area-id={report.areaId} className="mt-2 leading-relaxed text-muted">
          {display(areaReportText(report))}
        </p>
        <button className="btn btn-ghost mt-2 -ml-3 text-base" onClick={() => onChange({ approved: false })}>
          Torna a obrir
        </button>
      </section>
    );
  }

  return (
    <section className="card p-5">
      {title}

      {editing ? (
        <div className="mt-3 space-y-3">
          <textarea
            autoFocus
            rows={8}
            className="field resize-y leading-relaxed"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          />
          <p className="text-sm text-muted">
            Escriu els alumnes amb el codi (p. ex. A-01); el nom es posarà en copiar l'informe.
          </p>
          <div className="flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => {
                onChange({ editedText: draft.trim() });
                setEditing(false);
              }}
            >
              Desa
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>
              Cancel·la
            </button>
          </div>
        </div>
      ) : (
        <>
          <p data-area-id={report.areaId} className="mt-3 text-lg leading-relaxed">
            {report.editedText !== undefined
              ? display(report.editedText)
              : report.sentences.map((s, i) => {
                  const n = s.flag ? flags.indexOf(s) + 1 : 0;
                  return (
                    <Fragment key={i}>
                      {i > 0 && " "}
                      {s.flag ? (
                        <span className="rounded bg-warn-bg decoration-warn-line decoration-2 underline-offset-4 [box-decoration-break:clone] underline px-0.5">
                          {display(s.text)}
                          <sup className="ml-0.5 font-bold text-warn-ink">{n}</sup>
                        </span>
                      ) : (
                        display(s.text)
                      )}
                    </Fragment>
                  );
                })}
          </p>

          {report.editedText !== undefined && (
            <p className="mt-2 text-sm text-muted">
              Text editat (per tu o amb l'assistent).
            </p>
          )}

          {flags.length > 0 && (
            <ul className="mt-4 space-y-2">
              {flags.map((s, i) => (
                <li key={i} className="warn-box flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="flex-1">
                    <strong>{i + 1}.</strong> {s.flag}
                  </span>
                  <span className="flex gap-1">
                    <button
                      className="btn min-h-9 border border-warn-line bg-white px-3 text-base font-normal text-ink hover:bg-hover"
                      onClick={() => onChange({ sentences: report.sentences.filter((x) => x !== s) })}
                    >
                      Treu la frase
                    </button>
                    <button
                      className="btn min-h-9 px-3 text-base font-normal text-warn-ink hover:bg-white/60"
                      onClick={() =>
                        onChange({
                          sentences: report.sentences.map((x) => (x === s ? { text: x.text } : x)),
                        })
                      }
                    >
                      Mantén-la
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={() => onChange({ approved: true })}>
              Aprova
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setDraft(areaReportText(report));
                setEditing(true);
              }}
            >
              Edita
            </button>
            <span className="ml-auto text-sm text-muted">{plural(count, "frase", "frases")}</span>
          </div>
        </>
      )}
    </section>
  );
}
