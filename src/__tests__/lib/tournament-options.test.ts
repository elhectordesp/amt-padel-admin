import { describe, it, expect } from "vitest";
import {
  DEFAULT_TOURNAMENT_DEFAULTS,
  hideFromAppLabel,
  matchDurationOptions,
  tournamentDefaultsFromConfig,
  tournamentDefaultsIssues,
  tournamentDefaultsPayload,
  untouchedChanges,
} from "../../../lib/utils/tournament-options";
import type { ClubTournamentConfig } from "../../../types";

const CONFIG: ClubTournamentConfig = {
  id: "cfg-1",
  clubId: "club-1",
  ...DEFAULT_TOURNAMENT_DEFAULTS,
  format: "grupos+eliminatoria",
  matchDuration: 90,
  categorySpots: 16,
  description: null,
  rules: "Puntualidad",
};

describe("untouchedChanges (los valores del club, solo en lo que no se ha tocado)", () => {
  type V = { format: string; matchDuration: number; hideFromAppAfterDays: number | null; description: string };
  const keys = ["format", "matchDuration", "hideFromAppAfterDays", "description"] as const;
  const applied: V = { format: "eliminatoria", matchDuration: 60, hideFromAppAfterDays: null, description: "" };
  const club: V = { format: "grupos+eliminatoria", matchDuration: 90, hideFromAppAfterDays: 7, description: "Open" };

  it("sin tocar nada, todo pasa a los del club", () => {
    expect(untouchedChanges<V, keyof V>(applied, applied, club, keys)).toEqual(club);
  });

  it("lo cambiado a mano se queda, aunque se vuelva a aplicar", () => {
    const current = { ...applied, format: "round-robin", hideFromAppAfterDays: 0 };
    expect(untouchedChanges<V, keyof V>(current, applied, club, keys)).toEqual({
      matchDuration: 90,
      description: "Open",
    });
  });

  it("un campo sin valor aún (el formulario no lo tenía) cuenta como no tocado", () => {
    expect(untouchedChanges<V, keyof V>({ format: "eliminatoria" }, applied, club, keys)).toEqual(club);
  });

  it("otro club: lo que seguía con los del primero pasa a los del segundo", () => {
    const other: V = { format: "cuadro", matchDuration: 120, hideFromAppAfterDays: null, description: "" };
    const current = { ...club, matchDuration: 60 };
    expect(untouchedChanges<V, keyof V>(current, club, other, keys)).toEqual({
      format: "cuadro",
      hideFromAppAfterDays: null,
      description: "",
    });
  });

  it("si ya tiene el valor, no hay cambio", () => {
    expect(untouchedChanges<V, keyof V>(club, applied, club, keys)).toEqual({});
  });
});

describe("tournamentDefaultsFromConfig / tournamentDefaultsPayload", () => {
  it("quita id y club, y los textos null son vacíos para el formulario", () => {
    const values = tournamentDefaultsFromConfig(CONFIG);
    expect(values).not.toHaveProperty("id");
    expect(values).not.toHaveProperty("clubId");
    expect(values).toMatchObject({ format: "grupos+eliminatoria", categorySpots: 16, description: "", rules: "Puntualidad" });
  });

  it("al guardar, los textos van sin espacios en los bordes y vacíos como null", () => {
    const payload = tournamentDefaultsPayload({ ...DEFAULT_TOURNAMENT_DEFAULTS, description: "   ", rules: "  Normas\n del club \n" });
    expect(payload.description).toBeNull();
    expect(payload.rules).toBe("Normas\n del club");
    expect(payload).not.toHaveProperty("id");
  });
});

describe("tournamentDefaultsIssues (las reglas del back)", () => {
  const ok = DEFAULT_TOURNAMENT_DEFAULTS;

  it("los de siempre valen", () => {
    expect(tournamentDefaultsIssues(ok)).toEqual({});
  });

  it("la hora de fin tiene que ser posterior a la de inicio", () => {
    expect(tournamentDefaultsIssues({ ...ok, dayStartTime: "21:00", dayEndTime: "21:00" })).toEqual({
      dayEndTime: "La hora de fin debe ser posterior a la de inicio",
    });
    expect(tournamentDefaultsIssues({ ...ok, dayEndTime: "" }).dayEndTime).toBe("Pon la hora de fin");
  });

  it("plazas de 4 a 128, precio entero y no negativo, días de 0 a 365", () => {
    expect(tournamentDefaultsIssues({ ...ok, categorySpots: 3 }).categorySpots).toBeDefined();
    expect(tournamentDefaultsIssues({ ...ok, categorySpots: 129 }).categorySpots).toBeDefined();
    expect(tournamentDefaultsIssues({ ...ok, categoryPrice: -1 }).categoryPrice).toBeDefined();
    expect(tournamentDefaultsIssues({ ...ok, categoryPrice: 12.5 }).categoryPrice).toBeDefined();
    expect(tournamentDefaultsIssues({ ...ok, hideFromAppAfterDays: 0 })).toEqual({});
    expect(tournamentDefaultsIssues({ ...ok, hideFromAppAfterDays: 366 }).hideFromAppAfterDays).toBe("Entre 0 y 365 días");
    // El campo vacío (NaN) tampoco vale
    expect(tournamentDefaultsIssues({ ...ok, hideFromAppAfterDays: NaN }).hideFromAppAfterDays).toBeDefined();
    expect(tournamentDefaultsIssues({ ...ok, maxUnavailableTotalHours: NaN }).maxUnavailableTotalHours).toBeDefined();
  });

  it("la descripción hasta 5.000 caracteres y las normas hasta 10.000, sin contar los espacios de los bordes", () => {
    expect(tournamentDefaultsIssues({ ...ok, description: "a".repeat(5000) + "   " })).toEqual({});
    // Con cuatro cifras, el español no separa los miles
    expect(tournamentDefaultsIssues({ ...ok, description: "a".repeat(5001) }).description).toBe("Máximo 5000 caracteres");
    expect(tournamentDefaultsIssues({ ...ok, rules: "a".repeat(10001) }).rules).toBe("Máximo 10.000 caracteres");
  });
});

describe("matchDurationOptions", () => {
  it("las del asistente; si la guardada es otra, también sale, en su orden", () => {
    expect(matchDurationOptions(60).map((o) => o.value)).toEqual(["60", "90", "120"]);
    expect(matchDurationOptions(45).map((o) => o.value)).toEqual(["45", "60", "90", "120"]);
  });
});

describe("hideFromAppLabel", () => {
  it("nunca, al acabar, o los días", () => {
    expect(hideFromAppLabel(null)).toBe("Nunca");
    expect(hideFromAppLabel(0)).toBe("Al acabar el último día");
    expect(hideFromAppLabel(1)).toBe("1 día después del último día");
    expect(hideFromAppLabel(7)).toBe("7 días después del último día");
  });
});
