// On es guarden les dades. L'AppStore només parla amb aquesta interfície: ara és localStorage
// i a la fase 4 serà IndexedDB xifrat + Supabase, sense canviar les pantalles.
import { STORAGE_KEY } from "../config";
import type { Note, Report, Student, Area, Term } from "../types";

export interface AppState {
  students: Student[];
  areas: Area[];
  notes: Note[];
  reports: Record<string, Report>; // clau: `${studentId}-${term}`
  currentTerm: Term;
  /** Comptador dels codis d'alumne (A-01, A-02...). No es reutilitzen mai. */
  nextStudentNumber: number;
  /** Model d'informe de l'escola (text que enganxa la tutora). La IA el segueix. */
  reportGuide: string;
}

export function emptyState(): AppState {
  return { students: [], areas: [], notes: [], reports: {}, currentTerm: 1, nextStudentNumber: 1, reportGuide: "" };
}

export interface Repository {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
}

export class LocalStorageRepository implements Repository {
  constructor(private key = STORAGE_KEY) {}

  async load(): Promise<AppState | null> {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? { ...emptyState(), ...(JSON.parse(raw) as Partial<AppState>) } : null;
    } catch {
      return null; // dades malmeses o navegador sense accés
    }
  }

  async save(state: AppState): Promise<void> {
    try {
      localStorage.setItem(this.key, JSON.stringify(state));
    } catch {
      // Si no es pot desar, l'app continua funcionant en memòria.
    }
  }
}
