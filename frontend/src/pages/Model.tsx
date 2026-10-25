import { useState } from "react";
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
    </div>
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
