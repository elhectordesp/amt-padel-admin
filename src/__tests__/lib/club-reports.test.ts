/**
 * Resumen de cuentas (F8, C4): moverse entre periodos, el margen, el texto del
 * gráfico y el nombre de las descargas.
 */
import { describe, it, expect } from "vitest";
import { fileNameFromDisposition } from "@/lib/services/club-reports";
import {
  formatMargin, hasNextPeriod, seriesDescription, shiftPeriodDate,
} from "@/lib/utils/club-reports";

describe("shiftPeriodDate", () => {
  it("una semana son 7 días", () => {
    expect(shiftPeriodDate("week", "2026-11-24", -1)).toBe("2026-11-17");
    expect(shiftPeriodDate("week", "2026-12-28", 1)).toBe("2027-01-04");
  });

  it("un mes, un trimestre y un año caen en el primer día del periodo pedido", () => {
    expect(shiftPeriodDate("month", "2026-11-24", -1)).toBe("2026-10-01");
    expect(shiftPeriodDate("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftPeriodDate("month", "2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftPeriodDate("quarter", "2026-11-24", -1)).toBe("2026-08-01");
    expect(shiftPeriodDate("year", "2026-11-24", -1)).toBe("2025-11-01");
  });
});

describe("hasNextPeriod", () => {
  it("no hay periodo siguiente si todavía no ha empezado", () => {
    // Martes 24/11/2026: la semana que viene empieza el lunes 30
    expect(hasNextPeriod("week", "2026-11-24", "2026-11-24")).toBe(false);
    expect(hasNextPeriod("week", "2026-11-17", "2026-11-24")).toBe(true);
    expect(hasNextPeriod("month", "2026-11-24", "2026-11-24")).toBe(false);
    expect(hasNextPeriod("month", "2026-10-01", "2026-11-24")).toBe(true);
    expect(hasNextPeriod("quarter", "2026-08-01", "2026-11-24")).toBe(true);
    expect(hasNextPeriod("quarter", "2026-11-01", "2026-11-24")).toBe(false);
    expect(hasNextPeriod("year", "2025-11-01", "2026-11-24")).toBe(true);
    expect(hasNextPeriod("year", "2026-11-24", "2026-11-24")).toBe(false);
  });

  it("el último día de un mes todavía no tiene siguiente hasta que llega el 1", () => {
    expect(hasNextPeriod("month", "2026-11-30", "2026-11-30")).toBe(false);
    expect(hasNextPeriod("month", "2026-11-30", "2026-12-01")).toBe(true);
  });
});

describe("formatMargin", () => {
  it("con coma decimal y un decimal; sin ingresos, raya", () => {
    expect(formatMargin(0.25345)).toBe("25,3 %");
    expect(formatMargin(-0.1)).toBe("-10,0 %");
    expect(formatMargin(0)).toBe("0,0 %");
    expect(formatMargin(null)).toBe("—");
  });
});

describe("seriesDescription", () => {
  it("dice cada periodo con sus ingresos y gastos", () => {
    const text = seriesDescription([
      { label: "Oct 2026", from: "2026-10-01", to: "2026-10-31", incomeCents: 150000, expenseCents: 90000, resultCents: 60000 },
    ]);
    expect(text).toContain("Oct 2026: ingresos 1500,00 €, gastos 900,00 €");
  });
});

describe("fileNameFromDisposition", () => {
  it("lee el nombre con tildes del UTF-8", () => {
    expect(
      fileNameFromDisposition(
        `attachment; filename="Cuentas Pena.xlsx"; filename*=UTF-8''Cuentas%20Pe%C3%B1a%20T4%202026.xlsx`,
        "x.xlsx",
      ),
    ).toBe("Cuentas Peña T4 2026.xlsx");
  });

  it("sin UTF-8 usa el de ASCII; sin cabecera, el de reserva", () => {
    expect(fileNameFromDisposition(`attachment; filename="Justificantes 2026-09.zip"`, "x.zip")).toBe(
      "Justificantes 2026-09.zip",
    );
    expect(fileNameFromDisposition(undefined, "Cuentas.xlsx")).toBe("Cuentas.xlsx");
  });

  it("un UTF-8 mal codificado no rompe: cae en el de ASCII", () => {
    expect(fileNameFromDisposition(`attachment; filename="a.zip"; filename*=UTF-8''%E0%A4%A`, "x.zip")).toBe("a.zip");
  });
});
