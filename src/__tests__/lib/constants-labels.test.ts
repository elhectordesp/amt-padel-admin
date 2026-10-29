/**
 * Textos del panel sin códigos internos (P3-11): estados de inscripción,
 * fases de categoría y entradas del historial.
 */
import { describe, it, expect } from "vitest";
import {
  auditActionText,
  auditResourceLabel,
  phaseLabel,
  registrationStatusLabel,
  trendLabel,
} from "@/lib/constants";

describe("etiquetas de códigos del back", () => {
  it("estado de una inscripción", () => {
    expect(registrationStatusLabel("WAITLIST")).toBe("En espera");
    expect(registrationStatusLabel("CONFIRMED")).toBe("Confirmado");
    expect(registrationStatusLabel("RARO")).toBe("RARO");
  });

  it("fase de un partido o de una categoría: una sola tabla", () => {
    // Las de una categoría (salía «REGISTRATION» en el Cuadro)
    expect(phaseLabel("REGISTRATION")).toBe("Inscripciones");
    expect(phaseLabel("FINISHED")).toBe("Finalizada");
    expect(phaseLabel("CONSOLATION")).toBe("Consolación");
    // Las de un partido, también en minúsculas
    expect(phaseLabel("SF")).toBe("Semifinal");
    expect(phaseLabel("qf")).toBe("Cuartos");
    expect(phaseLabel("RARA")).toBe("RARA");
    expect(phaseLabel(null)).toBe("—");
  });

  it("tendencia de un jugador", () => {
    expect(trendLabel("up")).toBe("Subiendo");
    expect(trendLabel("down")).toBe("Bajando");
    expect(trendLabel("stable")).toBe("Estable");
    expect(trendLabel(undefined)).toBe("Estable");
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
