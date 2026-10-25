import { useState } from "react";
import { PageTitle } from "../components/Layout";
import { useToast } from "../components/Toast";
import { countNameLeaks } from "../lib/anonymize";
import { useStore } from "../store/AppStore";

export const MAX_GUIDE_CHARS = 8000;

/** Pantalla on la tutora enganxa el model d'informe de la seva escola. */
export default function Model() {
  const store = useStore();
  const toast = useToast();
  const [text, setText] = useState(store.reportGuide);
  const tooLong = text.length > MAX_GUIDE_CHARS;
  const changed = text.trim() !== store.reportGuide;
  const leaks = countNameLeaks(text, store.students);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageTitle
        title="Model d'informe"
        subtitle="Enganxa aquí les instruccions de la teva escola per redactar els informes. La IA les seguirà."
      />

      <div className="card space-y-2 p-5 text-muted">
        <p>
          Obre el document de l'escola (PDF o Word), selecciona'n tot el text, copia'l i enganxa'l a sota.
        </p>
        <p>
          La IA seguirà l'estructura, el to i el que cal destacar. Però hi ha regles que no canvien mai: només
          escriu el que surt de les teves notes, no posa noms i no posa qualificacions.
        </p>
        <p>
          Si el model demana alguna cosa que no és una àrea (per exemple, <em>un punt fort i un a millorar</em>), la
          IA l'escriurà en un paràgraf final de valoració.
        </p>
      </div>

      <textarea
        className="field min-h-80 font-sans leading-relaxed"
        placeholder={"Per exemple:\n- Escriure sempre en plural (pensem, l'animem…).\n- Un punt fort i un punt a millorar de cada infant.\n- Tècnica sandvitx per dir coses negatives."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button
          className="btn btn-primary px-6"
          disabled={!changed || tooLong || leaks > 0}
          onClick={() => {
            store.setReportGuide(text);
            toast({ message: text.trim() ? "Model desat. Els informes nous el seguiran." : "Model esborrat." });
          }}
        >
          Desa el model
        </button>
        <span className={tooLong ? "text-warn-ink" : "text-sm text-muted"}>
          {text.length.toLocaleString("ca")} / {MAX_GUIDE_CHARS.toLocaleString("ca")} caràcters
        </span>
        {store.reportGuide && !changed && <span className="text-sm text-muted">Desat ✓</span>}
      </div>

      {leaks > 0 && (
        <div className="warn-box" role="alert">
          El model conté {leaks === 1 ? "un nom" : `${leaks} noms`} d'alumnes de la classe. Treu-los abans de desar: el
          model s'envia a la IA.
        </div>
      )}
    </div>
  );
}
