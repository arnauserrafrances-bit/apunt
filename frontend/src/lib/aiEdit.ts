// Crida a /api/edit: el xat d'assistència mentre la tutora revisa l'informe. Només s'hi envia text amb codis.
export interface ChatParagraph {
  areaId: string;
  name: string;
  text: string;
}
export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}
export interface ChatResult {
  reply: string;
  edits?: { areaId: string; paragraph: string }[];
  /** Preferència general que la IA proposa recordar. */
  preference?: string;
}

export async function requestAiChat(
  accessCode: string,
  message: string,
  paragraphs: ChatParagraph[],
  quote: { areaId: string; text: string } | null,
  history: ChatTurn[],
  preferences: string[] = [],
  learning = true,
): Promise<ChatResult> {
  let r: Response;
  try {
    r = await fetch("/api/edit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-apunt-code": accessCode },
      body: JSON.stringify({
        message,
        paragraphs,
        history: history.slice(-12),
        learning,
        ...(quote ? { quote } : {}),
        ...(preferences.length ? { preferences } : {}),
      }),
    });
  } catch {
    throw new Error("No hi ha connexió amb el servidor.");
  }
  if (r.status === 404) throw new Error("L'assistent només funciona a la versió publicada (Vercel).");
  const data = (await r.json().catch(() => ({}))) as { error?: string } & Partial<ChatResult>;
  if (!r.ok || typeof data.reply !== "string") throw new Error(data.error ?? `Error del servidor (${r.status}).`);
  return { reply: data.reply, edits: data.edits, preference: data.preference };
}
