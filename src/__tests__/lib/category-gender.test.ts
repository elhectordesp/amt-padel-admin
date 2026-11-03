/**
 * El género de una categoría (D2): los cinco de los organizadores, una sola
 * forma de nombrarlos en todo el panel y a quién ofrecen los buscadores (la
 * regla del back: masculina, jugadores; femenina, jugadoras; mixta, uno de
 * cada; general y junior, cualquiera).
 */
import { describe, it, expect } from "vitest";
import {
  CATEGORY_GENDER_OPTIONS,
  categoryGenderLabel,
  categoryLabel,
  genderSearchHint,
  searchGendersFor,
} from "@/lib/category-gender";

describe("nombre de la categoría", () => {
  it("los cinco, en largo y en corto (antes, todo lo que no era masculina salía «Fem.»)", () => {
    expect(categoryLabel({ gender: "M", level: "3a" })).toBe("Masc. 3ª");
    expect(categoryLabel({ gender: "F", level: "iniciacion" })).toBe("Fem. Inic.");
    expect(categoryLabel({ gender: "MX", level: "4a" })).toBe("Mixta 4ª");
    expect(categoryLabel({ gender: "G", level: "2a" })).toBe("General 2ª");
    expect(categoryLabel({ gender: "J", level: "6a" })).toBe("Junior 6ª");

    expect(categoryLabel({ gender: "M", level: "3a" }, "full")).toBe("Masculina · 3ª");
    expect(categoryLabel({ gender: "MX", level: "iniciacion" }, "full")).toBe("Mixta · Iniciación");
    expect(categoryLabel({ gender: "J", level: "5a" }, "full")).toBe("Junior · 5ª");
  });

  it("un género o un nivel que el panel no conoce, tal cual (no se cuela como otro)", () => {
    expect(categoryLabel({ gender: "MIXED", level: "3a" })).toBe("MIXED 3ª");
    expect(categoryLabel({ gender: "F", level: "7a" })).toBe("Fem. 7a");
    expect(categoryGenderLabel("toString")).toBe("toString");
  });

  it("el selector al crear una categoría ofrece los cinco, en el orden de D2", () => {
    expect(CATEGORY_GENDER_OPTIONS).toEqual([
      { value: "M",  label: "Masculina" },
      { value: "F",  label: "Femenina" },
      { value: "MX", label: "Mixta" },
      { value: "G",  label: "General" },
      { value: "J",  label: "Junior" },
    ]);
  });
});

describe("a quién ofrece el buscador de jugadores", () => {
  it("masculina, jugadores; femenina, jugadoras (con la pareja o sin ella)", () => {
    expect(searchGendersFor("M")).toEqual(["M"]);
    expect(searchGendersFor("M", "M")).toEqual(["M"]);
    expect(searchGendersFor("F")).toEqual(["F"]);
    expect(searchGendersFor("F", "F")).toEqual(["F"]);
  });

  it("mixta: el género contrario al del otro de la pareja; sin él, los dos (nunca sin género)", () => {
    expect(searchGendersFor("MX", "M")).toEqual(["F"]);
    expect(searchGendersFor("MX", "F")).toEqual(["M"]);
    expect(searchGendersFor("MX")).toEqual(["M", "F"]);
    expect(searchGendersFor("MX", null)).toEqual(["M", "F"]);
  });

  it("general, junior o un valor desconocido: sin filtro (también quien no tiene género)", () => {
    expect(searchGendersFor("G", "M")).toBeNull();
    expect(searchGendersFor("J")).toBeNull();
    expect(searchGendersFor("MIXED")).toBeNull();
  });

  it("la pista dice a quién ofrece y cómo arreglar a quien falta; sin regla, ninguna", () => {
    const admin = { canEditPlayer: true };
    expect(genderSearchHint("F", null, admin)).toBe(
      "Femenina: solo salen jugadoras con el género en su ficha. Si falta alguien, ponle el género en su ficha.",
    );
    expect(genderSearchHint("M", null, admin)).toMatch(/^Masculina: solo salen jugadores con/);
    expect(genderSearchHint("MX", "M", admin)).toMatch(/^Mixta, un jugador y una jugadora: solo salen jugadoras con/);
    expect(genderSearchHint("MX", null, admin)).toMatch(/solo salen jugadores y jugadoras con/);
    expect(genderSearchHint("G", null, admin)).toBeNull();
    expect(genderSearchHint("J", "F", admin)).toBeNull();
  });

  it("a un club, que no ve la ficha del jugador, no le pide que se la ponga él", () => {
    expect(genderSearchHint("F", null, { canEditPlayer: false })).toBe(
      "Femenina: solo salen jugadoras con el género en su ficha. Si falta alguien, pide a AMT que le ponga el género en su ficha.",
    );
  });
});
