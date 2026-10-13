import { useState } from "react";
import { TERMS } from "../config";
import { formatDate } from "../lib/text";
import type { Area, Note, Term } from "../types";

interface Props {
  note: Note;
  areas: Area[];
  onSave: (changes: Pick<Note, "text" | "areaId" | "date" | "term">) => void;
  onDelete: () => void;
}

/** Una nota amb edició al mateix lloc. Ctrl/Cmd+Enter desa, Esc cancel·la. */
export function NoteCard({ note, areas, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);

  if (editing) {
    const save = () => {
      if (!draft.text.trim()) return;
      onSave({ text: draft.text.trim(), areaId: draft.areaId, date: draft.date, term: draft.term });
      setEditing(false);
    };
    return (
      <div
        className="card space-y-3 border-action p-4"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
        }}
      >
        <textarea
          autoFocus
          rows={3}
          className="field resize-y"
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm text-muted">
            Àrea
            <select
              className="field mt-1 text-base text-ink"
              value={draft.areaId}
              onChange={(e) => setDraft({ ...draft, areaId: Number(e.target.value) })}
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            Data
            <input
              type="date"
              className="field mt-1 text-base text-ink"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value || note.date })}
            />
          </label>
          <label className="text-sm text-muted">
            Trimestre
            <select
              className="field mt-1 text-base text-ink"
              value={draft.term}
              onChange={(e) => setDraft({ ...draft, term: Number(e.target.value) as Term })}
            >
              {Object.entries(TERMS).map(([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={save} disabled={!draft.text.trim()}>
            Desa
          </button>
          <button className="btn btn-secondary" onClick={() => setEditing(false)}>
            Cancel·la
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card group p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg">{note.text}</p>
        <div className="-mt-1 -mr-2 flex shrink-0">
          <button
            className="btn btn-ghost min-h-9 text-base"
            onClick={() => {
              setDraft(note);
              setEditing(true);
            }}
          >
            Edita
          </button>
          <button className="btn btn-ghost min-h-9 text-base hover:text-danger" onClick={onDelete}>
            Esborra
          </button>
        </div>
      </div>
      <div className="mt-1 text-sm text-muted">
        {formatDate(note.date)} · {TERMS[note.term]}
      </div>
    </div>
  );
}
