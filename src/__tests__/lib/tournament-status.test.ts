/**
 * Los cambios de estado habituales (los del back sin forzar): el desplegable
 * de Editar → Avanzado marca los demás (E02, F05).
 */
import { describe, it, expect } from "vitest";
import { isStandardTransition, standardNextStatuses } from "@/lib/utils/tournament-status";

describe("tournament-status", () => {
  it("los pasos del flujo son habituales; quedarse igual, también", () => {
    expect(isStandardTransition("DRAFT", "OPEN")).toBe(true);
    expect(isStandardTransition("DRAW", "SCHEDULED")).toBe(true);
    expect(isStandardTransition("OPEN", "OPEN")).toBe(true);
  });

  it("los saltos piden forzar (Borrador → Sorteo, Sorteo → En curso)", () => {
    expect(isStandardTransition("DRAFT", "DRAW")).toBe(false);
    expect(isStandardTransition("DRAW", "ONGOING")).toBe(false);
    expect(isStandardTransition("FINISHED", "ONGOING")).toBe(false);
  });

  it("desde un estado, sus pasos habituales", () => {
    expect(standardNextStatuses("SCHEDULED")).toEqual(["ONGOING", "DRAW", "CANCELLED"]);
    expect(standardNextStatuses("FINISHED")).toEqual([]);
  });
});
