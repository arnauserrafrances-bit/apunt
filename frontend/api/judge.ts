// Jutge d'avaluació (eval): rep el prompt del jutge ja omplert (regles + casos jutjats + cas nou)
// i retorna el motiu i el veredicte (PASS, FAIL o UNKNOWN). Serveix per comprovar cada setmana la
// qualitat dels informes sense haver-los de llegir tots a mà (Sessió 9).
// Només rep text amb codis (A-01), mai noms reals. La clau d'Anthropic només viu aquí.
// Fitxer independent (no importa res d'altres fitxers): a Vercel cada funció és un mòdul ESM de Node.

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_PROMPT_CHARS = 40_000;

export type Verdict = "PASS" | "FAIL" | "UNKNOWN";
export interface JudgeResponse {
  reason: string;
  verdict: Verdict;
  model: string;
}

function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function validateJudge(body: unknown): { prompt: string } | string {
  const b = (body ?? {}) as { prompt?: unknown };
  if (typeof b.prompt !== "string" || !b.prompt.trim()) return "Falta el prompt del jutge.";
  if (b.prompt.length > MAX_PROMPT_CHARS) return "El prompt del jutge és massa llarg.";
  return { prompt: b.prompt };
}

/** El veredicte és l'última línia que diu PASS, FAIL o UNKNOWN; el que hi ha abans és el motiu. */
export function parseVerdict(text: string): { reason: string; verdict: Verdict } {
  const lines = text.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].replace(/[*_`#:.\s]/g, " ").trim().toUpperCase().match(/^(?:VERDICT\s+)?(PASS|FAIL|UNKNOWN)$/);
    if (m) return { reason: lines.slice(0, i).join("\n").trim(), verdict: m[1] as Verdict };
  }
  return { reason: text.trim(), verdict: "UNKNOWN" };
}

export async function runJudge(prompt: string, env: Record<string, string | undefined>): Promise<JudgeResponse> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY al servidor.");
  const model = env.APUNT_JUDGE_MODEL || "claude-sonnet-5-5";
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) {
    const detail = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Error de l'API (${r.status})${detail?.error?.message ? `: ${detail.error.message}` : "."}`);
  }
  const data = (await r.json()) as { stop_reason?: string; content?: { type: string; text?: string }[] };
  if (data.stop_reason === "max_tokens") throw new Error("La resposta del jutge era massa llarga i s'ha tallat.");
  const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  if (!text.trim()) throw new Error("La IA ha retornat una resposta buida.");
  return { ...parseVerdict(text), model };
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
  const valid = validateJudge(body);
  if (typeof valid === "string") return res.status(400).json({ error: valid });
  try {
    return res.status(200).json(await runJudge(valid.prompt, process.env));
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "Error desconegut." });
  }
}
