// Torna a posar els noms al lloc dels codis amb l'article personal correcte en català.
// La IA escriu el codi amb l'article que toca pel gènere ("la A-01", "en A-01", "l'A-01")
// perquè no sap el nom. Aquí, al dispositiu, sabem el nom i triem la forma bona:
//   la Marta · l'Anna · en Pau · l'Oriol · de la Marta · d'en Pau · de l'Anna · a en Pau…
import { STUDENT_CODE_PREFIX } from "../config";
import type { Student } from "../types";

export type Gender = "f" | "m" | null;
type Prep = "" | "de" | "a" | "per" | "amb";

const AP = "['’]";
const CODE = `${STUDENT_CODE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d{2,}`;

// Formes que pot escriure la IA davant del codi. L'ordre importa: primer les més llargues.
const FORMS: { re: string; prep: Prep; gender: Gender }[] = [
  { re: `d${AP}en\\s+`, prep: "de", gender: "m" },
  { re: `de\\s+la\\s+`, prep: "de", gender: "f" },
  { re: `de\\s+l${AP}`, prep: "de", gender: null },
  { re: `del\\s+`, prep: "de", gender: "m" },
  { re: `a\\s+en\\s+`, prep: "a", gender: "m" },
  { re: `a\\s+la\\s+`, prep: "a", gender: "f" },
  { re: `a\\s+l${AP}`, prep: "a", gender: null },
  { re: `al\\s+`, prep: "a", gender: "m" },
  { re: `per\\s+en\\s+`, prep: "per", gender: "m" },
  { re: `per\\s+la\\s+`, prep: "per", gender: "f" },
  { re: `per\\s+l${AP}`, prep: "per", gender: null },
  { re: `pel\\s+`, prep: "per", gender: "m" },
  { re: `amb\\s+en\\s+`, prep: "amb", gender: "m" },
  { re: `amb\\s+la\\s+`, prep: "amb", gender: "f" },
  { re: `amb\\s+l${AP}`, prep: "amb", gender: null },
  { re: `amb\\s+el\\s+`, prep: "amb", gender: "m" },
  { re: `en\\s+`, prep: "", gender: "m" },
  { re: `el\\s+`, prep: "", gender: "m" },
  { re: `la\\s+`, prep: "", gender: "f" },
  { re: `l${AP}`, prep: "", gender: null },
];

const PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}·'’])(?:(${FORMS.map((f) => f.re).join("|")}))?(${CODE})(?![\\p{L}\\p{N}·])`,
  "giu",
);

/** Davant de vocal o h + vocal va l'apòstrof (l'Anna, l'Hug), però no davant de i/u semivocals (la Iolanda). */
export function startsWithVowelSound(name: string): boolean {
  const n = name.normalize("NFC");
  if (/^h?[iuïü][aeiouàèéíòóú]/iu.test(n)) return false;
  return /^h?[aeiouàèéíòóú]/iu.test(n);
}

function joinForm(prep: Prep, name: string, gender: Gender): string {
  if (startsWithVowelSound(name)) return `${prep ? `${prep} ` : ""}l'${name}`;
  if (gender === "f") return `${prep ? `${prep} ` : ""}la ${name}`;
  if (gender === "m") return prep === "de" ? `d'en ${name}` : `${prep ? `${prep} ` : ""}en ${name}`;
  return `${prep ? `${prep} ` : ""}${name}`; // gènere desconegut: millor sense article que un d'equivocat
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formOf(token: string | undefined) {
  if (!token) return { prep: "" as Prep, gender: null as Gender };
  const f = FORMS.find((x) => new RegExp(`^${x.re}$`, "iu").test(token));
  return f ? { prep: f.prep, gender: f.gender } : { prep: "" as Prep, gender: null as Gender };
}

/** Gènere de cada alumne segons els articles que fa servir la IA a tot el text (majoria). */
export function guessGenders(text: string): Map<string, Gender> {
  const votes = new Map<string, { f: number; m: number }>();
  for (const m of text.matchAll(PATTERN)) {
    const { gender } = formOf(m[1]);
    const code = m[2].toUpperCase();
    const v = votes.get(code) ?? { f: 0, m: 0 };
    if (gender === "f") v.f++;
    if (gender === "m") v.m++;
    votes.set(code, v);
  }
  return new Map([...votes].map(([code, v]) => [code, v.f > v.m ? "f" : v.m > v.f ? "m" : null]));
}

/** Canvia cada codi pel nom de pila, amb l'article i la preposició ben formats. */
export function deanonymizeWithArticles(
  text: string,
  students: Student[],
  genders = guessGenders(text),
  /** Gènere segur (el que diu la tutora): mana fins i tot sobre l'article que ha escrit la IA. */
  forced: Map<string, Gender> = new Map(),
): string {
  const byCode = new Map(students.map((s) => [s.code.toUpperCase(), s]));
  return text.replace(PATTERN, (whole, token: string | undefined, rawCode: string, offset: number) => {
    const student = byCode.get(rawCode.toUpperCase());
    if (!student) return whole;
    const { prep, gender } = formOf(token);
    const code = rawCode.toUpperCase();
    const out = joinForm(prep, student.firstName, forced.get(code) ?? gender ?? genders.get(code) ?? null);
    const before = text.slice(0, offset);
    const startOfSentence = /(^|[.!?:]\s+|\n\s*)$/.test(before);
    const wasUpper = token ? /^\p{Lu}/u.test(token) : startOfSentence;
    return wasUpper || startOfSentence ? capitalize(out) : out;
  });
}

/** "l'Anna", "la Marta", "en Pau" (o només el nom si no se sap el gènere). */
export function nameWithArticle(name: string, gender: Gender): string {
  return joinForm("", name, gender);
}

/**
 * Gènere de cada alumne segons com l'anomena la tutora als seus textos («en Marc», «el Marc», «la Marta»,
 * «d'en Marc»). Només compta el nom en majúscula, perquè «la pau» (paraula) no faci de «la Pau».
 * Retorna codi d'alumne → gènere.
 */
export function gendersFromTutorText(texts: string[], students: Student[]): Map<string, Gender> {
  const out = new Map<string, Gender>();
  const all = texts.filter(Boolean).join("\n");
  if (!all) return out;
  for (const st of students) {
    const name = st.firstName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!name) continue;
    const re = new RegExp(`(?<![\\p{L}'’])(en|el|la|d${AP}en|de\\s+la|a\\s+en|a\\s+la|amb\\s+en|amb\\s+la)\\s*${name}(?![\\p{L}\\p{N}])`, "giu");
    let f = 0;
    let m = 0;
    for (const hit of all.matchAll(re)) {
      const matchedName = hit[0].slice(hit[0].length - st.firstName.trim().length);
      if (!/^\p{Lu}/u.test(matchedName)) continue; // «la pau» és una paraula, no el nom
      if (/la$/i.test(hit[1])) f++;
      else m++;
    }
    if (f !== m) out.set(st.code.toUpperCase(), f > m ? "f" : "m");
  }
  return out;
}

/** Ajunta dues fonts de gènere: la primera mana quan sap la resposta. */
export function mergeGenders(primary: Map<string, Gender>, fallback: Map<string, Gender>): Map<string, Gender> {
  const out = new Map(fallback);
  for (const [code, g] of primary) if (g) out.set(code, g);
  return out;
}

// Últim recurs, si ni la tutora ni la IA no diuen el gènere: el nom. La majoria de noms de nena
// acaben en -a; aquestes llistes recullen les excepcions habituals a Catalunya.
const GIRLS_NOT_A = new Set(
  ["abril", "mar", "neus", "iris", "noemí", "noemi", "ruth", "rut", "carmen", "inés", "ines", "isabel", "raquel", "mercè", "merce",
   "montserrat", "elisabet", "nur", "sol", "ona", "estel", "llum", "aitana", "ainhoa", "naiara", "nerea", "zoe", "chloe", "candela",
   "beatriz", "lourdes", "pilar", "dolors", "rocío", "rocio", "belén", "belen", "consuelo", "mireia", "maialen", "itziar", "inès", "joy",
   "alison", "aylin", "yasmin", "jasmine", "jennifer", "evelyn", "miriam", "míriam", "ester", "esther", "judit", "judith", "elisenda",
   "agnès", "agnes", "irene", "carme", "mariona", "laia", "nayeli", "sofía", "sofia", "maite", "noa", "ivet", "anaïs", "anais", "lis"]
    .map((n) => n.normalize("NFC")),
);
const BOYS_A = new Set(["lluca", "luca", "nicola", "joshua", "bautista", "mustafa", "hamza", "musa", "akira"]);

export function genderFromName(firstName: string): Gender {
  const n = firstName.trim().split(/\s+/)[0]?.toLowerCase().normalize("NFC") ?? "";
  if (!n) return null;
  if (GIRLS_NOT_A.has(n)) return "f";
  if (BOYS_A.has(n)) return "m";
  return /a$/.test(n) ? "f" : "m";
}

/** Gènere per a cada alumne: el de les fonts que en saben (en ordre), i si no, pel nom. */
export function gendersWithNameFallback(known: Map<string, Gender>, students: Student[]): Map<string, Gender> {
  const out = new Map(known);
  for (const s of students) {
    const code = s.code.toUpperCase();
    if (!out.get(code)) out.set(code, genderFromName(s.firstName));
  }
  return out;
}
