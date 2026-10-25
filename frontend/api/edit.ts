// Xat d'assistència: mentre revisa l'informe, la tutora parla amb la IA. Pot citar un fragment del text
// (com un "reply") i demanar sinònims, reformular, escurçar… Rep text amb codis (A-01), mai noms.
// Aquest fitxer és independent (no importa res d'altres fitxers): a Vercel cada funció
// s'executa com a mòdul ESM de Node i un import sense extensió ("./report") fa petar la funció.

const API_URL = "https://api.anthropic.com/v1/messages";

interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no ha retornat JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

async function callClaude(apiKey: string, model: string, system: string, user: string, maxTokens: number, tool: Tool): Promise<unknown> {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) {
    const detail = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Error de l'API (${r.status})${detail?.error?.message ? `: ${detail.error.message}` : "."}`);
  }
  const data = (await r.json()) as { stop_reason?: string; content?: { type: string; text?: string; name?: string; input?: unknown }[] };
  if (data.stop_reason === "max_tokens") throw new Error("La resposta de la IA era massa llarga i s'ha tallat.");
  const used = (data.content ?? []).find((c) => c.type === "tool_use" && c.name === tool.name);
  if (used?.input && typeof used.input === "object") return used.input;
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  try {
    return extractJson(text);
  } catch {
    // Al xat, una resposta en text normal també serveix.
    if (text) return { reply: text };
    throw new Error("La IA ha retornat una resposta buida.");
  }
}

export interface ChatParagraph {
  areaId: string;
  name: string;
  text: string;
}
export interface ChatRequest {
  message: string;
  /** Fragment que la tutora ha marcat al text (opcional) i paràgraf on és. */
  quote?: { areaId: string; text: string };
  paragraphs: ChatParagraph[];
  /** Missatges anteriors del xat, per mantenir la conversa. */
  history?: { role: "user" | "assistant"; text: string }[];
}
export interface ChatResponse {
  reply: string;
  edits?: { areaId: string; paragraph: string }[];
}

const LIMITS = { message: 1500, quote: 3000, paragraph: 8000, paragraphs: 20, history: 12, historyText: 3000 };

const CHAT_SYSTEM = `Ets l'assistent d'edició d'Apunt. Una tutora de primària de Catalunya està revisant l'informe d'avaluació d'un alumne (identificat amb un codi com «la A-01» o «en A-01») i parla amb tu en un xat per millorar-lo.

Reps l'informe sencer (un paràgraf per àrea, amb el seu id), la conversa fins ara i el missatge nou. Si la tutora ha marcat un fragment del text, el reps com a «FRAGMENT MARCAT»: la petició es refereix sobretot a aquest fragment.

Com respons:
- Si et demana idees, sinònims, opinió o una explicació, respon a "reply" de manera breu i útil (per exemple, 3-5 sinònims adequats al context) i no proposis canvis al text.
- Si et demana canviar el text (reformular, escurçar, canviar una paraula, treure una repetició…), posa a "edits" el paràgraf SENCER de cada àrea afectada amb el canvi fet (amb el seu areaId), i a "reply" una frase curta dient què has canviat.
- Canvia només el que et demana. No afegeixis informació nova sobre l'alumne que no sigui a l'informe.
- Mantén els codis dels alumnes amb el seu article (la A-01, en A-01, l'A-01) exactament com són. No escriguis noms de persones.
- Escriu en català correcte, amb el to de l'informe (proper, professional, en plural quan parla l'escola). Evita repetir paraules en frases properes.
- Respon sempre en català i de manera breu: la tutora vol anar ràpid.

Dona la resposta fent servir l'eina chat_reply.`;

const CHAT_TOOL: Tool = {
  name: "chat_reply",
  description: "Resposta a la tutora i, si ha demanat canvis, el paràgraf sencer de cada àrea modificada.",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: { areaId: { type: "string" }, paragraph: { type: "string" } },
          required: ["areaId", "paragraph"],
        },
      },
    },
    required: ["reply"],
  },
};

const str = (x: unknown, max: number) => typeof x === "string" && x.trim().length > 0 && x.length <= max;

export function validateChat(body: unknown): ChatRequest | string {
  const b = (body ?? {}) as Partial<ChatRequest>;
  if (!str(b.message, LIMITS.message)) return "Escriu el teu missatge (com a màxim 1.500 caràcters).";
  if (!Array.isArray(b.paragraphs) || !b.paragraphs.length || b.paragraphs.length > LIMITS.paragraphs) return "Informe no vàlid.";
  for (const p of b.paragraphs)
    if (!p || typeof p.areaId !== "string" || typeof p.name !== "string" || !str(p.text, LIMITS.paragraph)) return "Paràgraf no vàlid.";
  if (b.quote !== undefined && (!b.quote || typeof b.quote.areaId !== "string" || !str(b.quote.text, LIMITS.quote)))
    return "Fragment marcat no vàlid.";
  if (b.history !== undefined) {
    if (!Array.isArray(b.history) || b.history.length > LIMITS.history) return "Conversa no vàlida.";
    for (const h of b.history)
      if (!h || (h.role !== "user" && h.role !== "assistant") || !str(h.text, LIMITS.historyText)) return "Conversa no vàlida.";
  }
  return b as ChatRequest;
}

export function chatPrompt(req: ChatRequest): string {
  const report = req.paragraphs.map((p) => `[areaId: ${p.areaId}] ${p.name}\n${p.text.trim()}`).join("\n\n");
  const history = (req.history ?? []).map((h) => `${h.role === "user" ? "Tutora" : "Assistent"}: ${h.text.trim()}`).join("\n");
  return [
    `INFORME ACTUAL\n${report}`,
    history ? `\nCONVERSA FINS ARA\n${history}` : "",
    req.quote ? `\nFRAGMENT MARCAT (a l'àrea ${req.quote.areaId})\n«${req.quote.text.trim()}»` : "",
    `\nMISSATGE NOU DE LA TUTORA\n${req.message.trim()}`,
  ].join("\n");
}

export async function runChat(req: ChatRequest, env: Record<string, string | undefined>): Promise<ChatResponse> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY al servidor.");
  const model = env.APUNT_EDIT_MODEL || env.APUNT_DRAFT_MODEL || "claude-sonnet-5-5";
  const out = (await callClaude(apiKey, model, CHAT_SYSTEM, chatPrompt(req), 6000, CHAT_TOOL)) as Partial<ChatResponse>;
  const known = new Map(req.paragraphs.map((p) => [p.areaId, p.text.trim()]));
  const edits = (Array.isArray(out.edits) ? out.edits : []).filter(
    (e): e is { areaId: string; paragraph: string } =>
      !!e && typeof e.areaId === "string" && known.has(e.areaId) && typeof e.paragraph === "string" && !!e.paragraph.trim() && e.paragraph.trim() !== known.get(e.areaId),
  ).map((e) => ({ areaId: e.areaId, paragraph: e.paragraph.trim() }));
  const reply = typeof out.reply === "string" ? out.reply.trim() : "";
  if (!reply && !edits.length) throw new Error("La IA no ha respost res.");
  return { reply: reply || "Fet.", ...(edits.length ? { edits } : {}) };
}

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Només POST." });
  const expected = process.env.APUNT_ACCESS_CODE;
  const given = req.headers["x-apunt-code"];
  if (!expected || typeof given !== "string" || !sameCode(given, expected))
    return res.status(401).json({ error: "Codi d'accés incorrecte." });
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const valid = validateChat(body);
  if (typeof valid === "string") return res.status(400).json({ error: valid });
  try {
    return res.status(200).json(await runChat(valid, process.env));
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "Error desconegut." });
  }
}
