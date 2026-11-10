// Dictat: passa la veu a text. Avui fa servir el reconeixement de veu del navegador
// (Chrome i Safari, a l'ordinador i al mòbil). Quan Apunt sigui una app descarregable,
// només caldrà canviar aquest fitxer pel reconeixement nadiu del mòbil (que pot funcionar
// sense connexió): la resta de l'app només coneix startDictation().

export interface DictationHandlers {
  /** Text final acumulat i el tros que encara s'està reconeixent. */
  onText: (finalText: string, interim: string) => void;
  onError: (message: string) => void;
  /** S'ha aturat del tot (per la tutora o per un error). */
  onEnd: () => void;
}

export interface Dictation {
  stop: () => void;
}

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return ctor() !== null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Cal donar permís al micròfon (a la icona del costat de l'adreça del navegador).",
  "service-not-allowed": "Aquest navegador no deixa dictar. Prova amb Chrome o Safari.",
  "audio-capture": "No es troba cap micròfon.",
  network: "Per dictar cal connexió a internet.",
  "language-not-supported": "Aquest navegador no reconeix el català.",
};

/** Comença a escoltar. Si el navegador s'atura sol després d'un silenci, torna a començar. */
export function startDictation(handlers: DictationHandlers, lang = "ca-ES", Ctor: RecognitionCtor | null = ctor()): Dictation {
  if (!Ctor) {
    handlers.onError("Aquest navegador no permet dictar. Fes servir Chrome o Safari, o escriu la nota.");
    handlers.onEnd();
    return { stop: () => {} };
  }
  let finalText = "";
  let stopped = false;
  let failed = false;
  let rec: Recognition;

  const join = (a: string, b: string) => (a && b ? `${a.trimEnd()} ${b.trimStart()}` : a + b);

  const begin = () => {
    rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    // Cada sessió de reconeixement comença de zero: el text final anterior ja és a finalText.
    let sessionFinal = "";
    rec.onresult = (e) => {
      let interim = "";
      sessionFinal = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) sessionFinal = join(sessionFinal, r[0].transcript);
        else interim = join(interim, r[0].transcript);
      }
      handlers.onText(join(finalText, sessionFinal), interim);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // silenci: es torna a començar
      failed = true;
      handlers.onError(ERRORS[e.error] ?? `No s'ha pogut dictar (${e.error}).`);
    };
    rec.onend = () => {
      finalText = join(finalText, sessionFinal);
      handlers.onText(finalText, "");
      if (!stopped && !failed) {
        try {
          begin();
          return;
        } catch {
          /* no es pot tornar a començar */
        }
      }
      handlers.onEnd();
    };
    rec.start();
  };

  try {
    begin();
  } catch {
    handlers.onError("No s'ha pogut engegar el micròfon.");
    handlers.onEnd();
  }
  return {
    stop: () => {
      stopped = true;
      try {
        rec?.stop();
      } catch {
        handlers.onEnd();
      }
    },
  };
}
