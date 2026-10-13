import { describe, expect, it } from "vitest";
import type { Student } from "../types";
import { formatCode, matchesStudent, parseNameLine, parseNameList } from "./names";

const maria: Student = { id: 1, code: "A-07", firstName: "Maria", lastName: "Puig Soler" };

describe("noms", () => {
  it("llegeix «Nom Cognoms» i «Cognoms, Nom»", () => {
    expect(parseNameLine("  Maria   Puig Soler ")).toEqual(["Maria", "Puig Soler"]);
    expect(parseNameLine("García López, Ana María")).toEqual(["Ana María", "García López"]);
    expect(parseNameLine("Pau")).toBeNull();
    expect(parseNameLine("Puig,")).toBeNull();
  });

  it("separa línies vàlides, incompletes i duplicades", () => {
    const r = parseNameList("Maria Puig Soler\n\nJordi Vila\nPau\njordi  vila\n", [maria]);
    expect(r.valid).toEqual([["Jordi", "Vila"]]);
    expect(r.invalid).toEqual(["Pau"]);
    expect(r.duplicates).toEqual(["Maria Puig Soler", "jordi vila"]);
  });

  it("formata els codis", () => {
    expect(formatCode(3)).toBe("A-03");
    expect(formatCode(112)).toBe("A-112");
  });

  it("cerca per codi o per nom sense accents", () => {
    for (const q of ["07", "7", "a07", "A-07", "mar", "puig", "maria so", "MARÍA"]) {
      expect(matchesStudent(maria, q), q).toBe(true);
    }
    for (const q of ["08", "jordi", "soler maria x"]) {
      expect(matchesStudent(maria, q), q).toBe(false);
    }
  });
});
