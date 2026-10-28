import { describe, it, expect } from "vitest";
import {
  addDaysToKey,
  capitalizeFirst,
  dateOnlyKey,
  formatDayKey,
  formatInTimeZone,
  timeZoneLabel,
  timeZoneOptions,
  toZonedDateTimeInput,
  tournamentTimeZone,
  zonedDateTimeToIso,
  zonedDayKey,
  zonedMinutes,
  zonedTime,
} from "../../../lib/utils/time-zone";

const MADRID = "Europe/Madrid";
const CANARY = "Atlantic/Canary";

describe("zona del torneo (vitest corre en Europe/Madrid: lo de Canarias no puede salir del navegador)", () => {
  it("tournamentTimeZone: la del torneo; sin ella (back anterior) o no válida, Madrid", () => {
    expect(tournamentTimeZone({ timezone: CANARY })).toBe(CANARY);
    expect(tournamentTimeZone({})).toBe(MADRID);
    expect(tournamentTimeZone(null)).toBe(MADRID);
    expect(tournamentTimeZone({ timezone: "Europe/Narnia" })).toBe(MADRID);
  });

  it("el selector incluye la zona actual aunque no esté en la lista", () => {
    expect(timeZoneOptions(CANARY).map((o) => o.value)).toContain(CANARY);
    expect(timeZoneOptions("America/Mexico_City").map((o) => o.value)).toContain("America/Mexico_City");
  });

  it("el mismo instante, en cada zona", () => {
    const iso = "2026-11-20T17:00:00.000Z";
    expect(zonedTime(iso, MADRID)).toBe("18:00");
    expect(zonedTime(iso, CANARY)).toBe("17:00");
    expect(zonedMinutes(iso, CANARY)).toBe(17 * 60);
    expect(formatInTimeZone(iso, CANARY, { hour: "2-digit", minute: "2-digit" })).toBe("17:00");
    // 23:30 UTC: ya es mañana en Madrid, aún hoy en Canarias (invierno)
    expect(zonedDayKey("2026-11-20T23:30:00Z", MADRID)).toBe("2026-11-21");
    expect(zonedDayKey("2026-11-20T23:30:00Z", CANARY)).toBe("2026-11-20");
  });

  it("datetime-local: se enseña y se manda en la zona del torneo, no en la del navegador", () => {
    expect(toZonedDateTimeInput("2026-11-15T20:00:00.000Z", CANARY)).toBe("2026-11-15T20:00");
    expect(toZonedDateTimeInput("2026-11-15T20:00:00.000Z", MADRID)).toBe("2026-11-15T21:00");
    expect(zonedDateTimeToIso("2026-11-15T20:00", CANARY)).toBe("2026-11-15T20:00:00.000Z");
    expect(zonedDateTimeToIso("2026-07-06T23:00", MADRID)).toBe("2026-07-06T21:00:00.000Z");
    expect(zonedDateTimeToIso("2026-07-06T23:00", CANARY)).toBe("2026-07-06T22:00:00.000Z");
  });

  it("guardar varias veces no mueve la hora", () => {
    for (const tz of [MADRID, CANARY]) {
      let value = "2026-10-25T23:59"; // la noche del cambio de hora
      for (let i = 0; i < 3; i++) value = toZonedDateTimeInput(zonedDateTimeToIso(value, tz), tz);
      expect(value).toBe("2026-10-25T23:59");
    }
  });

  it("cambio de hora: la hora repetida es la primera vez; la que no existe se corre el salto", () => {
    expect(zonedDateTimeToIso("2026-10-25T02:30", MADRID)).toBe("2026-10-25T00:30:00.000Z");
    const gap = zonedDateTimeToIso("2026-03-29T02:30", MADRID)!;
    expect(gap).toBe("2026-03-29T01:30:00.000Z");
    expect(zonedTime(gap, MADRID)).toBe("03:30");
  });

  it("con segundos (lo que puede dar el campo) también se lee: antes se guardaba sin hora", () => {
    expect(zonedDateTimeToIso("2026-11-20T10:00:30", CANARY)).toBe("2026-11-20T10:00:00.000Z");
    expect(zonedDateTimeToIso("2026-11-20T10:00:30.500", MADRID)).toBe("2026-11-20T09:00:00.000Z");
  });

  it("timeZoneLabel: el nombre del selector, o la zona tal cual si no está", () => {
    expect(timeZoneLabel(CANARY)).toBe("Canarias");
    expect(timeZoneLabel("America/Mexico_City")).toBe("America/Mexico_City");
  });

  it("vacío o no válido: campo vacío y nada que mandar", () => {
    expect(toZonedDateTimeInput(null, MADRID)).toBe("");
    expect(toZonedDateTimeInput("no es una fecha", MADRID)).toBe("");
    expect(zonedDateTimeToIso("", MADRID)).toBeUndefined();
    expect(zonedDateTimeToIso("2026-13-45T99:99", MADRID)).toBeUndefined();
    expect(zonedDateTimeToIso("20266-10-31T20:00", MADRID)).toBeUndefined();
  });
});

describe("fechas de calendario", () => {
  it("dateOnlyKey: la medianoche UTC, tal cual", () => {
    expect(dateOnlyKey("2026-11-20T00:00:00.000Z")).toBe("2026-11-20");
    expect(dateOnlyKey(null)).toBe("");
  });

  it("dateOnlyKey: una medianoche de España (cliente antiguo) es su día, también en un torneo de Canarias", () => {
    // Invierno (+1) y verano (+2): antes se leía en la zona del torneo y en
    // Canarias salía el día anterior
    expect(dateOnlyKey("2026-11-19T23:00:00.000Z")).toBe("2026-11-20");
    expect(dateOnlyKey("2026-07-19T22:00:00.000Z")).toBe("2026-07-20");
  });

  it("formatDayKey no depende de la zona del navegador", () => {
    expect(formatDayKey("2026-11-20", { weekday: "long", day: "numeric", month: "long" })).toBe(
      "viernes, 20 de noviembre",
    );
  });

  it("addDaysToKey no repite ni salta días en el cambio de hora (el asistente generaba jornadas duplicadas)", () => {
    expect(addDaysToKey("2027-03-27", 1)).toBe("2027-03-28");
    expect(addDaysToKey("2027-03-28", 1)).toBe("2027-03-29");
    expect(addDaysToKey("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDaysToKey("2026-10-25", 1)).toBe("2026-10-26");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("capitalizeFirst", () => {
  it("solo la primera letra en mayúscula: el mes se queda como viene", () => {
    expect(capitalizeFirst("jueves, 29 de octubre de 2026")).toBe("Jueves, 29 de octubre de 2026");
    expect(
      capitalizeFirst(formatDayKey("2026-10-29", { weekday: "long", day: "numeric", month: "short" })),
    ).toBe("Jueves, 29 oct");
    expect(capitalizeFirst("")).toBe("");
  });
});
