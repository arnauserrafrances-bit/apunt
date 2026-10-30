export type Term = 1 | 2 | 3;

/** UUID: dos dispositius no poden generar el mateix. */
export type Id = string;

export interface Student {
  id: Id;
  code: string;
  firstName: string;
  lastName: string;
}

export interface Area {
  id: Id;
  name: string;
}

export interface Note {
  id: Id;
  studentId: Id;
  areaId: Id;
  text: string;
  date: string; // AAAA-MM-DD
  term: Term;
  createdAt: number;
}

export interface ReportSentence {
  text: string;
  flag?: string; // motiu del revisor
}

export interface AreaReport {
  areaId: Id;
  sentences: ReportSentence[];
  editedText?: string; // si la tutora l'ha editat
  approved: boolean;
}

export interface Report {
  studentId: Id;
  term: Term;
  areas: AreaReport[];
  emptyAreaIds: Id[];
  /** Text original de la IA per àrea (per mesurar quant en conserva la tutora). */
  draft?: Record<string, string>;
  /** Mesures del learning loop. */
  stats?: ReportStats;
}

export interface ReportStats {
  generatedAt: number;
  /** Quantes preferències de la tutora s'han fet servir en generar l'informe. */
  prefsUsed: number;
  /** Canvis de l'assistent que la tutora ha aplicat. */
  chatEdits: number;
  copiedAt?: number;
  /** Part de l'esborrany que es conserva a la versió final (0-1), en copiar l'informe. */
  keptRatio?: number | null;
}

/** Una fila del registre del learning loop: es desa en copiar un informe i no s'esborra amb l'informe. */
export interface LearningEntry extends ReportStats {
  studentId: Id;
  term: Term;
}

/** Preferència d'estil que la tutora ha aprovat: la IA la seguirà als informes següents. */
export interface Preference {
  id: Id;
  text: string;
  createdAt: number;
  source: "chat" | "manual";
}
