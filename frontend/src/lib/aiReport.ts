// Crida a la funció de servidor /api/report. Només s'hi envien codis (A-01), mai noms:
// el text ja arriba anonimitzat des de la pantalla Informe.
import type { AreaReport } from "../types";

export interface AiAreaInput {
  areaId: string;
  areaName: string;
  notes: { date: string; text: string }[];
}

const CODE_KEY = "apunt-access-code";

/** Id del paràgraf final de valoració que la IA escriu si el model de l'escola ho demana. */
export const CLOSING_ID = "closing";
export const CLOSING_NAME = "Valoració final";

export function loadAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveAccessCode(code: string): void {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {
    // Sense localStorage només caldrà tornar-lo a escriure.
  }
}

export async function requestAiReport(
  accessCode: string,
  code: string,
  term: string,
  areas: AiAreaInput[],
  guide = "",
  freeText = "",
): Promise<AreaReport[]> {
  let r: Response;
  try {
    r = await fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json", "x-apunt-code": accessCode },
      body: JSON.stringify({
        code,
        term,
        areas,
        ...(guide.trim() ? { guide: guide.trim() } : {}),
        ...(freeText.trim() ? { freeText: freeText.trim() } : {}),
      }),
    });
  } catch {
    throw new Error("No hi ha connexió amb el servidor.");
  }
  if (r.status === 404) throw new Error("La IA només funciona a la versió publicada (Vercel), no amb npm run dev.");
  const data = (await r.json().catch(() => ({}))) as {
    error?: string;
    areas?: { areaId: string; sentences: { text: string; flag?: string }[] }[];
  };
  if (!r.ok || !data.areas) throw new Error(data.error ?? `Error del servidor (${r.status}).`);
  return data.areas.map((a) => ({ areaId: a.areaId, sentences: a.sentences, approved: false }));
}
