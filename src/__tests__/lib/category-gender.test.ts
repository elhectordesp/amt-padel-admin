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
  genderRejection,
  genderRejectionNotice,
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

  it("general y junior: sin filtro (también quien no tiene género)", () => {
    expect(searchGendersFor("G", "M")).toBeNull();
    expect(searchGendersFor("J")).toBeNull();
  });

  it("un género de categoría que el panel no conoce no ofrece a nadie: falla cerrado, como el back", () => {
    expect(searchGendersFor("MIXED")).toEqual([]);
    expect(searchGendersFor("MIXED", "F")).toEqual([]);
    expect(searchGendersFor("toString")).toEqual([]);
    expect(genderSearchHint("MIXED", null, { canEditPlayer: true })).toBe(
      "El panel no conoce el género de esta categoría («MIXED»): no sale nadie.",
    );
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

describe("si un jugador ya elegido puede jugar la categoría", () => {
  it("como titular: su regla; sin género, solo general y junior", () => {
    expect(genderRejection("F", "F")).toBeNull();
    expect(genderRejection("F", "M")).toBe("mismatch");
    expect(genderRejection("M", null)).toBe("unknown");
    expect(genderRejection("MX", "M")).toBeNull();
    expect(genderRejection("MX", "F")).toBeNull();
    expect(genderRejection("MX", null)).toBe("unknown");
    expect(genderRejection("G", null)).toBeNull();
    expect(genderRejection("J", "F")).toBeNull();
  });

  it("con su pareja: en la mixta, el contrario; con la pareja sin género, el suyo basta", () => {
    expect(genderRejection("MX", "F", "M")).toBeNull();
    expect(genderRejection("MX", "M", "M")).toBe("mismatch");
    expect(genderRejection("MX", null, "M")).toBe("unknown");
    expect(genderRejection("MX", "M", null)).toBeNull();
    expect(genderRejection("F", "F", "F")).toBeNull();
  });

  it("un género de categoría que el panel no conoce no lo juega nadie", () => {
    expect(genderRejection("MIXED", "M")).toBe("mismatch");
    expect(genderRejection("MIXED", null)).toBe("mismatch");
  });

  it("el aviso: la regla con las palabras del back o qué hacer si le falta el género", () => {
    const admin = { canEditPlayer: true };
    const club = { canEditPlayer: false };
    expect(genderRejectionNotice("mismatch", "F", "Luis Mora", { ...admin, goal: "partner" })).toBe(
      "\"Luis Mora\" no puede jugarla: la categoría femenina es solo de jugadoras.",
    );
    expect(genderRejectionNotice("mismatch", "MX", "Luis Mora", { ...admin, goal: "enroll" })).toBe(
      "\"Luis Mora\" no puede jugarla: la categoría mixta es de un jugador y una jugadora.",
    );
    expect(genderRejectionNotice("unknown", "MX", "Ana López", { ...admin, goal: "partner" })).toBe(
      "\"Ana López\" no tiene el género en su ficha: pónselo para buscarle pareja.",
    );
    expect(genderRejectionNotice("unknown", "M", "Leo Martín", { ...admin, goal: "enroll" })).toBe(
      "\"Leo Martín\" no tiene el género en su ficha: pónselo para que pueda jugar una categoría masculina.",
    );
    // Un club no ve la ficha del jugador: se lo pide a AMT
    expect(genderRejectionNotice("unknown", "F", "Ana López", { ...club, goal: "partner" })).toBe(
      "\"Ana López\" no tiene el género en su ficha: pide a AMT que se lo ponga para buscarle pareja.",
    );
    expect(genderRejectionNotice("mismatch", "MIXED", "Ana López", { ...admin, goal: "partner" })).toBe(
      "\"Ana López\" no puede jugarla: la categoría no lo admite.",
    );
  });
});
