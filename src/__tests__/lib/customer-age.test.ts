import { describe, it, expect } from "vitest";
import { ADULT_AGE, GUARDIAN_CONSENT_AGE, ageOn } from "@/lib/utils/customer-age";

describe("ageOn", () => {
  it("cumple años el día de su cumpleaños, no antes", () => {
    expect(ageOn("2012-11-19", "2026-11-18")).toBe(13);
    expect(ageOn("2012-11-19", "2026-11-19")).toBe(14);
    expect(ageOn("2012-11-19", "2026-11-20")).toBe(14);
  });

  it("mes posterior y mes anterior al del cumpleaños", () => {
    expect(ageOn("2010-12-31", "2026-11-30")).toBe(15);
    expect(ageOn("2010-01-01", "2026-11-30")).toBe(16);
  });

  it("nacido un 29 de febrero: cumple el 1 de marzo en año sin 29", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });

  it("una fecha futura da una edad negativa (el formulario la rechaza)", () => {
    expect(ageOn("2026-11-19", "2026-11-18")).toBe(-1);
  });

  it("los umbrales son 14 (consentimiento del tutor) y 18 (mayoría de edad)", () => {
    expect(GUARDIAN_CONSENT_AGE).toBe(14);
    expect(ADULT_AGE).toBe(18);
  });
});
