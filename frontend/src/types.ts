export type Term = 1 | 2 | 3;

export interface Student {
  id: number;
  code: string;
  firstName: string;
  lastName: string;
}

export interface Area {
  id: number;
  name: string;
}

export interface Note {
  id: number;
  studentId: number;
  areaId: number;
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
  areaId: number;
  sentences: ReportSentence[];
  editedText?: string; // si la tutora l'ha editat
  approved: boolean;
}

export interface Report {
  studentId: number;
  term: Term;
  areas: AreaReport[];
  emptyAreaIds: number[];
}
