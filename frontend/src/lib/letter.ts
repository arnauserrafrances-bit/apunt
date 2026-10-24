// Munta l'informe final com una carta a la família, amb l'estil de les tutores:
// salutació, introducció, un paràgraf per àrea (sense títols) i comiat segons el trimestre.
// La salutació, la introducció i el comiat són fixos: no els escriu la IA.
import type { Student, Term } from "../types";
import { deanonymizeWithArticles, guessGenders, nameWithArticle } from "./articles";

const ORDINAL: Record<Term, string> = { 1: "primer", 2: "segon", 3: "tercer" };

const FAREWELL: Record<Term, string> = {
  1: "Desitgem que gaudiu d'un bon Nadal!",
  2: "Desitgem que gaudiu d'unes bones vacances de Setmana Santa!",
  3: "Desitgem que gaudiu d'un bon estiu!",
};

export function buildLetter(student: Student, term: Term, paragraphs: string[], students: Student[]): string {
  const all = paragraphs.join("\n");
  const genders = guessGenders(all);
  const who = nameWithArticle(student.firstName, genders.get(student.code.toUpperCase()) ?? null);
  const intro =
    `Acabat el ${ORDINAL[term]} trimestre del curs, ens dirigim a vosaltres en aquest informe d'avaluació ` +
    `amb l'objectiu de compartir algunes informacions més detallades amb relació a l'adaptació, ` +
    `el creixement personal i l'evolució que ${who} ha fet en aquest ${ORDINAL[term]} període de curs.`;
  return [
    "Benvolguda família,",
    intro,
    ...paragraphs.map((p) => deanonymizeWithArticles(p, students, genders)),
    FAREWELL[term],
  ].join("\n\n");
}
