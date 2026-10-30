import { useState } from "react";
import { TERMS } from "../config";
import { percent } from "../lib/learning";
import { PageTitle } from "../components/Layout";
import { useToast } from "../components/Toast";
import { countNameLeaks } from "../lib/anonymize";
import { useStore } from "../store/AppStore";
import type { Student } from "../types";

export const MAX_GUIDE_CHARS = 8000;
export const MAX_EXAMPLE_CHARS = 8000;

/** Pantalla on la tutora enganxa el model de l'escola i un informe que li agrada. */
export default function Model() {
  const store = useStore();
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <PageTitle
        title="Model d'informe"
        subtitle="La IA seguirà les instruccions de la teva escola i imitarà l'estil d'un informe que t'agradi."
      />

      <SavedText
        title="1. Instruccions de l'escola"
        help={
          <>
            Obre el document de l'escola, copia'n el text i enganxa'l aquí. La IA seguirà l'estructura, el to i el que cal
            destacar. Hi ha regles que no canvien mai: només escriu el que surt de les teves respostes i notes, no posa noms i
            no posa qualificacions.
          </>
        }
        placeholder={"Per exemple:\n- Escriure sempre en plural (pensem, l'animem…).\n- Un punt fort i un punt a millorar de cada infant.\n- Tècnica sandvitx per dir coses negatives."}
        value={store.reportGuide}
        max={MAX_GUIDE_CHARS}
        students={store.students}
        onSave={(t) => store.setReportGuide(t)}
        savedMessage="Instruccions desades."
      />

      <SavedText
        title="2. Un informe que t'agradi (exemple)"
        help={
          <>
            Enganxa un informe sencer que hagis escrit i que t'agradi com ha quedat. La IA n'imitarà l'estructura, la
            llargada, el to i la manera d'escriure, però amb la informació de cada alumne.{" "}
            <strong>Abans d'enganxar-lo, treu-ne el nom de l'alumne i qualsevol dada que el pugui identificar</strong>{" "}
            (posa, per exemple, «l'alumne» o ***).
          </>
        }
        placeholder={"Benvolguda família,\n\nAcabat el primer trimestre del curs, …"}
        value={store.exampleReport}
        max={MAX_EXAMPLE_CHARS}
        students={store.students}
        onSave={(t) => store.setExampleReport(t)}
        savedMessage="Informe d'exemple desat."
      />

      <Preferences />
      <LearningStats />
    </div>
  );
}

/** Learning loop: preferències que la tutora ha aprovat. Ella decideix què aprèn Apunt. */
function Preferences() {
  const store = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const leaks = countNameLeaks(draft, store.students);

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold">3. Les meves preferències</h2>
      <p className="text-muted">
        Quan corregeixes un informe amb l'assistent, et proposa recordar la preferència (per exemple «escriure sempre en
        positiu»). Només es desa si tu dius «Recorda-ho». La IA les seguirà a tots els informes nous. Les pots canviar o
        esborrar quan vulguis.
      </p>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line bg-card px-4">
        <input
          type="checkbox"
          className="h-5 w-5 accent-action"
          checked={store.learningEnabled}
          onChange={(e) => store.setLearningEnabled(e.target.checked)}
        />
        <span>
          <strong>Apunt aprèn de les meves correccions</strong>
          <span className="block text-sm text-muted">
            Si ho desactives, l'assistent no proposa preferències noves i les desades no s'envien a la IA.
          </span>
        </span>
      </label>

      {store.preferences.length ? (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {store.preferences.map((p) => (
            <PreferenceRow key={p.id} id={p.id} text={p.text} source={p.source} createdAt={p.createdAt} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-4 text-muted">Encara no hi ha cap preferència desada.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="field min-w-0 flex-1"
          placeholder="Afegeix-ne una a mà, p. ex.: No fer servir la paraula «adequat»"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          disabled={!draft.trim() || draft.length > 300 || leaks > 0}
          onClick={() => {
            store.addPreference(draft, "manual");
            setDraft("");
            toast({ message: "Preferència desada." });
          }}
        >
          Afegeix
        </button>
      </div>
      {leaks > 0 && <p className="text-sm text-warn-ink">No hi posis noms d'alumnes.</p>}
    </section>
  );
}

function PreferenceRow({ id, text, source, createdAt }: { id: string; text: string; source: "chat" | "manual"; createdAt: number }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      {editing ? (
        <input className="field min-w-0 flex-1" value={value} onChange={(e) => setValue(e.target.value)} />
      ) : (
        <span className="min-w-0 flex-1">
          {text}
          <span className="block text-sm text-muted">
            {source === "chat" ? "Après de l'assistent" : "Afegida a mà"} · {new Date(createdAt).toLocaleDateString("ca")}
          </span>
        </span>
      )}
      {editing ? (
        <button
          className="btn btn-primary min-h-9 px-3 text-base"
          disabled={!value.trim() || value.length > 300}
          onClick={() => {
            store.updatePreference(id, value);
            setEditing(false);
          }}
        >
          Desa
        </button>
      ) : (
        <button className="btn btn-ghost min-h-9 text-base" onClick={() => setEditing(true)}>
          Canvia
        </button>
      )}
      <button className="btn btn-ghost min-h-9 text-base text-danger" onClick={() => store.removePreference(id)}>
        Esborra
      </button>
    </li>
  );
}

/** Mesures del learning loop: si Apunt aprèn, cada informe necessita menys correccions. */
function LearningStats() {
  const store = useStore();
  const rows = [...store.learningLog].sort((a, b) => a.generatedAt - b.generatedAt);
  const code = (id: string) => store.students.find((s) => s.id === id)?.code ?? "—";

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold">Com està aprenent Apunt</h2>
      <p className="text-muted">
        Per a cada informe: quina part del text de la IA has conservat, i quantes correccions has fet amb l'assistent. Si
        Apunt aprèn de tu, el primer número ha de pujar i el segon ha de baixar.
      </p>
      {rows.length ? (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-left text-base">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Alumne</th>
                <th className="px-4 py-2">Generat</th>
                <th className="px-4 py-2">Preferències</th>
                <th className="px-4 py-2">Text conservat</th>
                <th className="px-4 py-2">Correccions amb l'assistent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) => (
                <tr key={`${r.studentId}-${r.generatedAt}`}>
                  <td className="px-4 py-2 text-muted">{i + 1}</td>
                  <td className="px-4 py-2">
                    {code(r.studentId)} · {TERMS[r.term]}
                  </td>
                  <td className="px-4 py-2">{new Date(r.generatedAt).toLocaleDateString("ca")}</td>
                  <td className="px-4 py-2">{r.prefsUsed}</td>
                  <td className="px-4 py-2 font-bold">{percent(r.keptRatio)}</td>
                  <td className="px-4 py-2">{r.chatEdits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-4 text-muted">
          Encara no hi ha dades. Apareixeran quan generis un informe amb la IA i el copiïs.
        </p>
      )}
    </section>
  );
}

function SavedText({
  title,
  help,
  placeholder,
  value,
  max,
  students,
  onSave,
  savedMessage,
}: {
  title: string;
  help: React.ReactNode;
  placeholder: string;
  value: string;
  max: number;
  students: Student[];
  onSave: (text: string) => void;
  savedMessage: string;
}) {
  const toast = useToast();
  const [text, setText] = useState(value);
  const tooLong = text.length > max;
  const changed = text.trim() !== value;
  const leaks = countNameLeaks(text, students);

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-muted">{help}</p>
      <textarea
        className="field min-h-72 font-sans leading-relaxed"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-4">
        <button
          className="btn btn-primary px-6"
          disabled={!changed || tooLong || leaks > 0}
          onClick={() => {
            onSave(text);
            toast({ message: text.trim() ? savedMessage : "Esborrat." });
          }}
        >
          Desa
        </button>
        <span className={tooLong ? "text-warn-ink" : "text-sm text-muted"}>
          {text.length.toLocaleString("ca")} / {max.toLocaleString("ca")} caràcters
        </span>
        {value && !changed && <span className="text-sm text-muted">Desat ✓</span>}
      </div>
      {leaks > 0 && (
        <div className="warn-box" role="alert">
          El text conté {leaks === 1 ? "un nom" : `${leaks} noms`} d'alumnes de la classe. Treu-los abans de desar: aquest text
          s'envia a la IA.
        </div>
      )}
    </section>
  );
}
