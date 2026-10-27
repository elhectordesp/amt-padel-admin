import { describe, it, expect } from "vitest";
import { foldText, matchesSearch } from "../../../lib/utils/search";

describe("foldText", () => {
  it("quita tildes y diéresis, la ñ cuenta como n, en minúsculas", () => {
    expect(foldText("Íñigo Núñez Ibáñez")).toBe("inigo nunez ibanez");
    expect(foldText("MÁLAGA")).toBe("malaga");
    expect(foldText("Güell")).toBe("guell");
  });

  it("junta los espacios de sobra y aguanta null", () => {
    expect(foldText("  Club   Indoor ")).toBe("club indoor");
    expect(foldText(null)).toBe("");
    expect(foldText(undefined)).toBe("");
  });
});

describe("matchesSearch", () => {
  it("sin tildes en ningún lado (P3-6): «inigo», «nunez», «malaga»", () => {
    expect(matchesSearch("inigo", "Íñigo Núñez")).toBe(true);
    expect(matchesSearch("nunez", "Íñigo Núñez")).toBe(true);
    expect(matchesSearch("Núñez", "inigo nunez")).toBe(true);
    expect(matchesSearch("malaga", "Open Costa del Sol", "Pádel Indoor", "Málaga")).toBe(true);
  });

  it("varias palabras: cada una en algún campo, en cualquier orden", () => {
    expect(matchesSearch("indoor open", "Open Costa del Sol", "Pádel Indoor")).toBe(true);
    expect(matchesSearch("indoor sevilla", "Open Costa del Sol", "Pádel Indoor", "Málaga")).toBe(false);
  });

  it("vacío o solo espacios: todo pasa; los campos vacíos no rompen", () => {
    expect(matchesSearch("", "x")).toBe(true);
    expect(matchesSearch("   ")).toBe(true);
    expect(matchesSearch("pista 1", null, undefined, "Pista 1")).toBe(true);
    expect(matchesSearch("pista", null)).toBe(false);
  });
});
