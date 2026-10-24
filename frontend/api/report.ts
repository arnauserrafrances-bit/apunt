// Funció de servidor (Vercel): rep les notes JA ANONIMITZADES d'un alumne i retorna
// l'informe per àrees. Sonnet redacta; Haiku revisa cada frase contra les notes.
// La clau d'Anthropic només viu aquí (variable d'entorn), mai al navegador.
// No es guarda ni es registra cap nota: només passen per aquí.

export interface AreaInput {
  areaId: string;
  areaName: string;
  notes: { date: string; text: string }[];
}
export interface ReportRequest {
  code: string; // A-01
  term: string; // "1r trimestre"
  areas: AreaInput[];
}
export interface ReportSentenceOut {
  text: string;
  flag?: string;
}
export interface ReportResponse {
  areas: { areaId: string; sentences: ReportSentenceOut[] }[];
}

const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_CHARS = 30_000;

const DRAFT_SYSTEM = `Ets l'assistent de redacció d'Apunt. Una tutora de primària de Catalunya t'envia les seves notes del trimestre sobre un alumne, identificat amb un codi (per exemple A-01). Has d'escriure el cos de l'informe d'avaluació que rebrà la família: un paràgraf per àrea.

QUÈ POTS DIR (regles sense excepció)
1. Fes servir NOMÉS la informació de les notes. No inventis fets, no exageris, i no afegeixis consells, qualificacions ni comparacions amb altres alumnes que no surtin de les notes.
2. Escriu només sobre les àrees que t'envio. Si una àrea té poques notes, escriu poques frases: és millor un paràgraf curt que inventar. Com a màxim 8 frases per àrea.
3. No escriguis cap nom propi de persona. A l'alumne l'anomenes pel codi.
4. No escriguis salutació, introducció ni comiat: l'aplicació ja afegeix «Benvolguda família,», el paràgraf d'introducció i el comiat.

COM HO HAS D'ESCRIURE (l'estil de la tutora)
- Català correcte, to proper i professional. Parles de l'alumne en tercera persona; quan parles de l'escola fas servir el plural («ens agradaria que…», «volem destacar…»).
- Cada àrea és un paràgraf de prosa seguida, sense títols ni llistes. Comença el paràgraf amb una entrada natural que digui de quina àrea parles, per exemple: «En l'àmbit lingüístic, …», «En l'àrea de matemàtiques, …», «Pel que fa a l'anglès, …», «En l'àrea d'educació física, …». Varia les entrades.
- Si l'àrea és d'actitud, hàbits, adaptació o convivència, no cal l'entrada: comença directament per l'alumne («La A-01 s'ha adaptat bé al curs…») o per «En la convivència amb els companys i companyes, …».
- Equilibra: primer el que fa bé i després el que ha de reforçar, lligat amb connectors com «tot i que», «però», «així i tot», «encara», «de manera que», «per la qual cosa».
- Sigues concret: digues exactament què fa o què li costa (la competència o el contingut de la nota), no elogis genèrics.
- Fes servir expressions matisades com: «mostra», «comença a», «ha millorat», «necessita reforç per», «necessita acompanyament en», «cal continuar treballant», «és important que», «amb ajuda», «de manera autònoma».
- Llenguatge inclusiu: «els companys i companyes», «el professorat».

COM ANOMENAR L'ALUMNE (important per als articles)
- Posa sempre l'article personal davant del codi: «la A-01» si és una nena, «en A-01» si és un nen. Dedueix el gènere de les notes (articles i adjectius). Si no es pot saber, escriu «l'A-01».
- Amb preposicions: «de la A-01», «d'en A-01», «a la A-01», «a en A-01», «amb la A-01».
- No repeteixis el codi a cada frase: en català es pot ometre el subjecte o fer servir pronoms.

EXEMPLE (inventat) d'una àrea
Notes: «03/10: en A-07 fa bé les restes portant però s'equivoca en les divisions. 17/10: li costa explicar com ha resolt un problema. 30/10: geometria, reconeix bé els angles.»
Paràgraf: «En l'àrea de matemàtiques, en A-07 resol amb seguretat les restes portant, tot i que encara comet errades en les divisions. Li costa explicar el procediment que ha seguit per resoldre un problema, de manera que cal continuar treballant l'expressió del raonament matemàtic. En geometria, reconeix correctament els angles treballats.»

FORMAT DE LA RESPOSTA
Respon NOMÉS amb un objecte JSON, sense cap text abans ni després. Cada paràgraf va partit en frases dins de "sentences", en ordre:
{"areas":[{"areaId":"<id de l'àrea>","sentences":["frase 1","frase 2"]}]}`;

const CHECK_SYSTEM = `Ets el revisor d'Apunt. Reps les notes d'una tutora sobre un alumne i l'informe que n'ha redactat una IA. Per a cada frase de l'informe, comprova-la contra les notes de la mateixa àrea.

Marca una frase si:
- diu alguna cosa que no surt de les notes;
- exagera el que diuen les notes;
- afegeix consells, qualificacions o comparacions que les notes no fan;
- conté un nom propi de persona que no és el codi de l'alumne.

No marquis una frase només perquè reformula una nota amb altres paraules, perquè comença amb una entrada com «En l'àmbit lingüístic,» o perquè connecta dues idees de les notes. El que importa és que el contingut surti de les notes.

Respon NOMÉS amb un objecte JSON, sense cap text abans ni després:
{"flags":[{"areaId":"<id>","index":<número de frase, començant per 0>,"reason":"motiu breu en català"}]}
Si totes les frases són correctes, respon {"flags":[]}.`;

export function validateRequest(body: unknown): ReportRequest | string {
  if (!body || typeof body !== "object") return "Petició buida.";
  const b = body as Partial<ReportRequest>;
  if (typeof b.code !== "string" || !/^[A-Z]-\d{2,}$/.test(b.code)) return "Codi d'alumne no vàlid.";
  if (typeof b.term !== "string") return "Falta el trimestre.";
  if (!Array.isArray(b.areas) || b.areas.length === 0 || b.areas.length > 15) return "Àrees no vàlides.";
  for (const a of b.areas) {
    if (!a || typeof a.areaId !== "string" || typeof a.areaName !== "string" || !Array.isArray(a.notes) || a.notes.length === 0)
      return "Àrea no vàlida.";
    for (const n of a.notes) if (!n || typeof n.text !== "string" || typeof n.date !== "string") return "Nota no vàlida.";
  }
  if (JSON.stringify(b).length > MAX_CHARS) return "Hi ha massa text per a un sol informe.";
  return b as ReportRequest;
}

export function notesBlock(req: ReportRequest): string {
  return [
    `Alumne: ${req.code}`,
    `Trimestre: ${req.term}`,
    ...req.areas.flatMap((a) => ["", `Àrea: ${a.areaName} (id: ${a.areaId})`, ...a.notes.map((n) => `- ${n.date}: ${n.text}`)]),
  ].join("\n");
}

/** Treu el primer objecte JSON d'una resposta (per si el model hi posa text o ```). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no ha retornat JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

/** Uneix l'esborrany i les marques del revisor. Només accepta àrees que s'han demanat. */
export function mergeReport(req: ReportRequest, draft: unknown, check: unknown): ReportResponse {
  const wanted = new Set(req.areas.map((a) => a.areaId));
  const draftAreas = (draft as { areas?: { areaId?: unknown; sentences?: unknown }[] })?.areas ?? [];
  const flags = (check as { flags?: { areaId?: unknown; index?: unknown; reason?: unknown }[] })?.flags ?? [];
  const areas: ReportResponse["areas"] = [];
  for (const a of draftAreas) {
    if (typeof a?.areaId !== "string" || !wanted.has(a.areaId) || !Array.isArray(a.sentences)) continue;
    const sentences: ReportSentenceOut[] = a.sentences
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .slice(0, 8)
      .map((text) => ({ text: text.trim() }));
    for (const f of flags) {
      if (f?.areaId === a.areaId && typeof f.index === "number" && sentences[f.index] && typeof f.reason === "string")
        sentences[f.index].flag = f.reason.slice(0, 200);
    }
    if (sentences.length) areas.push({ areaId: a.areaId, sentences });
  }
  if (!areas.length) throw new Error("La IA no ha escrit cap àrea.");
  return { areas };
}

async function callClaude(apiKey: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`Error de l'API (${r.status}).`);
  const data = (await r.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

export async function buildReport(req: ReportRequest, env: Record<string, string | undefined>): Promise<ReportResponse> {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY al servidor.");
  const draftModel = env.APUNT_DRAFT_MODEL || "claude-sonnet-5-5";
  const checkModel = env.APUNT_CHECK_MODEL || "claude-haiku-5-5";
  const notes = notesBlock(req);

  const draft = extractJson(await callClaude(apiKey, draftModel, DRAFT_SYSTEM, notes, 4000));
  const draftForCheck = ((draft as ReportResponse).areas ?? [])
    .map((a) => [`Àrea id: ${a.areaId}`, ...(a.sentences as unknown as string[]).map((s, i) => `${i}. ${s}`)].join("\n"))
    .join("\n\n");
  const check = extractJson(
    await callClaude(apiKey, checkModel, CHECK_SYSTEM, `NOTES DE LA TUTORA\n${notes}\n\nINFORME\n${draftForCheck}`, 2000),
  );
  return mergeReport(req, draft, check);
}

function sameCode(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
  const valid = validateRequest(body);
  if (typeof valid === "string") return res.status(400).json({ error: valid });

  try {
    return res.status(200).json(await buildReport(valid, process.env));
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "Error desconegut." });
  }
}
