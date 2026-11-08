import { describe, it, expect } from "vitest";
import { redLine, mergeReport } from "./report";

describe("red-line guardrail", () => {
  it("blocks grades, comparisons and repeating the year", () => {
    expect(redLine("La A-01 té un 10 en totes les àrees.")).toBe("qualificació numèrica");
    expect(redLine("Ha tret un 7,5/10.")).toBe("qualificació numèrica");
    expect(redLine("És la millor alumna de la classe.")).not.toBeNull();
    expect(redLine("Llegeix millor que els altres.")).not.toBeNull();
    expect(redLine("Recomanem que l'alumne repeteixi curs.")).not.toBeNull();
  });
  it("keeps normal sentences", () => {
    for (const t of [
      "En l'àmbit lingüístic, la A-01 llegeix amb fluïdesa.",
      "Ha millorat molt en lectura durant aquest trimestre.",
      "Resol bé les multiplicacions de 2 xifres.",
      "Juga amb els companys i companyes al pati.",
      "Ha après les taules del 6 i del 7.",
    ])
      expect(redLine(t)).toBeNull();
  });
  it("removes blocked sentences from the report", () => {
    const req = { code: "A-01", term: "1r", areas: [{ areaId: "ar1", name: "x", notes: [] }] } as never;
    const out = mergeReport(req, { areas: [{ areaId: "ar1", sentences: ["Llegeix bé.", "És la millor alumna de la classe."] }] }, { flags: [] });
    expect(out.areas[0].sentences.map((s) => s.text)).toEqual(["Llegeix bé."]);
    expect(() => mergeReport(req, { areas: [{ areaId: "ar1", sentences: ["Té un 10."] }] }, { flags: [] })).toThrow(/No s'ha pogut/);
  });
});
