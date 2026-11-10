// Nota de veu: la tutora diu el nom de l'alumne i explica què ha observat (pot barrejar àrees).
// 1. El dictat passa la veu a text (lib/speech.ts).
// 2. A l'ordinador o al mòbil es troba l'alumne pel nom i el nom es canvia pel codi (regla 1).
// 3. La IA (/api/classify) reparteix el text en una nota per àrea.
// 4. La tutora revisa les notes i les desa. Res es desa sense que ella ho vegi.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { requestClassify } from "../lib/aiClassify";
import { loadAccessCode, saveAccessCode } from "../lib/aiReport";
import { analyze, countNameLeaks, deanonymize, pendingAsks, resolve, type Decision } from "../lib/anonymize";
import { fullName } from "../lib/names";
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

export function VoiceNote({ below }: { below?: ReactNode }) {
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
    saveAccessCode(accessCode.trim());
    setError(null);
    setPhase("classifying");
    try {
      const out = await requestClassify(
        accessCode.trim(),
        student.code,
        areas.map((a) => ({ areaId: a.id, name: a.name })),
        anonymized,
      );
      let key = 0;
      setNoteStudentId(student.id);
      setDrafts([
        ...out.notes.map((n) => ({ key: key++, areaId: n.areaId, text: deanonymize(n.text, students) })),
        ...out.other.map((t) => ({ key: key++, areaId: "" as const, text: deanonymize(t, students) })),
      ]);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No s'ha pogut repartir la nota.");
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
  if (phase === "idle") {
    return (
      <div className="space-y-10">
        <section className="flex flex-col items-center text-center">
          <h2 className="mb-5 text-xl font-bold">Grava una nota de veu:</h2>
          <button
            type="button"
            onClick={() => record("")}
            disabled={!supported}
            aria-label="Grava una nota de veu"
            className="flex h-40 w-40 items-center justify-center rounded-full bg-action text-white shadow-lg transition hover:scale-[1.03] hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-45 sm:h-44 sm:w-44"
          >
            <MicIcon className="h-20 w-20" />
          </button>
          <p className="mt-4 max-w-md text-muted">
            {supported
              ? "Digues el nom de l'alumne i explica què has observat. Pots parlar de diverses àrees: Apunt la repartirà."
              : "Aquest navegador no permet dictar. Fes servir Chrome o Safari, o crea la nota manualment."}
          </p>
        </section>
        {below}
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <section className="flex flex-col items-center text-center">
        <h2 className="mb-1 text-xl font-bold">T'escolto…</h2>
        <p className="mb-5 tabular-nums text-muted">{clock(seconds)}</p>
        <button
          type="button"
          onClick={stop}
          aria-label="Atura la gravació"
          className="flex h-40 w-40 animate-pulse items-center justify-center rounded-full bg-danger text-white shadow-lg sm:h-44 sm:w-44"
        >
          <span className="h-14 w-14 rounded-lg bg-white" />
        </button>
        <p className="mt-3 font-bold">Toca per acabar</p>
        <div className="card mt-6 min-h-28 w-full p-4 text-left text-lg leading-relaxed" aria-live="polite">
          {text || interim ? (
            <>
              {text} <span className="text-muted">{interim}</span>
            </>
          ) : (
            <span className="text-muted">Comença a parlar: per exemple «La Marta avui ha llegit molt bé…»</span>
          )}
        </div>
        {error && <div className="warn-box mt-4 w-full text-left">{error}</div>}
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

        {!loadAccessCode() && (
          <div>
            <label htmlFor="codi-veu" className="mb-2 block font-bold">
              Codi d'accés a la IA
            </label>
            <input id="codi-veu" type="password" className="field" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
          </div>
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
