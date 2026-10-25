import { useEffect, useRef, useState } from "react";
import { loadAccessCode, saveAccessCode } from "../lib/aiReport";
import { requestAiChat, type ChatParagraph, type ChatTurn } from "../lib/aiEdit";
import { countNameLeaks } from "../lib/anonymize";
import type { Student } from "../types";

export interface Quote {
  areaId: string;
  text: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  quote?: Quote;
  edits?: { areaId: string; paragraph: string; status: "pending" | "applied" | "discarded" }[];
  error?: boolean;
}

/**
 * Xat d'assistència al costat de l'informe. La tutora pot marcar un fragment del text i pulsar
 * «Assistència»: el fragment apareix citat aquí (com un "reply") i la IA respon sobre aquest fragment.
 */
export function ChatPanel({
  paragraphs,
  areaName,
  quote,
  onClearQuote,
  onApply,
  display,
  students,
  inputRef,
}: {
  paragraphs: ChatParagraph[];
  areaName: (id: string) => string;
  quote: Quote | null;
  onClearQuote: () => void;
  onApply: (areaId: string, paragraph: string) => void;
  display: (t: string) => string;
  students: Student[];
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [accessCode, setAccessCode] = useState(loadAccessCode);
  const [codeDraft, setCodeDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);
  const bottom = useRef<HTMLDivElement>(null);
  const leaks = countNameLeaks(text, students);

  // Cos amb claus: l'efecte no ha de retornar res. (A Chrome nou, scrollIntoView retorna una promesa,
  // i React la intentaria cridar com a funció de neteja: «l is not a function».)
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    const message = text.trim();
    if (!message || busy || leaks > 0) return;
    const history: ChatTurn[] = messages.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    const userMsg: Message = { id: nextId.current++, role: "user", text: message, ...(quote ? { quote } : {}) };
    setMessages((m) => [...m, userMsg]);
    setText("");
    onClearQuote();
    setBusy(true);
    try {
      const r = await requestAiChat(accessCode, message, paragraphs, quote, history);
      setMessages((m) => [
        ...m,
        {
          id: nextId.current++,
          role: "assistant",
          text: r.reply,
          edits: r.edits?.map((e) => ({ ...e, status: "pending" as const })),
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: nextId.current++, role: "assistant", text: e instanceof Error ? e.message : "Error desconegut.", error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const setEditStatus = (msgId: number, index: number, status: "applied" | "discarded") =>
    setMessages((ms) =>
      ms.map((m) => (m.id === msgId ? { ...m, edits: m.edits?.map((e, i) => (i === index ? { ...e, status } : e)) } : m)),
    );

  return (
    <div className="card flex max-h-[calc(100vh-3rem)] min-h-96 flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-lg font-bold">Assistent</h2>
        <p className="text-sm text-muted">Marca un tros del text i pulsa «Assistència», o pregunta directament.</p>
      </div>

      {!accessCode ? (
        <div className="space-y-2 p-4">
          <label className="block font-bold" htmlFor="chat-code">
            Codi d'accés a la IA
          </label>
          <input
            id="chat-code"
            type="password"
            className="field"
            value={codeDraft}
            onChange={(e) => setCodeDraft(e.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={!codeDraft.trim()}
            onClick={() => {
              saveAccessCode(codeDraft.trim());
              setAccessCode(codeDraft.trim());
            }}
          >
            Desa
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {!messages.length && (
              <div className="space-y-1 text-sm text-muted">
                <p>Per exemple:</p>
                <p>· «Dona'm sinònims d'aquesta paraula»</p>
                <p>· «Canvia aquesta frase per una que digui el mateix»</p>
                <p>· «Fes el paràgraf de matemàtiques més curt»</p>
                <p>· «Hi ha alguna idea repetida a l'informe?»</p>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "ml-6" : "mr-4"}>
                <div
                  className={`rounded-xl px-3 py-2 leading-relaxed ${
                    m.role === "user" ? "bg-ink text-white" : m.error ? "warn-box" : "bg-paper"
                  }`}
                >
                  {m.quote && (
                    <div className="mb-1 border-l-2 border-white/60 pl-2 text-sm opacity-80">
                      {areaName(m.quote.areaId)}: «{display(m.quote.text)}»
                    </div>
                  )}
                  {m.role === "assistant" ? display(m.text) : m.text}
                </div>
                {m.edits?.map((e, i) => (
                  <div key={i} className="mt-2 rounded-xl border border-action bg-card p-3">
                    <div className="mb-1 text-sm font-bold text-muted">Canvi proposat · {areaName(e.areaId)}</div>
                    <p className="text-sm leading-relaxed">{display(e.paragraph)}</p>
                    {e.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          className="btn btn-primary min-h-9 px-3 text-base"
                          onClick={() => {
                            onApply(e.areaId, e.paragraph);
                            setEditStatus(m.id, i, "applied");
                          }}
                        >
                          Aplica
                        </button>
                        <button className="btn btn-secondary min-h-9 px-3 text-base" onClick={() => setEditStatus(m.id, i, "discarded")}>
                          Descarta
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-bold text-muted">{e.status === "applied" ? "✓ Aplicat" : "Descartat"}</p>
                    )}
                  </div>
                ))}
              </div>
            ))}
            {busy && <p className="text-sm text-muted">L'assistent està pensant…</p>}
            <div ref={bottom} />
          </div>

          <div className="space-y-2 border-t border-line p-3">
            {quote && (
              <div className="flex items-start gap-2 rounded-lg border-l-4 border-action bg-paper px-3 py-2 text-sm">
                <span className="flex-1">
                  <span className="font-bold">{areaName(quote.areaId)}:</span> «{display(quote.text)}»
                </span>
                <button className="text-muted hover:text-ink" aria-label="Treu el fragment" onClick={onClearQuote}>
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                className="field min-w-0 flex-1 resize-none"
                placeholder={quote ? "Què vols fer amb aquest fragment?" : "Escriu a l'assistent…"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button className="btn btn-primary self-end" disabled={busy || !text.trim() || leaks > 0} onClick={() => void send()}>
                Envia
              </button>
            </div>
            {leaks > 0 && (
              <p className="text-sm text-warn-ink">No escriguis el nom de l'alumne: fes servir el codi (A-01) o «l'alumne».</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
