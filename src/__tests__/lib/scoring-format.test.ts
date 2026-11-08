import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCORING_FORMAT,
  SCORING_FORMATS,
  SCORING_FORMAT_OPTIONS,
  isScoringFormat,
  minSets,
  scoreHint,
  scoringFormatLabel,
  setKinds,
  typicalDurationText,
} from "../../../lib/scoring-format";

describe("formatos de partido (la tabla del contrato B5-2)", () => {
  it("son los seis, con los dos de siempre primero", () => {
    expect(SCORING_FORMATS).toEqual([
      "BEST_OF_3",
      "BEST_OF_2_SUPERTB",
      "ONE_SET",
      "ONE_SET_GOLDEN_GAME",
      "PRO_SET_9",
      "SHORT_SETS_SUPERTB",
    ]);
    expect(DEFAULT_SCORING_FORMAT).toBe("BEST_OF_3");
  });

  it("el texto de cada uno en panel y visor", () => {
    expect(SCORING_FORMAT_OPTIONS).toEqual([
      { value: "BEST_OF_3",          label: "3 sets" },
      { value: "BEST_OF_2_SUPERTB",  label: "2 sets + súper tie-break" },
      { value: "ONE_SET",            label: "1 set (tie-break a 6-6)" },
      { value: "ONE_SET_GOLDEN_GAME", label: "1 set (juego decisivo a 5-5)" },
      { value: "PRO_SET_9",          label: "A 9 juegos" },
      { value: "SHORT_SETS_SUPERTB", label: "2 sets (tie-break a 5-5) + súper tie-break" },
    ]);
    expect(scoringFormatLabel("PRO_SET_9")).toBe("A 9 juegos");
  });

  it("un formato que el panel no conoce se dice tal cual, y no cuenta como formato", () => {
    expect(scoringFormatLabel("BEST_OF_5")).toBe("BEST_OF_5");
    expect(isScoringFormat("BEST_OF_5")).toBe(false);
    expect(isScoringFormat(undefined)).toBe(false);
    expect(isScoringFormat("toString")).toBe(false);
    expect(SCORING_FORMATS.every(isScoringFormat)).toBe(true);
  });

  it("la duración típica de cada uno, como pista", () => {
    expect(typicalDurationText("BEST_OF_3")).toBe("Suele durar unos 75 min");
    expect(typicalDurationText("BEST_OF_2_SUPERTB")).toBe("Suele durar unos 60 min");
    expect(typicalDurationText("ONE_SET")).toBe("Suele durar unos 30 min");
    expect(typicalDurationText("ONE_SET_GOLDEN_GAME")).toBe("Suele durar unos 30 min");
    expect(typicalDurationText("PRO_SET_9")).toBe("Suele durar unos 45 min");
    expect(typicalDurationText("SHORT_SETS_SUPERTB")).toBe("Suele durar unos 60 min");
  });

  it("las casillas de set: una en los de un set, tres en los demás (la 3.ª, súper tie-break donde toca)", () => {
    expect(setKinds("BEST_OF_3")).toEqual(["standard", "standard", "standard"]);
    expect(setKinds("BEST_OF_2_SUPERTB")).toEqual(["standard", "standard", "superTb"]);
    expect(setKinds("ONE_SET")).toEqual(["standard"]);
    expect(setKinds("ONE_SET_GOLDEN_GAME")).toEqual(["shortSet"]);
    expect(setKinds("PRO_SET_9")).toEqual(["pro9"]);
    expect(setKinds("SHORT_SETS_SUPERTB")).toEqual(["shortSet", "shortSet", "superTb"]);
    expect(SCORING_FORMATS.map(minSets)).toEqual([2, 2, 1, 1, 1, 2]);
  });

  it("el marcador esperado de cada uno, para la pista del resultado", () => {
    expect(scoreHint("ONE_SET")).toBe("1 set: 6-0 a 6-4, 7-5 o 7-6");
    expect(scoreHint("ONE_SET_GOLDEN_GAME")).toBe("1 set: 6-0 a 6-4 o 6-5");
    expect(scoreHint("PRO_SET_9")).toBe("a 9 juegos: 9-0 a 9-8");
  });
});
