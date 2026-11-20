import { describe, it, expect } from "vitest";
import { isValidSetScore, matchScoreIssue } from "../../../lib/utils/match-score";
import type { ScoringFormat } from "../../../types";

const set = (a: number, b: number) => ({ a, b });
/** Un marcador de un set, con el ganador a un lado y al otro. */
const bothWays = (pairs: [number, number][]) => pairs.flatMap(([a, b]) => [[a, b], [b, a]] as [number, number][]);

describe("isValidSetScore (el límite de cada clase de set)", () => {
  it("standard: 6-0 a 6-4, 7-5 y 7-6; no 6-5, 7-4 ni 8-6", () => {
    for (const [a, b] of bothWays([[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6]])) {
      expect(isValidSetScore("standard", a, b), `${a}-${b}`).toBe(true);
    }
    for (const [a, b] of bothWays([[6, 5], [7, 4], [7, 0], [8, 6], [5, 3], [8, 0]])) {
      expect(isValidSetScore("standard", a, b), `${a}-${b}`).toBe(false);
    }
  });

  it("shortSet: 6-0 a 6-4 y 6-5; no 7-5, 7-6 ni un set que no llega a 6", () => {
    for (const [a, b] of bothWays([[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]])) {
      expect(isValidSetScore("shortSet", a, b), `${a}-${b}`).toBe(true);
    }
    for (const [a, b] of bothWays([[7, 5], [7, 6], [5, 3], [5, 4], [4, 0], [8, 6]])) {
      expect(isValidSetScore("shortSet", a, b), `${a}-${b}`).toBe(false);
    }
  });

  it("pro9: 9-0 a 9-8; no 10-8, 10-9 ni 8-6", () => {
    for (const [a, b] of bothWays([[9, 0], [9, 4], [9, 7], [9, 8]])) {
      expect(isValidSetScore("pro9", a, b), `${a}-${b}`).toBe(true);
    }
    for (const [a, b] of bothWays([[10, 8], [10, 9], [8, 6], [6, 4], [11, 9]])) {
      expect(isValidSetScore("pro9", a, b), `${a}-${b}`).toBe(false);
    }
  });

  it("superTb: 10-0 a 10-8 y, desde 9-9, de 2 en 2 (11-9, 12-10…); no 10-9, 11-8 ni 99-0", () => {
    for (const [a, b] of bothWays([[10, 0], [10, 8], [11, 9], [12, 10], [20, 18]])) {
      expect(isValidSetScore("superTb", a, b), `${a}-${b}`).toBe(true);
    }
    for (const [a, b] of bothWays([[10, 9], [11, 8], [13, 10], [15, 3], [99, 0], [9, 7]])) {
      expect(isValidSetScore("superTb", a, b), `${a}-${b}`).toBe(false);
    }
  });
});

describe("matchScoreIssue — un set", () => {
  it("ONE_SET: vale 6-0 a 6-4, 7-5 y 7-6; 6-5 se rechaza (el set no se decide a 5-5)", () => {
    for (const [a, b] of bothWays([[6, 0], [6, 4], [7, 5], [7, 6]])) {
      expect(matchScoreIssue([set(a, b)], "ONE_SET"), `${a}-${b}`).toBeNull();
    }
    expect(matchScoreIssue([set(6, 5)], "ONE_SET")).toBe("Set 1: resultado inválido (6-5). Esperado: 6-0 a 6-4, 7-5 o 7-6");
    expect(matchScoreIssue([set(7, 4)], "ONE_SET")).toContain("resultado inválido");
  });

  it("ONE_SET_GOLDEN_GAME: vale 6-0 a 6-4 y 6-5; 7-5 y 7-6 se rechazan", () => {
    for (const [a, b] of bothWays([[6, 0], [6, 4], [6, 5]])) {
      expect(matchScoreIssue([set(a, b)], "ONE_SET_GOLDEN_GAME"), `${a}-${b}`).toBeNull();
    }
    expect(matchScoreIssue([set(7, 5)], "ONE_SET_GOLDEN_GAME")).toBe("Set 1: resultado inválido (7-5). Esperado: 6-0 a 6-4 o 6-5");
    expect(matchScoreIssue([set(7, 6)], "ONE_SET_GOLDEN_GAME")).toContain("resultado inválido");
  });

  it("PRO_SET_9: 9-8 vale y 10-8 se rechaza, con el marcador esperado", () => {
    for (const [a, b] of bothWays([[9, 0], [9, 8]])) {
      expect(matchScoreIssue([set(a, b)], "PRO_SET_9"), `${a}-${b}`).toBeNull();
    }
    expect(matchScoreIssue([set(10, 8)], "PRO_SET_9")).toBe("Set 1: resultado inválido (10-8). Esperado: 9-0 a 9-8");
    expect(matchScoreIssue([set(6, 4)], "PRO_SET_9")).toContain("resultado inválido");
  });

  it.each<ScoringFormat>(["ONE_SET", "ONE_SET_GOLDEN_GAME", "PRO_SET_9"])("%s: un empate no vale", (format) => {
    expect(matchScoreIssue([set(6, 6)], format)).toBe("Set 1: no puede haber empate");
  });

  it.each<ScoringFormat>(["ONE_SET", "ONE_SET_GOLDEN_GAME", "PRO_SET_9"])("%s: es un solo set, ni más ni menos", (format) => {
    expect(matchScoreIssue([], format)).toBe("Falta el resultado del set");
    expect(matchScoreIssue([set(6, 0), set(6, 0)], format)).toBe("Hay sets de más: este formato se juega a un solo set");
  });
});

describe("matchScoreIssue — al mejor de tres", () => {
  it("SHORT_SETS_SUPERTB: sets a 6-5 como máximo y súper tie-break como 3.º", () => {
    expect(matchScoreIssue([set(6, 5), set(5, 6), set(10, 8)], "SHORT_SETS_SUPERTB")).toBeNull();
    expect(matchScoreIssue([set(6, 4), set(6, 5)], "SHORT_SETS_SUPERTB")).toBeNull();
    expect(matchScoreIssue([set(6, 4), set(4, 6), set(12, 10)], "SHORT_SETS_SUPERTB")).toBeNull();
    // 7-5 y 7-6 no valen en los sets cortos (es el tie-break a 5-5)
    expect(matchScoreIssue([set(7, 5), set(6, 4)], "SHORT_SETS_SUPERTB")).toBe("Set 1: resultado inválido (7-5). Esperado: 6-0 a 6-4 o 6-5");
    expect(matchScoreIssue([set(6, 4), set(7, 6)], "SHORT_SETS_SUPERTB")).toContain("Set 2: resultado inválido (7-6)");
  });

  it("SHORT_SETS_SUPERTB: el 3.º es súper tie-break a 10, no un set", () => {
    expect(matchScoreIssue([set(6, 4), set(4, 6), set(6, 4)], "SHORT_SETS_SUPERTB")).toContain("Set 3: resultado inválido (6-4)");
    expect(matchScoreIssue([set(6, 4), set(4, 6), set(10, 9)], "SHORT_SETS_SUPERTB")).toContain("Set 3: resultado inválido (10-9)");
    expect(matchScoreIssue([set(6, 4), set(4, 6), set(11, 8)], "SHORT_SETS_SUPERTB")).toContain("Set 3: resultado inválido (11-8)");
  });

  it.each<[ScoringFormat, [number, number]]>([
    ["BEST_OF_3", [6, 0]],
    ["BEST_OF_2_SUPERTB", [10, 0]],
    ["SHORT_SETS_SUPERTB", [10, 0]],
  ])("%s: gana quien llega a 2 sets, sin sets de más ni de menos", (format, [thirdA, thirdB]) => {
    expect(matchScoreIssue([set(6, 3), set(3, 6)], format)).toBe("Partido incompleto: el ganador debe ganar 2 sets");
    expect(matchScoreIssue([set(6, 3)], format)).toBe("Partido incompleto: el ganador debe ganar 2 sets");
    // Un 3.º válido después de ganar los dos primeros el mismo
    expect(matchScoreIssue([set(6, 0), set(6, 0), set(thirdA, thirdB)], format)).toBe(
      "Hay sets de más: el partido ya estaba decidido al ganar 2 sets",
    );
  });

  it("BEST_OF_3: tres sets normales; 6-5 se rechaza y el 3.º no es súper tie-break", () => {
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(7, 6)], "BEST_OF_3")).toBeNull();
    expect(matchScoreIssue([set(6, 3), set(7, 5)], "BEST_OF_3")).toBeNull();
    expect(matchScoreIssue([set(6, 5), set(6, 3)], "BEST_OF_3")).toContain("Set 1: resultado inválido (6-5)");
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(10, 8)], "BEST_OF_3")).toContain("Set 3: resultado inválido (10-8)");
  });

  it("BEST_OF_2_SUPERTB: el 3.º es súper tie-break (como hoy)", () => {
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(10, 8)], "BEST_OF_2_SUPERTB")).toBeNull();
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(11, 9)], "BEST_OF_2_SUPERTB")).toBeNull();
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(10, 9)], "BEST_OF_2_SUPERTB")).toContain("resultado inválido");
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(10, 10)], "BEST_OF_2_SUPERTB")).toBe("Set 3: no puede haber empate");
    // 7-6 en los dos primeros sí vale (set normal)
    expect(matchScoreIssue([set(7, 6), set(6, 7), set(10, 8)], "BEST_OF_2_SUPERTB")).toBeNull();
  });

  it("más de tres sets son sets de más", () => {
    expect(matchScoreIssue([set(6, 3), set(3, 6), set(6, 3), set(6, 3)], "BEST_OF_3")).toBe(
      "Hay sets de más: el partido ya estaba decidido al ganar 2 sets",
    );
  });
});

describe("matchScoreIssue — valores sueltos", () => {
  it("negativos y decimales", () => {
    expect(matchScoreIssue([set(-1, 6), set(6, 3)], "BEST_OF_3")).toBe("Set 1: los valores deben ser números enteros no negativos");
    expect(matchScoreIssue([set(6.5, 3)], "ONE_SET")).toBe("Set 1: los valores deben ser números enteros no negativos");
    expect(matchScoreIssue([set(NaN, 3)], "PRO_SET_9")).toBe("Set 1: los valores deben ser números enteros no negativos");
  });
});
