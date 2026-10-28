import { describe, it, expect } from "vitest";
import { tournamentUpdatePayload } from "../../../lib/utils/tournament-update";

describe("tournamentUpdatePayload (Guardar en la edición del torneo)", () => {
  const form = {
    name: "Open",
    status: "OPEN",
    registrationDeadline: "2026-11-20T20:00",
  };

  it("sin tocar el estado no lo manda: con el torneo de antes en caché lo devolvería atrás", () => {
    // Cerradas las inscripciones (Sorteo) y la edición aún con «Abierto»
    const payload = tournamentUpdatePayload(form, { registrationDeadline: false });
    expect(payload.status).toBeUndefined();
    expect(payload.registrationDeadline).toBeUndefined();
    expect(payload.name).toBe("Open");
  });

  it("tocado en «Avanzado», sí", () => {
    expect(tournamentUpdatePayload({ ...form, status: "DRAW" }, { status: true }).status).toBe("DRAW");
  });

  it("el cierre tocado va con su zona", () => {
    const payload = tournamentUpdatePayload(form, { registrationDeadline: true });
    expect(payload.registrationDeadline).toBe(new Date("2026-11-20T20:00").toISOString());
  });
});
