import { describe, expect, it } from "vitest";
import { deanonymizeWithArticles, guessGenders, nameWithArticle, startsWithVowelSound } from "./articles";
import type { Student } from "../types";

const s = (code: string, firstName: string): Student => ({ id: code, code, firstName, lastName: "X" });
const students = [s("A-01", "Marta"), s("A-02", "Anna"), s("A-03", "Pau"), s("A-04", "Oriol"), s("A-05", "Iolanda"), s("A-06", "Hug")];
const d = (t: string) => deanonymizeWithArticles(t, students);

describe("startsWithVowelSound", () => {
  it("vocal i h muda", () => {
    expect(startsWithVowelSound("Anna")).toBe(true);
    expect(startsWithVowelSound("Hug")).toBe(true);
    expect(startsWithVowelSound("Èlia")).toBe(true);
  });
  it("consonant i i/u semivocals", () => {
    expect(startsWithVowelSound("Marta")).toBe(false);
    expect(startsWithVowelSound("Iolanda")).toBe(false);
  });
});

describe("deanonymizeWithArticles", () => {
  it("article femení i masculí davant de consonant", () => {
    expect(d("la A-01 llegeix bé.")).toBe("La Marta llegeix bé.");
    expect(d("Ha vist que en A-03 suma bé.")).toBe("Ha vist que en Pau suma bé.");
  });
  it("apòstrof davant de vocal encara que la IA posi la/en", () => {
    expect(d("la A-02 s'ha adaptat bé.")).toBe("L'Anna s'ha adaptat bé.");
    expect(d("Felicitem en A-04.")).toBe("Felicitem l'Oriol.");
    expect(d("l'A-06 és puntual.")).toBe("L'Hug és puntual.");
  });
  it("preposicions i contraccions", () => {
    expect(d("L'actitud de la A-01 és bona.")).toBe("L'actitud de la Marta és bona.");
    expect(d("L'actitud d'en A-03 és bona.")).toBe("L'actitud d'en Pau és bona.");
    expect(d("L'actitud d'en A-04 és bona.")).toBe("L'actitud de l'Oriol és bona.");
    expect(d("Hem parlat amb en A-03 i amb la A-01.")).toBe("Hem parlat amb en Pau i amb la Marta.");
    expect(d("Hem felicitat al A-03.")).toBe("Hem felicitat a en Pau.");
  });
  it("l'A-01 (gènere desconegut) agafa el gènere de la resta del text", () => {
    expect(d("La A-01 llegeix. Ara l'A-01 escriu.")).toBe("La Marta llegeix. Ara la Marta escriu.");
  });
  it("sense gènere ni vocal, posa només el nom", () => {
    expect(d("Ara l'A-01 escriu.")).toBe("Ara Marta escriu.");
  });
  it("codi sol a l'inici de frase", () => {
    expect(d("A-02 llegeix bé.")).toBe("L'Anna llegeix bé.");
  });
  it("i/u semivocal: la Iolanda", () => {
    expect(d("la A-05 participa.")).toBe("La Iolanda participa.");
  });
  it("no toca paraules que no són codis", () => {
    expect(d("La lava del volcà.")).toBe("La lava del volcà.");
  });
});

describe("helpers", () => {
  it("guessGenders per majoria", () => {
    expect(guessGenders("la A-01 i la A-01 i en A-03").get("A-01")).toBe("f");
  });
  it("nameWithArticle", () => {
    expect(nameWithArticle("Marta", "f")).toBe("la Marta");
    expect(nameWithArticle("Anna", null)).toBe("l'Anna");
  });
});
