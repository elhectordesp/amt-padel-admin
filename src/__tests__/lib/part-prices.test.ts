import { describe, it, expect } from "vitest";
import {
  daysLabel, describeSlot, draftsFromPrice, draftsToSlots, emptySlotDraft, validateSlotDrafts,
  type SlotDraft,
} from "@/lib/utils/part-prices";

const draft = (patch: Partial<SlotDraft> = {}): SlotDraft => ({ days: [1, 2, 3, 4, 5], start: "09:00", end: "14:00", price: "5", ...patch });

describe("franjas de un precio especial", () => {
  it("una franja completa vale", () => {
    expect(validateSlotDrafts([draft()])).toBeNull();
  });

  it("pide al menos una franja, con día, horas en orden y un precio válido", () => {
    expect(validateSlotDrafts([])).toMatch(/al menos una franja/);
    expect(validateSlotDrafts([emptySlotDraft()])).toMatch(/Franja 1: elige al menos un día/);
    expect(validateSlotDrafts([draft({ start: "" })])).toMatch(/hora de inicio y la de fin/);
    expect(validateSlotDrafts([draft({ start: "14:00", end: "09:00" })])).toMatch(/anterior a la de fin/);
    expect(validateSlotDrafts([draft({ price: "abc" })])).toMatch(/precio válido/);
    expect(validateSlotDrafts([draft({ price: "1001" })])).toMatch(/no puede pasar de/);
  });

  it("acepta 0 € y el tope exacto de 1.000 €", () => {
    expect(validateSlotDrafts([draft({ price: "0" })])).toBeNull();
    expect(validateSlotDrafts([draft({ price: "1000" })])).toBeNull();
  });

  it("dos franjas que se pisan un mismo día no valen; en días distintos o seguidas, sí", () => {
    expect(validateSlotDrafts([draft(), draft({ days: [5, 6], start: "13:00", end: "18:00" })])).toMatch(/franjas 1 y 2 se pisan/);
    expect(validateSlotDrafts([draft(), draft({ days: [6, 7], start: "13:00", end: "18:00" })])).toBeNull();
    expect(validateSlotDrafts([draft(), draft({ start: "14:00", end: "20:00", price: "5,5" })])).toBeNull();
  });

  it("al mandarlas al back, los días van ordenados y el precio en céntimos", () => {
    expect(draftsToSlots([draft({ days: [5, 1, 3], price: "5,50" })])).toEqual([
      { daysOfWeek: [1, 3, 5], startTime: "09:00", endTime: "14:00", priceCents: 550 },
    ]);
  });

  it("al editar, las franjas guardadas vuelven al formulario con coma decimal", () => {
    const slots = [{ daysOfWeek: [6, 7], startTime: "10:00", endTime: "12:00", priceCents: 550 }];
    expect(draftsFromPrice({ slots })).toEqual([{ days: [6, 7], start: "10:00", end: "12:00", price: "5,50" }]);
  });

  it("los días se leen como rango, lista o «Todos los días»", () => {
    expect(daysLabel([1, 2, 3, 4, 5])).toBe("Lun–Vie");
    expect(daysLabel([6, 7])).toBe("Sáb, Dom");
    expect(daysLabel([1, 3])).toBe("Lun, Mié");
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe("Todos los días");
  });

  it("una franja en una línea", () => {
    expect(describeSlot({ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "14:00", priceCents: 500 }))
      .toBe("Lun–Vie · 09:00–14:00 · 5,00 €");
  });
});
