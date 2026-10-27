import { describe, it, expect } from "vitest";
import { registrationDeadlineIssue } from "../../../lib/utils/registration-deadline";

describe("registrationDeadlineIssue", () => {
  it("antes del inicio: bien", () => {
    expect(registrationDeadlineIssue("2099-11-15T20:00", "2099-11-20")).toBeNull();
  });

  it("después del inicio: error", () => {
    expect(registrationDeadlineIssue("2099-11-20T20:00", "2099-11-20")).toMatch(/antes del inicio/);
  });

  it("como el back: hasta las 00:00 del día de inicio en la zona del torneo, y ni un minuto más", () => {
    expect(registrationDeadlineIssue("2099-11-20T00:00", "2099-11-20")).toBeNull();
    // Antes se comparaba con la medianoche UTC: en España se colaban las 00:00-02:00
    expect(registrationDeadlineIssue("2099-11-20T00:30", "2099-11-20")).toMatch(/antes del inicio/);
    expect(
      registrationDeadlineIssue("2099-11-20T00:30", "2099-11-20", { timeZone: "Atlantic/Canary" }),
    ).toMatch(/antes del inicio/);
  });

  it("al crear, en el pasado: error; al editar, no se exige futuro", () => {
    expect(registrationDeadlineIssue("2020-01-01T10:00", "2020-02-01", { requireFuture: true })).toMatch(/futura/);
    expect(registrationDeadlineIssue("2020-01-01T10:00", "2020-02-01")).toBeNull();
  });

  it("fecha que no existe (año de 5 cifras, mes 13): error, no se ignora", () => {
    expect(registrationDeadlineIssue("20266-10-31T20:00", "2026-11-20")).toBe("Fecha no válida");
    expect(registrationDeadlineIssue("2026-13-01T20:00", "2026-11-20")).toBe("Fecha no válida");
  });
});
