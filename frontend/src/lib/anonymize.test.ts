import { describe, expect, it } from "vitest";
import type { Student } from "../types";
import {
  analyze,
  countNameLeaks,
  deanonymize,
  pendingAsks,
  resolve,
  type Segment,
} from "./anonymize";

const students: Student[] = [
  { id: 1, code: "A-01", firstName: "Pau", lastName: "Serra Vidal" },
  { id: 2, code: "A-02", firstName: "Mar", lastName: "Puig Ferrer" },
  { id: 3, code: "A-03", firstName: "Laia", lastName: "Font Roca" },
  { id: 4, code: "A-04", firstName: "Laia", lastName: "Serrano Prat" },
  { id: 5, code: "A-05", firstName: "Martina", lastName: "Sánchez Rovira" },
  { id: 6, code: "A-06", firstName: "Estel", lastName: "Grau Pons" },
  { id: 7, code: "A-07", firstName: "Clara", lastName: "Rius Moreno" },
  { id: 8, code: "A-08", firstName: "Neus", lastName: "Camps Oliver" },
  { id: 9, code: "A-09", firstName: "Rosa", lastName: "Navarro Bassols" },
];

const kinds = (segs: Segment[]) => segs.filter((s) => s.kind !== "text").map((s) => s.kind);
const auto = (text: string) => resolve(analyze(text, students), {}, students);

describe("noms que també són paraules", () => {
  it("no toca la paraula en minúscula i sense article", () => {
    for (const text of [
      "Hi ha pau a la classe des que s'han canviat els grups.",
      "Ha pintat un mar amb aquarel·la.",
      "Té una lletra clara i endreçada.",
      "Porta sempre una carpeta rosa.",
      "Ha dibuixat un estel de cinc puntes.",
      "Diu que a la muntanya hi havia neus.",
    ]) {
      const segs = analyze(text, students);
      expect(kinds(segs), text).toEqual([]);
      expect(auto(text)).toBe(text);
    }
  });

  it("amb majúscula i article personal és segur que és un nom", () => {
    expect(auto("La Mar ha llegit molt bé.")).toBe("La A-02 ha llegit molt bé.");
    expect(auto("Ha treballat amb en Pau.")).toBe("Ha treballat amb en A-01.");
    expect(auto("Ha ajudat l'Estel.")).toBe("Ha ajudat l'A-06.");
    expect(auto("Seu al costat de la Neus.")).toBe("Seu al costat de la A-08.");
  });

  it("amb el nom i cognom sempre és un nom", () => {
    expect(auto("Pau Serra ha acabat la fitxa.")).toBe("A-01 ha acabat la fitxa.");
    expect(auto("Rosa Navarro Bassols participa.")).toBe("A-09 participa.");
  });

  it("si no se sap segur, pregunta en lloc d'endevinar", () => {
    for (const text of [
      "Pau ha llegit en veu alta.", // majúscula a l'inici, sense article
      "Avui Clara estava cansada.", // majúscula sense article
      "Està la mar de contenta.", // minúscula amb article
      "Viuen en pau.", // "en" també és preposició
      "Ha dibuixat l'estel.",
      "Ha pintat el mar.", // minúscula però amb article
    ]) {
      const segs = analyze(text, students);
      expect(kinds(segs), text).toEqual(["ask"]);
      const ask = segs.find((s) => s.kind === "ask")!;
      expect(ask.kind === "ask" && ask.allowWord).toBe(true);
      // Mentre no es decideix, no s'envia ni el nom ni la paraula.
      expect(auto(text)).toContain("[?]");
    }
  });

  it("aplica la decisió de la tutora", () => {
    const text = "Pau ha dit que a la classe hi ha pau.";
    const segs = analyze(text, students, "n1:");
    const [ask] = pendingAsks(segs, {});
    expect(ask.original).toBe("Pau");
    expect(resolve(segs, { [ask.id]: 1 }, students)).toBe("A-01 ha dit que a la classe hi ha pau.");
    expect(resolve(segs, { [ask.id]: "word" }, students)).toBe(text);
    expect(pendingAsks(segs, { [ask.id]: 1 })).toEqual([]);
  });
});

describe("altres casos", () => {
  it("canvia noms normals encara que siguin en minúscula", () => {
    expect(auto("martina ha ajudat la Mar.")).toBe("A-05 ha ajudat la A-02.");
  });

  it("pregunta quan dos alumnes es diuen igual, i no deixa marcar-ho com a paraula", () => {
    const segs = analyze("La Laia ha fet de portaveu.", students);
    const ask = segs.find((s) => s.kind === "ask");
    expect(ask).toMatchObject({ kind: "ask", candidates: [3, 4], allowWord: false });
  });

  it("amb el cognom distingeix els dos alumnes que es diuen igual", () => {
    expect(auto("Laia Font i Laia Serrano han guanyat.")).toBe("A-03 i A-04 han guanyat.");
    expect(auto("La Laia Font Roca ha guanyat.")).toBe("La A-03 ha guanyat.");
  });

  it("no confon noms amb trossos d'altres paraules", () => {
    for (const text of ["Ha resolt la marca de temps.", "Parla de la Paula del conte.", "Mariona"]) {
      expect(kinds(analyze(text, students)), text).toEqual([]);
    }
  });

  it("la comprovació final no troba cap nom al text anonimitzat", () => {
    const text = "La Mar i en Pau Serra han ajudat la Martina. Hi ha pau.";
    const out = auto(text);
    expect(out).toBe("La A-02 i en A-01 han ajudat la A-05. Hi ha pau.");
    expect(countNameLeaks(out, students)).toBe(0);
    expect(countNameLeaks(text, students)).toBe(3);
  });

  it("torna a posar els noms de pila", () => {
    expect(deanonymize("La A-02 i A-01 han ajudat la A-99.", students)).toBe(
      "La Mar i Pau han ajudat la A-99.",
    );
  });
});
