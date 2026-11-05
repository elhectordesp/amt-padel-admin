/**
 * El ranking Mixto (D3): solo existe en el de circuito. En el SPA (y en el
 * clásico) el back responde 400 a gender=MX, así que el panel nunca lo pide.
 */
import { describe, it, expect } from "vitest";
import {
  RANKING_GENDER_LABEL,
  keepRankingGender,
  rankingGendersFor,
} from "@/lib/ranking-gender";

describe("rankings de cada tipo", () => {
  it("el de circuito tiene Masculino, Femenino y Mixto; el SPA, sin Mixto", () => {
    expect(rankingGendersFor("circuit")).toEqual(["M", "F", "MX"]);
    expect(rankingGendersFor("spa")).toEqual(["M", "F"]);
  });

  it("se llama «Mixto», el ranking; no «Mixta», la categoría", () => {
    expect(RANKING_GENDER_LABEL).toEqual({ M: "Masculino", F: "Femenino", MX: "Mixto" });
  });
});

describe("al cambiar de tipo", () => {
  it("del Mixto al SPA se queda en Masculino: el SPA no tiene Mixto", () => {
    expect(keepRankingGender("spa", "MX")).toBe("M");
  });

  it("Masculino y Femenino se mantienen en los dos tipos", () => {
    expect(keepRankingGender("spa", "F")).toBe("F");
    expect(keepRankingGender("spa", "M")).toBe("M");
    expect(keepRankingGender("circuit", "F")).toBe("F");
    expect(keepRankingGender("circuit", "MX")).toBe("MX");
  });
});
