// Crida a /api/classify: la IA reparteix una nota dictada per àrees. Només s'hi envien codis, mai noms.
export interface ClassifiedNotes {
  notes: { areaId: string; text: string }[];
  other: string[];
}

export async function requestClassify(
  accessCode: string,
  code: string,
  areas: { areaId: string; name: string }[],
  text: string,
): Promise<ClassifiedNotes> {
  let r: Response;
  try {
    r = await fetch("/api/classify", {
      method: "POST",
      headers: { "content-type": "application/json", "x-apunt-code": accessCode },
      body: JSON.stringify({ code, areas, text }),
    });
  } catch {
    throw new Error("No hi ha connexió amb el servidor.");
  }
  if (r.status === 404) throw new Error("La IA només funciona a la versió publicada (Vercel), no amb npm run dev.");
  const data = (await r.json().catch(() => ({}))) as { error?: string } & Partial<ClassifiedNotes>;
  if (!r.ok || !Array.isArray(data.notes)) throw new Error(data.error ?? `Error del servidor (${r.status}).`);
  return { notes: data.notes, other: Array.isArray(data.other) ? data.other : [] };
}
