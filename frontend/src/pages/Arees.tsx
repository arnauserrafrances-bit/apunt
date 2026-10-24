import { useState } from "react";
import { PageTitle } from "../components/Layout";
import { DEFAULT_AREAS } from "../config";
import { useToast } from "../components/Toast";
import { plural } from "../lib/text";
import { useStore } from "../store/AppStore";
import type { Area, Id } from "../types";

function AreaRow({
  area,
  count,
  first,
  last,
}: {
  area: Area;
  count: number;
  first: boolean;
  last: boolean;
}) {
  const store = useStore();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(area.name);
  const [error, setError] = useState<string | null>(null);

  const saveName = () => {
    const err = store.renameArea(area.id, name);
    if (err) return setError(err);
    setError(null);
    setRenaming(false);
  };

  return (
    <li className="px-3 py-3 sm:px-4">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-col sm:flex-row">
          <button
            className="btn btn-ghost min-h-9 px-2"
            disabled={first}
            onClick={() => store.moveArea(area.id, -1)}
            aria-label={`Puja ${area.name}`}
          >
            ↑
          </button>
          <button
            className="btn btn-ghost min-h-9 px-2"
            disabled={last}
            onClick={() => store.moveArea(area.id, 1)}
            aria-label={`Baixa ${area.name}`}
          >
            ↓
          </button>
        </div>

        {renaming ? (
          <form
            className="flex flex-1 flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveName();
            }}
          >
            <input
              autoFocus
              className="field min-w-0 flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setRenaming(false);
                  setError(null);
                }
              }}
            />
            <button className="btn btn-primary">Desa</button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="leading-snug">{area.name}</div>
              <div className="text-sm text-muted">{plural(count, "nota", "notes")}</div>
            </div>
            <button
              className="btn btn-ghost text-base"
              onClick={() => {
                setName(area.name);
                setRenaming(true);
                setError(null);
              }}
            >
              Canvia el nom
            </button>
            <button
              className="btn btn-ghost text-base hover:text-danger"
              onClick={() => {
                const err = store.deleteArea(area.id);
                if (err) setError(err);
                else toast({ message: `S'ha esborrat l'àrea «${area.name}».` });
              }}
            >
              Esborra
            </button>
          </>
        )}
      </div>
      {error && <div className="warn-box mt-2 ml-11">{error}</div>}
    </li>
  );
}

export default function Arees() {
  const store = useStore();
  const { areas, notes } = store;
  const toast = useToast();
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [from, setFrom] = useState<Id | "">("");
  const [to, setTo] = useState<Id | "">("");

  const counts = new Map<Id, number>();
  for (const n of notes) counts.set(n.areaId, (counts.get(n.areaId) ?? 0) + 1);
  const fromCount = from ? (counts.get(from) ?? 0) : 0;
  const nameOf = (id: Id | "") => areas.find((a) => a.id === id)?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <PageTitle
          title="Àrees"
          subtitle="L'ordre d'aquesta llista és el dels botons de Nota ràpida i el de l'informe."
        />
        {areas.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {areas.map((a, i) => (
              <AreaRow
                key={a.id}
                area={a}
                count={counts.get(a.id) ?? 0}
                first={i === 0}
                last={i === areas.length - 1}
              />
            ))}
          </ul>
        ) : (
          <div className="space-y-3 rounded-xl border border-line bg-card p-5">
            <p>Encara no hi ha cap àrea.</p>
            <button
              className="btn btn-primary"
              onClick={() => {
                store.addDefaultAreas();
                toast({ message: "S'han afegit les àrees habituals de primària." });
              }}
            >
              Afegeix les àrees habituals de primària
            </button>
            <p className="text-sm text-muted">{DEFAULT_AREAS.join(" · ")}</p>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold">Afegeix una àrea</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const err = store.addArea(newName);
            setAddError(err);
            if (!err) {
              toast({ message: `Àrea afegida: ${newName.trim()}` });
              setNewName("");
            }
          }}
        >
          <input
            className="field min-w-0 flex-1"
            placeholder="Nom de l'àrea"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className="btn btn-primary">Afegeix</button>
        </form>
        {addError && <div className="warn-box mt-2">{addError}</div>}
      </section>

      <section>
        <h2 className="text-xl font-bold">Mou les notes d'una àrea a una altra</h2>
        <p className="mb-3 text-muted">
          Per fusionar dues àrees o per poder esborrar-ne una que té notes.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <label className="text-sm text-muted">
            Des de
            <select
              className="field mt-1 text-base text-ink"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              <option value="">Tria l'àrea…</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({counts.get(a.id) ?? 0})
                </option>
              ))}
            </select>
          </label>
          <div className="hidden pb-2 text-center text-muted sm:block">→</div>
          <label className="text-sm text-muted">
            Cap a
            <select
              className="field mt-1 text-base text-ink"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              <option value="">Tria l'àrea…</option>
              {areas
                .filter((a) => a.id !== from)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <button
          className="btn btn-primary mt-3"
          disabled={!from || !to || from === to || fromCount === 0}
          onClick={() => {
            const moved = store.moveAreaNotes(from as Id, to as Id);
            toast({ message: `S'han mogut ${plural(moved, "nota", "notes")} a «${nameOf(to)}».` });
            setFrom("");
            setTo("");
          }}
        >
          {from && to && from !== to
            ? `Mou ${plural(fromCount, "nota", "notes")}`
            : "Mou les notes"}
        </button>
      </section>
    </div>
  );
}
