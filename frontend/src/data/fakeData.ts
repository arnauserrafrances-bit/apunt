// Dades inventades per al prototip: 25 alumnes de 5è, 7 àrees i 60 notes del 1r trimestre.
// Hi ha casos preparats per provar la substitució de noms:
//  - Alumnes amb noms que també són paraules: Pau, Mar, Clara, Neus, Rosa, Estel, Ona, Pol, Abril.
//  - Dues alumnes que es diuen Laia.
//  - Notes que esmenten companys ("ha ajudat en Pau") i paraules normals ("hi ha pau").
import type { Area, Note, Student, Term } from "../types";

export interface AppData {
  students: Student[];
  areas: Area[];
  notes: Note[];
  nextStudentNumber: number;
  nextId: number;
}

const STUDENTS: [string, string][] = [
  ["Pau", "Serra Vidal"],
  ["Mar", "Puig Ferrer"],
  ["Laia", "Font Roca"],
  ["Marc", "López Garcia"],
  ["Júlia", "Martí Soler"],
  ["Arnau", "Vila Casas"],
  ["Ona", "Ribas Pujol"],
  ["Pol", "Costa Mas"],
  ["Martina", "Sánchez Rovira"],
  ["Àlex", "Torres Bosch"],
  ["Neus", "Camps Oliver"],
  ["Biel", "Riera Sala"],
  ["Clara", "Rius Moreno"],
  ["Nil", "Ferrer Castells"],
  ["Laia", "Serrano Prat"],
  ["Jan", "Domènech Vives"],
  ["Estel", "Grau Pons"],
  ["Hugo", "Fernández Ruiz"],
  ["Abril", "Coll Valls"],
  ["Aleix", "Mir Batlle"],
  ["Rosa", "Navarro Bassols"],
  ["Èric", "Sabaté Font"],
  ["Irene", "Morales Giménez"],
  ["Oriol", "Pagès Rubió"],
  ["Aina", "Cortés Badia"],
];

const AREAS = [
  "Llengua catalana i literatura",
  "Llengua castellana i literatura",
  "Llengua estrangera (anglès)",
  "Matemàtiques",
  "Coneixement del medi natural, social i cultural",
  "Educació artística",
  "Educació física",
];

// [alumne (núm.), àrea (núm.), dia de setembre, text]
const CAT = 1, CAST = 2, ANG = 3, MAT = 4, MEDI = 5, ART = 6, EF = 7;
const NOTES: [number, number, number, string][] = [
  // Pau Serra
  [1, CAT, 10, "Llegeix amb fluïdesa, però s'encalla amb les paraules llargues."],
  [1, CAT, 17, "Al dictat ha fet 4 faltes d'accentuació. Millora respecte a la setmana passada."],
  [1, CAT, 24, "Ha escrit un conte curt molt imaginatiu sobre un drac que tenia por del foc."],
  [1, MAT, 11, "Domina les taules de multiplicar. Fa les divisions de dues xifres amb ajuda."],
  [1, MAT, 22, "Resol problemes d'un pas sense dificultat. En els de dos passos no llegeix bé l'enunciat."],
  [1, MEDI, 19, "Ha fet l'exposició dels volcans amb la Mar. Parla clar i mira el públic."],
  [1, EF, 15, "Molt actiu. Li costa respectar el torn en els jocs d'equip."],
  [1, ANG, 16, "Entén les instruccions orals si es repeteixen a poc a poc."],
  // Mar Puig
  [2, CAT, 10, "Lectura en veu alta molt expressiva. Llegeix llibres per iniciativa pròpia."],
  [2, CAT, 23, "Redacta amb frases llargues i poca puntuació. Treballem l'ús del punt."],
  [2, CAST, 12, "Bona comprensió lectora en castellà. Confon la b i la v."],
  [2, MAT, 18, "Calcula mentalment molt ràpid. Ha ajudat en Pau amb les divisions."],
  [2, MAT, 25, "Pau seu al seu costat aquesta setmana i treballen bé junts."],
  [2, MEDI, 12, "Molt interessada pels ecosistemes. Porta informació de casa."],
  [2, ART, 26, "Ha pintat un paisatge de mar amb aquarel·les. Molt detallista."],
  [2, EF, 15, "Li costa la resistència en curses llargues. Molt bona actitud."],
  [2, ANG, 16, "Pronunciació molt bona. Participa a les cançons."],
  // Laia Font
  [3, CAT, 11, "Li costa començar a escriure. Necessita un guió previ."],
  [3, MAT, 14, "Molt ordenada als quaderns. S'equivoca a les restes portant-ne."],
  [3, MAT, 28, "Després del reforç, ha millorat a les restes portant-ne."],
  [3, MEDI, 21, "Ha treballat en grup amb la Laia Serrano i la Neus. Bona coordinació."],
  [3, ANG, 17, "Ha après el vocabulari de la unitat 1. Li fa vergonya parlar en veu alta."],
  [3, ART, 25, "Molt creativa amb el collage de tardor."],
  // Marc López
  [4, MAT, 12, "Fa els càlculs molt ràpid però no els revisa."],
  [4, EF, 23, "Ha tingut un conflicte al pati amb l'Àlex. Ho han parlat i s'han disculpat."],
  // Júlia Martí
  [5, CAT, 18, "Comprensió lectora excel·lent. Respon bé les preguntes inferencials."],
  [5, ANG, 22, "Li costa la pronunciació de la th."],
  // Arnau Vila
  [6, MEDI, 24, "Ha portat una col·lecció de minerals i l'ha explicada a la classe."],
  // Ona Ribas
  [7, CAT, 19, "Ha llegit el poema davant la classe amb molta seguretat."],
  [7, EF, 22, "Molt bona a les activitats d'expressió corporal."],
  // Pol Costa
  [8, MAT, 16, "Hi ha pau a la taula des que seu amb en Biel. Es concentra més."],
  [8, MEDI, 26, "Ha fet un treball sobre el pol nord amb molta informació."],
  // Martina Sánchez
  [9, CAT, 15, "Li costa organitzar les idees quan escriu."],
  [9, ART, 18, "Toca la flauta amb molta afinació."],
  // Àlex Torres
  [10, EF, 17, "Molt competitiu. S'enfada quan perd."],
  // Neus Camps
  [11, CAT, 14, "Escriu amb molta imaginació. Li falta revisar l'ortografia."],
  [11, ANG, 16, "Molt bon nivell d'anglès. Va a classes extraescolars."],
  [11, EF, 24, "Molt bona coordinació. Ajuda els companys a qui costa més."],
  // Biel Riera
  [12, MAT, 19, "Va lent en les operacions, però raona bé els problemes."],
  // Clara Rius
  [13, CAT, 11, "Té una lletra clara i endreçada. Presentació molt cuidada."],
  [13, CAT, 25, "Clara ha llegit tres llibres de la biblioteca d'aula aquest mes."],
  [13, CAST, 17, "Llegeix amb poca fluïdesa en castellà. Li costa més que en català."],
  [13, MAT, 15, "Necessita material manipulatiu per entendre les fraccions."],
  [13, MEDI, 22, "Pregunta molt a classe. Molt curiosa amb el sistema solar."],
  [13, EF, 18, "Ha après a fer la voltereta. Al principi tenia por."],
  // Nil Ferrer
  [14, MEDI, 23, "Ha participat molt a la sortida al parc."],
  // Laia Serrano
  [15, CAT, 21, "La Laia ha llegit en veu alta per primera vegada sense nervis."],
  [15, ANG, 18, "Bona actitud a classe d'anglès."],
  // Jan Domènech
  [16, MAT, 20, "Resol els problemes amb dibuixos. Bona estratègia."],
  // Estel Grau
  [17, MAT, 13, "Fa bé les sumes i restes, però va lenta."],
  [17, MEDI, 25, "Ha explicat com trobar l'estel polar al cel. Ho ha après amb el seu avi."],
  // Hugo Fernández
  [18, CAST, 16, "S'expressa oralment amb molta fluïdesa."],
  [18, MAT, 23, "Entén bé els enunciats dels problemes."],
  // Abril Coll
  [19, CAT, 22, "Ha escrit una carta molt ben estructurada."],
  [19, ART, 19, "Va a classes de dibuix des d'abril de l'any passat. Es nota molt."],
  // Rosa Navarro
  [21, ART, 24, "Ha fet una rosa de paper per decorar l'aula."],
  [21, MAT, 17, "Li costa el càlcul mental. Fa servir els dits per sumar."],
  // Èric Sabaté
  [22, EF, 21, "Ha faltat tres dies per malaltia."],
  // Irene Morales
  [23, CAST, 19, "Molt bona expressió escrita en castellà."],
  // Aina Cortés
  [25, MAT, 24, "Entén bé el valor posicional fins als milions."],
];

export function createFakeData(): AppData {
  const students: Student[] = STUDENTS.map(([firstName, lastName], i) => ({
    id: i + 1,
    code: `A-${String(i + 1).padStart(2, "0")}`,
    firstName,
    lastName,
  }));
  const areas: Area[] = AREAS.map((name, i) => ({ id: i + 1, name }));
  const notes: Note[] = NOTES.map(([studentId, areaId, day, text], i) => {
    const date = `2026-09-${String(day).padStart(2, "0")}`;
    return {
      id: i + 1,
      studentId,
      areaId,
      text,
      date,
      term: 1 as Term,
      createdAt: new Date(`${date}T17:00:00`).getTime() + i,
    };
  });
  return {
    students,
    areas,
    notes,
    nextStudentNumber: students.length + 1,
    nextId: 1000,
  };
}
