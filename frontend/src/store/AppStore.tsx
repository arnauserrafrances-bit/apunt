// Estat del prototip. Es guarda al navegador (localStorage) i es pot reiniciar
// amb les dades de prova. Les regles són les mateixes que core/db.py.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { STORAGE_KEY } from "../config";
import { createFakeData, type AppData } from "../data/fakeData";
import { formatCode, nameKey, parseNameList, type BulkParseResult } from "../lib/names";
import { clean, plural } from "../lib/text";
import type { Note, Report, Student, Term } from "../types";

interface PersistedState extends AppData {
  currentTerm: Term;
  reports: Record<string, Report>; // clau: `${studentId}-${term}`
}

function initialState(): PersistedState {
  return { ...createFakeData(), currentTerm: 1, reports: {} };
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    // Dades malmeses o navegador sense accés: tornem a les de prova.
  }
  return initialState();
}

export const reportKey = (studentId: number, term: Term) => `${studentId}-${term}`;

function useStoreValue() {
  const [state, setState] = useState<PersistedState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Si no es pot desar, el prototip continua funcionant en memòria.
    }
  }, [state]);

  // Comptador d'ids fora de l'estat, perquè dues accions seguides no en reutilitzin cap.
  const idRef = useRef(state.nextId);
  const nextId = () => idRef.current++;

  return useMemo(() => {
    const update = (fn: (s: PersistedState) => Partial<PersistedState>) =>
      setState((s) => ({ ...s, ...fn(s), nextId: idRef.current }));

    return {
      ...state,

      setTerm: (term: Term) => update(() => ({ currentTerm: term })),

      resetData: () => {
        const fresh = initialState();
        idRef.current = fresh.nextId;
        setState(fresh);
      },

      // ------------------------------------------------ Notes
      addNote: (n: Omit<Note, "id" | "createdAt">): Note => {
        const note: Note = { ...n, text: n.text.trim(), id: nextId(), createdAt: Date.now() };
        update((s) => ({ notes: [...s.notes, note] }));
        return note;
      },
      updateNote: (id: number, changes: Partial<Omit<Note, "id">>) =>
        update((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...changes } : n)) })),
      deleteNote: (id: number) => update((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      restoreNote: (note: Note) => update((s) => ({ notes: [...s.notes, note] })),

      // ------------------------------------------------ Alumnes
      addStudents: (text: string): BulkParseResult & { added: Student[] } => {
        const parsed = parseNameList(text, state.students);
        let number = state.nextStudentNumber;
        const added = parsed.valid.map(([firstName, lastName]) => ({
          id: nextId(),
          code: formatCode(number++),
          firstName,
          lastName,
        }));
        update((s) => ({ students: [...s.students, ...added], nextStudentNumber: number }));
        return { ...parsed, added };
      },
      addStudent: (firstName: string, lastName: string): string | Student => {
        const first = clean(firstName);
        const last = clean(lastName);
        if (!first || !last) return "El nom i els cognoms són obligatoris.";
        if (state.students.some((s) => nameKey(s.firstName, s.lastName) === nameKey(first, last))) {
          return `Ja hi ha un alumne anomenat «${first} ${last}» a la classe.`;
        }
        const student = {
          id: nextId(),
          code: formatCode(state.nextStudentNumber),
          firstName: first,
          lastName: last,
        };
        update((s) => ({
          students: [...s.students, student],
          nextStudentNumber: s.nextStudentNumber + 1,
        }));
        return student;
      },
      deleteStudent: (id: number) =>
        update((s) => ({
          students: s.students.filter((st) => st.id !== id),
          notes: s.notes.filter((n) => n.studentId !== id),
          reports: Object.fromEntries(
            Object.entries(s.reports).filter(([, r]) => r.studentId !== id),
          ),
        })),

      // ------------------------------------------------ Àrees
      addArea: (name: string): string | null => {
        const n = clean(name);
        if (!n) return "El nom de l'àrea no pot estar buit.";
        if (state.areas.some((a) => a.name.toLowerCase() === n.toLowerCase())) {
          return `Ja existeix l'àrea «${n}».`;
        }
        const area = { id: nextId(), name: n };
        update((s) => ({ areas: [...s.areas, area] }));
        return null;
      },
      renameArea: (id: number, name: string): string | null => {
        const n = clean(name);
        if (!n) return "El nom de l'àrea no pot estar buit.";
        if (state.areas.some((a) => a.id !== id && a.name.toLowerCase() === n.toLowerCase())) {
          return `Ja existeix l'àrea «${n}».`;
        }
        update((s) => ({ areas: s.areas.map((a) => (a.id === id ? { ...a, name: n } : a)) }));
        return null;
      },
      deleteArea: (id: number): string | null => {
        const count = state.notes.filter((n) => n.areaId === id).length;
        if (count) {
          return (
            `Aquesta àrea té ${plural(count, "nota", "notes")}. Abans d'esborrar-la, ` +
            "esborra o mou les seves notes a una altra àrea, o bé canvia-li el nom."
          );
        }
        update((s) => ({ areas: s.areas.filter((a) => a.id !== id) }));
        return null;
      },
      moveArea: (id: number, direction: -1 | 1) =>
        update((s) => {
          const areas = [...s.areas];
          const i = areas.findIndex((a) => a.id === id);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= areas.length) return {};
          [areas[i], areas[j]] = [areas[j], areas[i]];
          return { areas };
        }),
      moveAreaNotes: (fromId: number, toId: number): number => {
        const count = state.notes.filter((n) => n.areaId === fromId).length;
        update((s) => ({
          notes: s.notes.map((n) => (n.areaId === fromId ? { ...n, areaId: toId } : n)),
        }));
        return count;
      },

      // ------------------------------------------------ Informes
      saveReport: (report: Report) =>
        update((s) => ({
          reports: { ...s.reports, [reportKey(report.studentId, report.term)]: report },
        })),
      deleteReport: (studentId: number, term: Term) =>
        update((s) => {
          const reports = { ...s.reports };
          delete reports[reportKey(studentId, term)];
          return { reports };
        }),
    };
  }, [state]);
}

export type Store = ReturnType<typeof useStoreValue>;

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useStoreValue();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore fora de StoreProvider");
  return store;
}
