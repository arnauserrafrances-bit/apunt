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
}
