// Nota de veu: la tutora diu el nom de l'alumne i explica què ha observat (pot barrejar àrees).
// 1. El dictat passa la veu a text (lib/speech.ts).
// 2. A l'ordinador o al mòbil es troba l'alumne pel nom i el nom es canvia pel codi (regla 1).
// 3. La IA (/api/classify) reparteix el text en una nota per àrea.
// 4. La tutora revisa les notes i les desa. Res es desa sense que ella ho vegi.
import { useEffect, useMemo, useRef, useState } from "react";
import { requestClassify } from "../lib/aiClassify";
import { loadAccessCode, saveAccessCode } from "../lib/aiReport";
import { analyze, countNameLeaks, pendingAsks, resolve, type Decision } from "../lib/anonymize";
import { deanonymizeWithArticles, gendersFromTutorText, gendersWithNameFallback, guessGenders, mergeGenders } from "../lib/articles";
import { fullName } from "../lib/names";
import { initials } from "../lib/areas";
import { speechSupported, startDictation, type Dictation } from "../lib/speech";
import { todayIso } from "../lib/text";
import { TERMS } from "../config";
import { useStore } from "../store/AppStore";
import type { Id } from "../types";
import { StudentSearch } from "./StudentSearch";
import { useToast } from "./Toast";

type Phase = "idle" | "recording" | "review" | "classifying" | "result";

interface Draft {
  key: number;
  areaId: Id | "";
  text: string;
}

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function MicIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function VoiceNote({
  startSignal = 0,
  onActiveChange,
}: {
  /** Cada valor nou (p. ex. Date.now()) comença una gravació. */
  startSignal?: number;
  /** Avisa quan hi ha una nota en curs (gravant, revisant o desant). */
  onActiveChange?: (active: boolean) => void;
}) {
  const store = useStore();
  const { students, areas, currentTerm } = store;
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [chosenId, setChosenId] = useState<Id | null>(null);
  const [chosenByHand, setChosenByHand] = useState(false);
  const [accessCode, setAccessCode] = useState(loadAccessCode);
  // El camp del codi es veu si no n'hi ha cap de guardat, si el guardat és incorrecte o si la tutora el vol canviar.
  const [showCode, setShowCode] = useState(() => !loadAccessCode());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [noteStudentId, setNoteStudentId] = useState<Id | null>(null);
  const dictation = useRef<Dictation | null>(null);
  const supported = useMemo(speechSupported, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => () => dictation.current?.stop(), []);

  useEffect(() => {
    if (startSignal) record("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSignal]);

  useEffect(() => {
    onActiveChange?.(phase !== "idle");
  }, [phase, onActiveChange]);

  const reset = () => {
    dictation.current?.stop();
    dictation.current = null;
    setPhase("idle");
    setText("");
    setInterim("");
    setSeconds(0);
    setError(null);
    setDecisions({});
    setChosenId(null);
    setChosenByHand(false);
    setDrafts([]);
  };

  const record = (keep: string) => {
    setError(null);
    setText(keep);
    setInterim("");
    setSeconds(0);
    setPhase("recording");
    const base = keep.trim();
    dictation.current = startDictation({
      onText: (finalText, partial) => {
        setText(base && finalText ? `${base} ${finalText}` : base || finalText);
        setInterim(partial);
      },
      onError: (message) => setError(message),
      onEnd: () => {
        dictation.current = null;
        setInterim("");
        setPhase((p) => (p === "recording" ? "review" : p));
      },
    });
  };

  const stop = () => {
    if (dictation.current) dictation.current.stop();
    else setPhase("review");
  };

  // ------------------------------------------------ alumne i noms -> codis (tot al dispositiu)
  const segments = useMemo(() => analyze(text, students, "veu:"), [text, students]);
  const asks = segments.filter((s): s is Extract<typeof s, { kind: "ask" }> => s.kind === "ask");
  const pending = pendingAsks(segments, decisions);
  const mentioned = useMemo(() => {
    const ids: Id[] = [];
    for (const s of segments) {
      const id = s.kind === "name" ? s.studentId : s.kind === "ask" ? decisions[s.id] : undefined;
      if (id && id !== "word" && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [segments, decisions]);
  const studentId = chosenByHand ? chosenId : (mentioned[0] ?? null);
  const student = students.find((s) => s.id === studentId) ?? null;
  const anonymized = resolve(segments, decisions, students);
  const leaks = countNameLeaks(anonymized, students);
  const canSend = !!student && !!text.trim() && pending.length === 0 && leaks === 0 && !!accessCode.trim();

  const classify = async () => {
    if (!student || !canSend) return;
    setError(null);
    setPhase("classifying");
    try {
      const out = await requestClassify(
        accessCode.trim(),
        student.code,
        areas.map((a) => ({ areaId: a.id, name: a.name })),
        anonymized,
      );
      // Només es guarda el codi quan ha funcionat.
      saveAccessCode(accessCode.trim());
      setShowCode(false);
      // Noms amb l'article bo («en Marc», «la Marta», «l'Anna»): primer com els anomena la tutora,
      // després els articles que ha fet servir la IA.
      const tutorGenders = gendersFromTutorText([text, ...store.notes.map((n) => n.text), ...Object.values(store.freeTexts)], students);
      const genders = gendersWithNameFallback(
        mergeGenders(tutorGenders, guessGenders([anonymized, ...out.notes.map((n) => n.text), ...out.other].join("\n"))),
        students,
      );
      const withNames = (t: string) => deanonymizeWithArticles(t, students, genders, tutorGenders);
      let key = 0;
      setNoteStudentId(student.id);
      setDrafts([
        ...out.notes.map((n) => ({ key: key++, areaId: n.areaId, text: withNames(n.text) })),
        ...out.other.map((t) => ({ key: key++, areaId: "" as const, text: withNames(t) })),
      ]);
      setPhase("result");
    } catch (e) {
      const message = e instanceof Error ? e.message : "No s'ha pogut repartir la nota.";
      if (/codi d'accés/i.test(message)) {
        // Codi equivocat: s'esborra i es torna a demanar.
        saveAccessCode("");
        setAccessCode("");
        setShowCode(true);
        setError("El codi d'accés a la IA no és correcte. Torna'l a escriure.");
      } else setError(message);
      setPhase("review");
    }
  };

  const save = () => {
    const owner = students.find((s) => s.id === noteStudentId);
    const ready = drafts.filter((d) => d.text.trim());
    if (!owner || !ready.length || ready.some((d) => !d.areaId)) return;
    const saved = ready.map((d) =>
      store.addNote({ studentId: owner.id, areaId: d.areaId as Id, text: d.text, date: todayIso(), term: currentTerm }),
    );
    toast({
      message: `Desades ${saved.length} ${saved.length === 1 ? "nota" : "notes"}: ${owner.code} ${owner.firstName}`,
      action: { label: "Desfés", onClick: () => saved.forEach((n) => store.deleteNote(n.id)) },
    });
    reset();
  };

  // ------------------------------------------------ pantalles
  if (phase === "idle") return null;

  if (phase === "recording") {
    // Mentre parla, el nom d'un alumne que el dictat reconeix es marca amb el retolador.
    const live = analyze(text, students, "viu:");
    const found = students.find((s) => s.id === mentioned[0]);
    return (
      <section
        aria-label="Gravant una nota de veu"
        className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-action text-white"
      >
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-5 pb-8">
          <div className="flex items-center justify-between">
            <button type="button" onClick={reset} className="min-h-11 rounded-full bg-white/12 px-4 font-bold">
              Cancel·la
            </button>
            <span className="text-lg font-bold tracking-wide tabular-nums">{clock(seconds)}</span>
          </div>

          <div className="flex flex-col items-center gap-4 pt-6">
            <div className="relative flex h-[170px] w-[170px] items-center justify-center rounded-full bg-marker/12">
              <span className="absolute inset-4 animate-ping rounded-full bg-marker/20 [animation-duration:2s]" aria-hidden="true" />
              <div className="relative flex h-[130px] w-[130px] items-center justify-center rounded-full bg-marker/22">
                <div className="flex h-[96px] w-[96px] items-center justify-center gap-1.5 rounded-full bg-marker">
                  {[22, 44, 30, 52, 26, 38, 18].map((h, i) => (
                    <span key={i} className="w-[6px] rounded-full bg-action" style={{ height: h * 0.75 }} />
                  ))}
                </div>
              </div>
            </div>
            <h1 className="display text-[30px]">T'escolto…</h1>
          </div>

          <div className="mt-5 rounded-[24px] bg-card p-5 text-ink" aria-live="polite">
            <p className="text-lg leading-relaxed">
              {text || interim ? (
                <>
                  {live.map((seg, i) =>
                    seg.kind === "text" ? (
                      <span key={i}>{seg.text}</span>
                    ) : (
                      <mark key={i} className="rounded-md bg-marker px-1 text-ink">
                        {seg.original}
                      </mark>
                    ),
                  )}{" "}
                  <span className="text-muted">{interim}</span>
                </>
              ) : (
                <span className="text-muted">Comença a parlar: per exemple «La Marta avui ha llegit molt bé…»</span>
              )}
            </p>
            {found && (
              <p className="mt-3 flex items-center gap-2 text-sm text-soft">
                <span className="avatar h-6 w-6 rounded-[8px] text-[11px]">{initials(found.firstName, found.lastName)}</span>
                Alumne trobat: <strong className="text-ink">{found.code} · {fullName(found)}</strong>
              </p>
            )}
          </div>
          {error && <div className="warn-box mt-4">{error}</div>}

          <div className="mt-auto flex flex-col gap-3 pt-6">
            <button
              type="button"
              onClick={stop}
              aria-label="Atura la gravació"
              className="flex min-h-[60px] items-center justify-center gap-3 rounded-[20px] bg-marker font-display text-xl font-extrabold text-ink active:scale-[0.98]"
            >
              <span className="h-[18px] w-[18px] rounded-[5px] bg-ink" />
              Acaba i reparteix per àrees
            </button>
            <p className="text-center text-sm text-white/75">Els noms es canvien per codis abans d'arribar a la IA.</p>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "review" || phase === "classifying") {
    const busy = phase === "classifying";
    return (
      <section className="space-y-6">
        <div>
          <label htmlFor="dictat" className="mb-2 block font-bold">
            1. El que has dit
          </label>
          <textarea
            id="dictat"
            rows={5}
            className="field resize-y text-lg leading-relaxed"
            value={text}
            disabled={busy}
            placeholder="Si el dictat no ha funcionat, també ho pots escriure aquí."
            onChange={(e) => {
              setText(e.target.value);
              setDecisions({});
            }}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" disabled={busy || !supported} onClick={() => record(text)}>
              <MicIcon className="h-5 w-5" /> Continua gravant
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => record("")}>
              Torna a començar
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block font-bold">2. Alumne</label>
          <StudentSearch
            students={students}
            value={student}
            onChange={(s) => {
              setChosenByHand(true);
              setChosenId(s?.id ?? null);
            }}
          />
          {!student && (
            <p className="mt-2 text-muted">No he trobat el nom de l'alumne a la nota: tria'l aquí.</p>
          )}
        </div>

        {asks.length > 0 && (
          <div className="space-y-3">
            {asks.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-4 ${decisions[a.id] === undefined ? "border-warn-line bg-warn-bg" : "border-line bg-card"}`}
              >
                <p>
                  <strong>«{a.original}»</strong> — {a.reason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...a.candidates, ...(a.allowWord ? (["word"] as const) : [])].map((d) => {
                    const s = students.find((st) => st.id === d);
                    const label = d === "word" ? "És una paraula normal" : `És ${s?.code} · ${s ? fullName(s) : ""}`;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={decisions[a.id] === d}
                        onClick={() => setDecisions((all) => ({ ...all, [a.id]: d }))}
                        className={`btn min-h-10 border text-base ${
                          decisions[a.id] === d ? "border-action bg-action text-white" : "border-line bg-card font-normal hover:bg-hover"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {text.trim() && pending.length === 0 && (
          <div>
            <h3 className="mb-2 font-bold">Això és exactament el que s'enviarà a la IA</h3>
            <div className="card whitespace-pre-wrap p-4 text-muted">{anonymized}</div>
            {leaks > 0 && <div className="warn-box mt-2">Encara hi ha un nom al text: revisa'l abans d'enviar.</div>}
          </div>
        )}

        {showCode ? (
          <div>
            <label htmlFor="codi-veu" className="mb-2 block font-bold">
              Codi d'accés a la IA
            </label>
            <input
              id="codi-veu"
              type="password"
              autoComplete="off"
              className="field"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
            />
          </div>
        ) : (
          <button type="button" className="text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={() => setShowCode(true)}>
            Canvia el codi d'accés a la IA
          </button>
        )}

        {error && <div className="warn-box">{error}</div>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary px-6 text-lg" disabled={!canSend || busy} onClick={() => void classify()}>
            {busy ? "Repartint per àrees…" : "Reparteix per àrees"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={reset}>
            Descarta
          </button>
        </div>
      </section>
    );
  }

  // phase === "result"
  const owner = students.find((s) => s.id === noteStudentId);
  const ready = drafts.filter((d) => d.text.trim());
  const missingArea = ready.some((d) => !d.areaId);
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">
          Notes per a {owner?.code} {owner ? fullName(owner) : ""}
        </h2>
        <p className="text-muted">Revisa-les: pots canviar el text, l'àrea o treure'n alguna. Res es desa fins que no premis «Desa».</p>
      </div>
      {drafts.length === 0 && <p className="warn-box">No queda cap nota.</p>}
      <ul className="space-y-3">
        {drafts.map((d) => (
          <li key={d.key} className={`card p-4 ${d.areaId ? "" : "border-warn-line bg-warn-bg"}`}>
            <div className="mb-2 flex items-center gap-2">
              <select
                aria-label="Àrea"
                className="field w-auto flex-1 font-bold"
                value={d.areaId}
                onChange={(e) => setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, areaId: e.target.value } : x)))}
              >
                <option value="">— No encaixa a cap àrea: tria-la —</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="Treu aquesta nota"
                onClick={() => setDrafts((all) => all.filter((x) => x.key !== d.key))}
              >
                ✕
              </button>
            </div>
            <textarea
              rows={3}
              aria-label="Text de la nota"
              className="field resize-y leading-relaxed"
              value={d.text}
              onChange={(e) => setDrafts((all) => all.map((x) => (x.key === d.key ? { ...x, text: e.target.value } : x)))}
            />
          </li>
        ))}
      </ul>
      {missingArea && <div className="warn-box">Tria l'àrea de cada nota (o treu-la) abans de desar.</div>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary px-6 text-lg" disabled={!ready.length || missingArea} onClick={save}>
          Desa {ready.length} {ready.length === 1 ? "nota" : "notes"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setPhase("review")}>
          ← Torna al text
        </button>
        <span className="text-muted">
          Es desaran al <strong className="text-ink">{TERMS[currentTerm]}</strong> · avui
        </span>
      </div>
    </section>
  );
}
