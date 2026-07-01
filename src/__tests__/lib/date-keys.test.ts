import { describe, it, expect } from "vitest";
import { localDayKey } from "../../../lib/utils/date-keys";

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
