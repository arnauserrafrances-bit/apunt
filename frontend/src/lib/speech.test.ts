import { describe, expect, it } from "vitest";
import { startDictation, type Recognition } from "./speech";

// Reconeixement de veu fals: el test decideix què "sent" i quan s'atura.
const made: FakeRec[] = [];
class FakeRec implements Recognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: Recognition["onresult"] = null;
  onerror: Recognition["onerror"] = null;
  onend: Recognition["onend"] = null;
  started = false;
  constructor() {
    made.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
  say(parts: [string, boolean][]) {
    const results = parts.map(([t, isFinal]) => ({ isFinal, 0: { transcript: t } }));
    this.onresult?.({ resultIndex: 0, results });
  }
}

describe("startDictation", () => {
  it("accumulates text, restarts after silence and stops when asked", () => {
    made.length = 0;
    const seen: [string, string][] = [];
    let ended = false;
    const d = startDictation(
      { onText: (f, i) => seen.push([f, i]), onError: () => {}, onEnd: () => (ended = true) },
      "ca-ES",
      FakeRec,
    );
    expect(made[0].lang).toBe("ca-ES");
    expect(made[0].continuous).toBe(true);
    made[0].say([["La Marta llegeix bé", false]]);
    expect(seen.at(-1)).toEqual(["", "La Marta llegeix bé"]);
    made[0].say([["La Marta llegeix bé.", true]]);
    // El navegador s'atura sol després d'un silenci: tornem a començar sense perdre el text.
    made[0].onend?.();
    expect(made).toHaveLength(2);
    expect(ended).toBe(false);
    made[1].say([["En mates li costa dividir.", true]]);
    expect(seen.at(-1)).toEqual(["La Marta llegeix bé. En mates li costa dividir.", ""]);
    d.stop();
    expect(ended).toBe(true);
    expect(made).toHaveLength(2);
  });

  it("reports a clear error when the microphone is not allowed", () => {
    made.length = 0;
    let error = "";
    let ended = false;
    startDictation({ onText: () => {}, onError: (m) => (error = m), onEnd: () => (ended = true) }, "ca-ES", FakeRec);
    made[0].onerror?.({ error: "not-allowed" });
    made[0].onend?.();
    expect(error).toMatch(/permís al micròfon/);
    expect(ended).toBe(true);
    expect(made).toHaveLength(1);
  });

  it("works without speech support", () => {
    let error = "";
    startDictation({ onText: () => {}, onError: (m) => (error = m), onEnd: () => {} }, "ca-ES", null);
    expect(error).toMatch(/no permet dictar/);
  });
});
