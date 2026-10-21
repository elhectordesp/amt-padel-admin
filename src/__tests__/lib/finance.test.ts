import { describe, it, expect } from "vitest";
import { DEFAULT_VAT_RATE, splitVat } from "../../../lib/utils/finance";

describe("splitVat — sin IVA = importe ÷ (1 + IVA)", () => {
  it("el caso de la QA: 536 € son 442,98 € + 93,02 € de IVA (no 466,23 + 69,77)", () => {
    const v = splitVat(536);

    expect(v.withVat).toBe(536);
    expect(v.withoutVat).toBeCloseTo(442.98, 2);
    expect(v.vat).toBeCloseTo(93.02, 2);
    expect(v.withoutVat + v.vat).toBeCloseTo(536, 10);
  });

  it("por defecto, el 21 %; con otro tipo, el que se le pase", () => {
    expect(DEFAULT_VAT_RATE).toBe(0.21);
    expect(splitVat(121).withoutVat).toBeCloseTo(100, 10);
    expect(splitVat(110, 0.1).vat).toBeCloseTo(10, 10);
  });

  it("cero es cero", () => {
    expect(splitVat(0)).toEqual({ withVat: 0, withoutVat: 0, vat: 0 });
  });
});
