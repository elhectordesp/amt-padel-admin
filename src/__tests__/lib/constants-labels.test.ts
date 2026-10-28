/**
 * Textos del panel sin códigos internos (P3-11): estados de inscripción,
 * fases de categoría y entradas del historial.
 */
import { describe, it, expect } from "vitest";
import {
  auditActionText,
  auditResourceLabel,
  categoryPhaseLabel,
  registrationStatusLabel,
} from "@/lib/constants";

describe("etiquetas de códigos del back", () => {
  it("estado de una inscripción", () => {
    expect(registrationStatusLabel("WAITLIST")).toBe("En espera");
    expect(registrationStatusLabel("CONFIRMED")).toBe("Confirmado");
    expect(registrationStatusLabel("RARO")).toBe("RARO");
  });

  it("fase de una categoría", () => {
    expect(categoryPhaseLabel("REGISTRATION")).toBe("Inscripciones");
    expect(categoryPhaseLabel("SF")).toBe("Semifinales");
    expect(categoryPhaseLabel("FINISHED")).toBe("Finalizada");
    expect(categoryPhaseLabel(null)).toBe("—");
  });

  it("recurso del historial", () => {
    expect(auditResourceLabel("sponsor")).toBe("Patrocinador");
    expect(auditResourceLabel("registration")).toBe("Inscripción");
    expect(auditResourceLabel("otro")).toBe("otro");
  });

  it("acción del historial como frase sobre alguien", () => {
    expect(auditActionText({ action: "JUGADOR_EDITADO_POR_ADMIN", actionLabel: "editó al jugador" }, "Ana López"))
      .toBe("Editó al jugador Ana López");
    // Sin etiqueta propia (el back devuelve el código): legible, sin inventar frase
    expect(auditActionText({ action: "ACCION_NUEVA", actionLabel: "ACCION_NUEVA" }, "Ana")).toBe("ACCION NUEVA");
    expect(auditActionText({ action: "ACCION_NUEVA" }, "Ana")).toBe("ACCION NUEVA");
  });
});
