// Informe FALS per veure el flux complet. Més endavant ho farà Sonnet (redacció)
// i Haiku (revisió). Les frases surten de les notes ja anonimitzades, i s'hi
// afegeixen 1 o 2 frases genèriques que el "revisor" marca sempre. Si hi ha poques
// notes, l'àrea queda per sota de 6 frases: és el que passarà de veritat.
import type { AreaReport, ReportSentence } from "../types";

const FILLERS: [string, string][] = [
  ["{c} mostra un gran interès per l'àrea i participa sempre amb entusiasme.", "No surt de les notes."],
  ["{c} ha assolit amb excel·lència tots els objectius del trimestre.", "Exagera: cap nota parla d'excel·lència."],
  ["Treballa de manera autònoma i constant.", "No surt de les notes."],
  ["La seva actitud a l'aula és exemplar.", "No surt de les notes."],
  ["Cal que continuï treballant a casa per consolidar els aprenentatges.", "Les notes no parlen de feina a casa."],
  ["És, sens dubte, dels millors de la classe.", "Exagera i compara amb altres alumnes."],
  ["Col·labora molt bé amb els companys en totes les activitats.", "No surt de les notes."],
  ["Ha fet un progrés notable des de l'inici de curs.", "Exagera: les notes només cobreixen unes setmanes."],
];

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
}

/** notesText: textos de les notes d'una àrea, ja amb codis en lloc de noms. */
export function fakeAreaReport(
  areaId: number,
  code: string,
  notesText: string[],
  seed: number,
): AreaReport {
  const fromNotes = notesText.flatMap(splitSentences);
  const sentences: ReportSentence[] = fromNotes.slice(0, 7).map((text) => ({ text }));

  // 1 o 2 frases marcades, sense passar de 8.
  const extra = Math.min(1 + ((seed + areaId) % 2), 8 - sentences.length);
  for (let i = 0; i < extra; i++) {
    const [text, flag] = FILLERS[(seed + areaId * 3 + i) % FILLERS.length];
    const at = 1 + ((seed + i) % sentences.length || 0);
    sentences.splice(Math.min(at, sentences.length), 0, { text: text.replace("{c}", code), flag });
  }
  return { areaId, sentences, approved: false };
}

export function areaReportText(r: AreaReport): string {
  return r.editedText ?? r.sentences.map((s) => s.text).join(" ");
}
