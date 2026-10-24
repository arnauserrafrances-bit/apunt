// Estat de l'aplicació. Les pantalles només parlen amb aquest store; on es guarden les dades
// ho decideix el Repository (ara localStorage; a la fase 4, IndexedDB xifrat + Supabase).
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_AREAS } from "../config";
import { createFakeData } from "../data/fakeData";
import { newId } from "../lib/id";
import { formatCode, nameKey, parseNameList, type BulkParseResult } from "../lib/names";
import { clean, plural } from "../lib/text";
import type { Id, Note, Report, Student, Term } from "../types";
import { emptyState, type AppState, type Repository } from "./repository";

export const reportKey = (studentId: Id, term: Term) => `${studentId}-${term}`;

function useStoreValue(repository: Repository, initial: AppState) {
  const [state, setState] = useState<AppState>(initial);

  // No desem l'estat inicial (acabat de carregar); només els canvis.
  const loaded = useRef(true);
  useEffect(() => {
    if (loaded.current) {
      loaded.current = false;
      return;
    }
    void repository.save(state);
  }, [repository, state]);

  return useMemo(() => {
    const update = (fn: (s: AppState) => Partial<AppState>) => setState((s) => ({ ...s, ...fn(s) }));

    return {
      ...state,
      isEmpty: !state.students.length && !state.areas.length && !state.notes.length,

      setTerm: (term: Term) => update(() => ({ currentTerm: term })),

      /** Substitueix totes les dades per la classe inventada. Només si la tutora ho demana. */
      loadFakeData: () => setState(createFakeData()),

      // ------------------------------------------------ Notes
      addNote: (n: Omit<Note, "id" | "createdAt">): Note => {
        const note: Note = { ...n, text: n.text.trim(), id: newId(), createdAt: Date.now() };
        update((s) => ({ notes: [...s.notes, note] }));
        return note;
      },
      updateNote: (id: Id, changes: Partial<Omit<Note, "id">>) =>
        update((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...changes } : n)) })),
      deleteNote: (id: Id) => update((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      restoreNote: (note: Note) => update((s) => ({ notes: [...s.notes, note] })),

      // ------------------------------------------------ Alumnes
      addStudents: (text: string): BulkParseResult & { added: Student[] } => {
        const parsed = parseNameList(text, state.students);
        let number = state.nextStudentNumber;
        const added = parsed.valid.map(([firstName, lastName]) => ({
          id: newId(),
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
          id: newId(),
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
      deleteStudent: (id: Id) =>
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
        const area = { id: newId(), name: n };
        update((s) => ({ areas: [...s.areas, area] }));
        return null;
      },
      renameArea: (id: Id, name: string): string | null => {
        const n = clean(name);
        if (!n) return "El nom de l'àrea no pot estar buit.";
        if (state.areas.some((a) => a.id !== id && a.name.toLowerCase() === n.toLowerCase())) {
          return `Ja existeix l'àrea «${n}».`;
        }
        update((s) => ({ areas: s.areas.map((a) => (a.id === id ? { ...a, name: n } : a)) }));
        return null;
      },
      deleteArea: (id: Id): string | null => {
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
      addDefaultAreas: () =>
        update((s) => ({
          areas: [
            ...s.areas,
            ...DEFAULT_AREAS.filter((n) => !s.areas.some((a) => a.name.toLowerCase() === n.toLowerCase())).map(
              (name) => ({ id: newId(), name }),
            ),
          ],
        })),
      moveArea: (id: Id, direction: -1 | 1) =>
        update((s) => {
          const areas = [...s.areas];
          const i = areas.findIndex((a) => a.id === id);
          const j = i + direction;
          if (i < 0 || j < 0 || j >= areas.length) return {};
          [areas[i], areas[j]] = [areas[j], areas[i]];
          return { areas };
        }),
      moveAreaNotes: (fromId: Id, toId: Id): number => {
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
      deleteReport: (studentId: Id, term: Term) =>
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

function LoadedStore({ repository, initial, children }: { repository: Repository; initial: AppState; children: ReactNode }) {
  const store = useStoreValue(repository, initial);
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Carrega les dades del repositori i, mentrestant, no mostra res. Si no n'hi ha, comença buit. */
export function StoreProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  const [initial, setInitial] = useState<AppState | null>(null);
  useEffect(() => {
    let cancelled = false;
    repository.load().then((s) => !cancelled && setInitial(s ?? emptyState()));
    return () => {
      cancelled = true;
    };
  }, [repository]);
  if (!initial) return null;
  return (
    <LoadedStore repository={repository} initial={initial}>
      {children}
    </LoadedStore>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore fora de StoreProvider");
  return store;
}
