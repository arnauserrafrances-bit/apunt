import { describe, expect, it } from "vitest";
import { keptRatio, lcsLength, percent } from "./learning";

describe("learning loop: mesures", () => {
  it("LCS de paraules", () => {
    expect(lcsLength(["a", "b", "c", "d"], ["a", "c", "d"])).toBe(3);
    expect(lcsLength([], ["a"])).toBe(0);
  });
  it("sense canvis conserva el 100 %", () => {
    expect(keptRatio({ a: "La A-01 llegeix bé." }, { a: "La A-01 llegeix bé." })).toBe(1);
  });
  it("canviar una paraula de quatre conserva el 75 %", () => {
    expect(keptRatio({ a: "mostra una actitud adequada" }, { a: "mostra una actitud apropiada" })).toBe(0.75);
  });
  it("suma totes les àrees i una àrea esborrada compta com a 0", () => {
    expect(keptRatio({ a: "u dos", b: "tres quatre" }, { a: "u dos" })).toBe(0.5);
  });
  it("sense esborrany no hi ha mesura", () => {
    expect(keptRatio({}, {})).toBeNull();
    expect(percent(null)).toBe("—");
    expect(percent(0.756)).toBe("76 %");
  });
});
