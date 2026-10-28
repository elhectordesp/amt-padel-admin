import { describe, it, expect } from "vitest";
import { tournamentUpdatePayload } from "../../../lib/utils/tournament-update";

describe("tournamentUpdatePayload (Guardar en la edición del torneo)", () => {
  const form = {
    name: "Open",
    status: "OPEN",
    registrationDeadline: "2026-11-20T20:00",
    timezone: "Europe/Madrid",
  };

  it("sin tocar el estado no lo manda: con el torneo de antes en caché lo devolvería atrás", () => {
    // Cerradas las inscripciones (Sorteo) y la edición aún con «Abierto»
    const payload = tournamentUpdatePayload(form, { registrationDeadline: false });
    expect(payload.status).toBeUndefined();
    expect(payload.registrationDeadline).toBeUndefined();
    expect(payload.timezone).toBeUndefined();
    expect(payload.name).toBe("Open");
  });

  it("tocado en «Avanzado», sí", () => {
    expect(tournamentUpdatePayload({ ...form, status: "DRAW" }, { status: true }).status).toBe("DRAW");
  });

  it("el cierre tocado va como instante, en la zona del torneo (no en la del navegador)", () => {
    // Madrid en noviembre: +1
    expect(tournamentUpdatePayload(form, { registrationDeadline: true }).registrationDeadline).toBe(
      "2026-11-20T19:00:00.000Z",
    );
    // Canarias en noviembre: +0 (vitest corre en Europe/Madrid)
    expect(
      tournamentUpdatePayload({ ...form, timezone: "Atlantic/Canary" }, { registrationDeadline: true })
        .registrationDeadline,
    ).toBe("2026-11-20T20:00:00.000Z");
  });

  it("la zona solo si se ha tocado", () => {
    const changed = { ...form, timezone: "Atlantic/Canary" };
    expect(tournamentUpdatePayload(changed, { timezone: true }).timezone).toBe("Atlantic/Canary");
    expect(tournamentUpdatePayload(changed, {}).timezone).toBeUndefined();
  });
});
