import { describe, expect, it } from "vitest";
import { buildLetter } from "./letter";
import type { Student } from "../types";

const marta: Student = { id: "1", code: "A-01", firstName: "Marta", lastName: "Puig" };
const oriol: Student = { id: "2", code: "A-02", firstName: "Oriol", lastName: "Vila" };

describe("buildLetter", () => {
  it("salutació, introducció amb article, paràgrafs sense títols i comiat de Nadal", () => {
    const t = buildLetter(marta, 1, ["La A-01 s'ha adaptat bé.", "En l'àmbit lingüístic, la A-01 llegeix amb fluïdesa."], [marta]);
    expect(t.startsWith("Benvolguda família,\n\nAcabat el primer trimestre")).toBe(true);
    expect(t).toContain("l'evolució que la Marta ha fet en aquest primer període");
    expect(t).toContain("\n\nLa Marta s'ha adaptat bé.\n\nEn l'àmbit lingüístic, la Marta llegeix");
    expect(t.endsWith("Desitgem que gaudiu d'un bon Nadal!")).toBe(true);
  });
  it("apòstrof a la introducció i comiat d'estiu", () => {
    const t = buildLetter(oriol, 3, ["En A-02 participa."], [oriol]);
    expect(t).toContain("que l'Oriol ha fet en aquest tercer període");
    expect(t).toContain("L'Oriol participa.");
    expect(t.endsWith("Desitgem que gaudiu d'un bon estiu!")).toBe(true);
  });
});
