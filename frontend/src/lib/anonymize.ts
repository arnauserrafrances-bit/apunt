// Regla 1: els noms reals no surten mai de l'ordinador.
//
// analyze() troba els noms d'alumnes dins d'un text i decideix, per a cada un:
//   - "name": segur que és un nom -> es canvia pel codi.
//   - "ask":  no se sap segur -> la tutora decideix a la vista prèvia.
//   - (res):  és una paraula normal ("hi ha pau a la classe") -> no es toca.
//
// No endevinem mai: si hi ha dubte, es pregunta.
import { STUDENT_CODE_PREFIX } from "../config";
import type { Id, Student } from "../types";
import { fold } from "./text";

/** Noms que també són paraules normals en català. */
export const COMMON_WORD_NAMES = new Set(
  [
    "Pau", "Mar", "Neus", "Rosa", "Estel", "Alba", "Clara", "Blanca", "Lluna", "Llum",
    "Sol", "Ona", "Abril", "Pol", "Roc", "Bru", "Àngel", "Àngels", "Mercè", "Pilar",
    "Dolors", "Iris", "Violeta", "Aurora", "Gemma", "Victòria", "Salut", "Fe",
  ].map(fold),
);

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "name"; original: string; studentId: Id; code: string }
  | {
      kind: "ask";
      id: string;
      original: string;
      candidates: Id[];
      reason: string;
      allowWord: boolean; // es pot marcar com a "paraula normal"
    };

/** Decisió de la tutora per a un "ask": l'id de l'alumne, o "word" si és una paraula. */
export type Decision = Id | "word";

interface Match {
  start: number;
  end: number;
  studentId: Id;
  firstNameOnly: boolean;
}

const LETTER = "[\\p{L}\\p{N}·]";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameRegex(name: string): RegExp {
  const body = name.trim().split(/\s+/).map(escapeRegex).join("\\s+");
  return new RegExp(`(?<!${LETTER})${body}(?!${LETTER})`, "giu");
}

/** L'article personal català just abans del nom: el, la, en, na, l', n'. */
export function hasPersonalArticle(text: string, start: number): boolean {
  const before = text.slice(0, start);
  return (
    /(?:^|[^\p{L}])(?:el|la|en|na)\s+$/iu.test(before) || /(?:^|[^\p{L}])[ln]['’]$/iu.test(before)
  );
}

function isCapitalized(word: string): boolean {
  const c = word.charAt(0);
  return c !== c.toLocaleLowerCase("ca");
}

function findMatches(text: string, students: Student[]): Match[] {
  const all: Match[] = [];
  for (const s of students) {
    const lastWords = s.lastName.trim().split(/\s+/);
    const patterns: [string, boolean][] = [
      [`${s.firstName} ${s.lastName}`, false],
      [s.firstName, true],
    ];
    if (lastWords.length > 1) patterns.push([`${s.firstName} ${lastWords[0]}`, false]);
    for (const [pattern, firstNameOnly] of patterns) {
      for (const m of text.matchAll(nameRegex(pattern))) {
        all.push({ start: m.index, end: m.index + m[0].length, studentId: s.id, firstNameOnly });
      }
    }
  }
  // Primer les coincidències més llargues ("Laia Font" abans que "Laia").
  all.sort((a, b) => a.start - b.start || b.end - a.end);
  const chosen: Match[] = [];
  let lastEnd = -1;
  for (const m of all) {
    if (m.start < lastEnd) continue;
    // Si dos alumnes comparteixen nom, ens quedem amb una sola coincidència.
    chosen.push(m);
    lastEnd = m.end;
  }
  return chosen;
}

export function analyze(text: string, students: Student[], idPrefix = ""): Segment[] {
  const byId = new Map(students.map((s) => [s.id, s]));
  const segments: Segment[] = [];
  let pos = 0;

  const pushText = (t: string) => {
    if (!t) return;
    const last = segments[segments.length - 1];
    if (last?.kind === "text") last.text += t;
    else segments.push({ kind: "text", text: t });
  };

  for (const m of findMatches(text, students)) {
    const original = text.slice(m.start, m.end);
    const student = byId.get(m.studentId)!;
    pushText(text.slice(pos, m.start));
    pos = m.end;

    if (!m.firstNameOnly) {
      segments.push({ kind: "name", original, studentId: student.id, code: student.code });
      continue;
    }

    const homonyms = students.filter((s) => fold(s.firstName) === fold(student.firstName));
    const isWord = COMMON_WORD_NAMES.has(fold(student.firstName));
    const capitalized = isCapitalized(original);
    const article = hasPersonalArticle(text, m.start);
    const ask = (reason: string) =>
      segments.push({
        kind: "ask",
        id: `${idPrefix}${m.start}`,
        original,
        candidates: homonyms.map((s) => s.id),
        reason,
        allowWord: isWord,
      });

    if (isWord) {
      if (!capitalized && !article) {
        pushText(original); // "hi ha pau a la classe": paraula normal
        continue;
      }
      if (!(capitalized && article)) {
        ask(`«${original}» pot ser un nom o una paraula normal.`);
        continue;
      }
    }
    if (homonyms.length > 1) {
      ask(`Hi ha ${homonyms.length} alumnes que es diuen ${student.firstName}.`);
      continue;
    }
    segments.push({ kind: "name", original, studentId: student.id, code: student.code });
  }
  pushText(text.slice(pos));
  return segments;
}

export function pendingAsks(segments: Segment[], decisions: Record<string, Decision>) {
  return segments.filter(
    (s): s is Extract<Segment, { kind: "ask" }> => s.kind === "ask" && !(s.id in decisions),
  );
}

/** Text que s'enviaria. Els "ask" pendents es deixen com a [?] perquè mai surti un nom. */
export function resolve(
  segments: Segment[],
  decisions: Record<string, Decision>,
  students: Student[],
): string {
  const byId = new Map(students.map((s) => [s.id, s]));
  return segments
    .map((s) => {
      if (s.kind === "text") return s.text;
      if (s.kind === "name") return s.code;
      const d = decisions[s.id];
      if (d === undefined) return "[?]";
      if (d === "word") return s.original;
      return byId.get(d)?.code ?? "[?]";
    })
    .join("");
}

/**
 * Comprovació final sobre el text ja anonimitzat: quants noms hi queden (hauria de ser 0).
 * Compta els noms segurs i els dubtes que no poden ser una paraula normal.
 */
export function countNameLeaks(text: string, students: Student[]): number {
  return analyze(text, students).filter(
    (s) => s.kind === "name" || (s.kind === "ask" && !s.allowWord),
  ).length;
}

/** Torna a posar els noms de pila en lloc dels codis (només a l'ordinador). */
export function deanonymize(text: string, students: Student[]): string {
  const byCode = new Map(students.map((s) => [s.code, s]));
  const re = new RegExp(`(?<!${LETTER})${escapeRegex(STUDENT_CODE_PREFIX)}\\d{2,}(?!${LETTER})`, "gu");
  return text.replace(re, (code) => byCode.get(code)?.firstName ?? code);
}
