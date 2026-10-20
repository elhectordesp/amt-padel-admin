import { describe, it, expect } from "vitest";
import {
  localDateTimeToIso,
  localDayKey,
  toLocalDateTimeInput,
} from "../../../lib/utils/date-keys";

describe("toLocalDateTimeInput / localDateTimeToIso (datetime-local)", () => {
  it("el campo enseña la hora LOCAL del instante, no la UTC", () => {
    const d = new Date(2026, 6, 6, 9, 5); // 6 jul 2026 09:05 local
    expect(toLocalDateTimeInput(d)).toBe("2026-07-06T09:05");
    expect(toLocalDateTimeInput(d.toISOString())).toBe("2026-07-06T09:05");
  });

  it("lo escrito se manda como el instante local, con zona", () => {
    expect(localDateTimeToIso("2026-07-06T23:00")).toBe(
      new Date(2026, 6, 6, 23, 0).toISOString(),
    );
  });

  it("guardar varias veces no mueve la hora (antes se adelantaba 1-2 h en cada guardado)", () => {
    let value = "2026-10-25T23:59"; // la noche del cambio de hora, además
    for (let i = 0; i < 3; i++) value = toLocalDateTimeInput(localDateTimeToIso(value));
    expect(value).toBe("2026-10-25T23:59");
  });

  it("vacío o no válido: campo vacío y nada que mandar", () => {
    expect(toLocalDateTimeInput(null)).toBe("");
    expect(toLocalDateTimeInput("no es una fecha")).toBe("");
    expect(localDateTimeToIso("")).toBeUndefined();
    expect(localDateTimeToIso(undefined)).toBeUndefined();
    expect(localDateTimeToIso("2026-13-45T99:99")).toBeUndefined();
  });
});

describe("localDayKey", () => {
  it("formatea YYYY-MM-DD con padding", () => {
    // 1 enero 2026 a las 12:00 local — sin importar TZ
    const d = new Date(2026, 0, 1, 12, 0, 0);
    expect(localDayKey(d)).toBe("2026-01-01");
  });

  it("pad mes y día de un dígito", () => {
    const d = new Date(2026, 8, 5, 9, 30); // 5 sept 2026 09:30 local
    expect(localDayKey(d)).toBe("2026-09-05");
  });

  it("usa día LOCAL aunque sea medianoche (caso problemático)", () => {
    // Punto crítico: medianoche local en Madrid (UTC+2 en verano) es
    // 22:00 UTC del día anterior. toISOString().slice(0,10) daría el
    // día anterior; localDayKey debe devolver el día LOCAL correcto.
    const d = new Date(2026, 5, 29, 0, 0, 0); // 29 jun 2026 00:00 local
    expect(localDayKey(d)).toBe("2026-06-29");
  });

  it("último día del año a las 23:59", () => {
    const d = new Date(2026, 11, 31, 23, 59);
    expect(localDayKey(d)).toBe("2026-12-31");
  });
});
