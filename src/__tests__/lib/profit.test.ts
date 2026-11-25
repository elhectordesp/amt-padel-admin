import { describe, it, expect } from "vitest";
import {
  availableRows, bpsToPercentText, buildShareLines, canShare, defaultSharesMonth, equalShares, isMonthKey, monthLabel,
  monthPartners, nextMonth, partnerLabel, percentTextToBps, profitYears, sharesMonthProblem, sharesProblem, suggestedTexts,
} from "@/lib/utils/profit";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import type { ProfitMonth, ProfitPart } from "@/lib/services/profit";

const part = (partnerId: string, name: string, p: Partial<ProfitPart> = {}): ProfitPart => ({
  partnerId, name, partCents: 0, sharedCents: 0, pendingCents: 0, overSharedCents: 0, suggestedCents: 0, active: true, ...p,
});

describe("partes con fecha", () => {
  it("a partes iguales siempre suma 10.000, con el resto en los primeros", () => {
    expect(equalShares(1)).toEqual([10000]);
    expect(equalShares(2)).toEqual([5000, 5000]);
    expect(equalShares(3)).toEqual([3334, 3333, 3333]);
    expect(equalShares(6)).toEqual([1667, 1667, 1667, 1667, 1666, 1666]);
    expect(equalShares(7).reduce((t, v) => t + v, 0)).toBe(10000);
    expect(equalShares(0)).toEqual([]);
  });

  it("el mes siguiente salta de año y el de partida es el siguiente al último repartido, o el actual", () => {
    expect(nextMonth("2026-11")).toBe("2026-12");
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(defaultSharesMonth("2026-09", "2026-11")).toBe("2026-10");
    expect(defaultSharesMonth(null, "2026-11")).toBe("2026-11");
  });

  it("un mes de inicio vale si es AAAA-MM y va después del último repartido", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("")).toBe(false);
    expect(sharesMonthProblem("2026-11", null)).toBeNull();
    expect(sharesMonthProblem("2026-11", "2026-10")).toBeNull();
    expect(sharesMonthProblem("2026-10", "2026-10")).toMatch(/Ya hay repartos hasta octubre de 2026/);
    expect(sharesMonthProblem("", null)).toMatch(/Elige el mes/);
  });

  it("un socio de baja lo dice en su nombre", () => {
    expect(partnerLabel({ name: "Ana", active: true })).toBe("Ana");
    expect(partnerLabel({ name: "Ana", active: false })).toBe("Ana (de baja)");
  });
});

describe("partes de los socios", () => {
  it("de puntos básicos a porcentaje y de vuelta", () => {
    expect(bpsToPercentText(5000)).toBe("50");
    expect(bpsToPercentText(3333)).toBe("33,33");
    expect(bpsToPercentText(1250)).toBe("12,5");
    expect(bpsToPercentText(0)).toBe("0");
    expect(bpsToPercentText(10000)).toBe("100");
    expect(percentTextToBps("33,33")).toBe(3333);
    expect(percentTextToBps(" 50 % ")).toBe(5000);
    expect(percentTextToBps("12.5")).toBe(1250);
  });

  it("un porcentaje que no vale da null", () => {
    expect(percentTextToBps("")).toBeNull();
    expect(percentTextToBps("abc")).toBeNull();
    expect(percentTextToBps("100,01")).toBeNull();
    expect(percentTextToBps("-5")).toBeNull();
    expect(percentTextToBps("12,345")).toBeNull();
  });

  it("las partes tienen que sumar 100 %", () => {
    expect(sharesProblem(["50", "50"])).toBeNull();
    expect(sharesProblem(["33,33", "33,33", "33,34"])).toBeNull();
    expect(sharesProblem(["50", "40"])).toBe("Los porcentajes suman 90 %: tienen que sumar 100 %");
    expect(sharesProblem(["50", ""])).toMatch(/porcentaje válido/);
  });
});

describe("meses y años", () => {
  it("el mes se dice con palabras y los años van del actual al de inicio", () => {
    expect(monthLabel("2026-11")).toBe("noviembre de 2026");
    expect(profitYears("2025-10-01", "2026-11-25")).toEqual(["2026", "2025"]);
    expect(profitYears("2026-11-01", "2026-11-25")).toEqual(["2026"]);
  });
});

describe("meses y reparto", () => {
  const month: ProfitMonth = {
    period: "2026-10", ended: true, resultCents: 100000,
    parts: [
      part("a", "Ana", { partCents: 50000, sharedCents: 10000, pendingCents: 40000, suggestedCents: 40000 }),
      part("b", "Bea", { partCents: 50000, pendingCents: 50000, suggestedCents: 30000 }),
    ],
  };

  it("solo se reparte un mes acabado con algo pendiente", () => {
    expect(canShare(month)).toBe(true);
    expect(canShare({ ...month, ended: false })).toBe(false);
    expect(canShare({ ...month, parts: month.parts.map((p) => ({ ...p, pendingCents: 0 })) })).toBe(false);
  });

  it("los socios de la tabla salen una vez, en orden", () => {
    expect(monthPartners([month, { ...month, period: "2026-11" }])).toEqual([
      { partnerId: "a", name: "Ana", active: true }, { partnerId: "b", name: "Bea", active: true },
    ]);
  });

  it("los importes sugeridos pasan al campo en euros", () => {
    expect(suggestedTexts(month.parts)).toEqual({ a: "400,00", b: "300,00" });
    expect(suggestedTexts([part("c", "Cai")])).toEqual({ c: "" });
  });
});

describe("importes del reparto", () => {
  const parts = [
    part("a", "Ana", { pendingCents: 40000 }),
    part("b", "Bea", { pendingCents: 50000 }),
  ];

  it("suma lo escrito y salta lo vacío o a cero", () => {
    const r = buildShareLines(parts, { a: "100", b: "0" }, 500000);
    expect(r.lines).toEqual([{ partnerId: "a", amountCents: 10000 }]);
    expect(r.totalCents).toBe(10000);
    expect(r.problem).toBeNull();
    expect(r.errors).toEqual({});
  });

  it("un importe no puede pasar de lo pendiente de su socio", () => {
    const r = buildShareLines(parts, { a: "400,01" }, 500000);
    expect(r.errors.a).toMatch(/lo pendiente/);
  });

  it("un importe que no es número da error", () => {
    expect(buildShareLines(parts, { a: "mucho" }, 500000).errors.a).toMatch(/importe válido/);
  });

  it("la suma no puede pasar del disponible, ni se reparte sin importes", () => {
    expect(buildShareLines(parts, { a: "300", b: "300" }, 50000).problem).toMatch(/disponibles/);
    expect(buildShareLines(parts, { a: "300", b: "300" }, -100).problem).toMatch(/0,00/);
    expect(buildShareLines(parts, {}, 50000).problem).toMatch(/al menos un socio/);
  });
});

describe("disponible desglosado", () => {
  it("las restas salen negativas y las sumas, con su signo", () => {
    const rows = availableRows({
      cashCents: 1000, bankCents: 2000, heldCents: 300, partnerAccountsCents: -400, coachesOwedCents: 500,
      unpaidExpensesCents: 600, fundCents: 700, reserveCents: 800, availableCents: 0,
    });
    expect(rows.map((r) => r.cents)).toEqual([1000, 2000, 300, -400, -500, -600, -700, -800]);
    expect(rows.reduce((t, r) => t + r.cents, 0)).toBe(300);
  });
});

describe("textos de error del reparto", () => {
  it("cada código del back tiene su frase", () => {
    for (const code of [
      "PROFIT_SHARES_INVALID", "PROFIT_SHARE_PERIOD_INVALID", "PROFIT_SHARE_EXCEEDS_PENDING",
      "PROFIT_SHARE_NOT_AVAILABLE", "PROFIT_SHARE_NOT_FOUND", "PROFIT_SHARES_LOCKED", "LEDGER_CATEGORY_HAS_ENTRIES",
    ]) {
      expect(accountsErrorText({ code, message: "x" })).not.toBe("x");
    }
  });
});
