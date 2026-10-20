import { describe, it, expect } from "vitest";
import { isValidDateTime, registrationDeadlineIssue } from "../../../lib/utils/registration-deadline";
import { toLocalDateTimeInput } from "../../../lib/utils/date-keys";

describe("registrationDeadlineIssue", () => {
  it("antes del inicio: bien", () => {
    expect(registrationDeadlineIssue("2099-11-15T20:00", "2099-11-20")).toBeNull();
  });

  it("después del inicio: error", () => {
    expect(registrationDeadlineIssue("2099-11-20T20:00", "2099-11-20")).toMatch(/antes del inicio/);
  });

  it("como el back: el cierre igual al inicio (medianoche UTC del día) vale", () => {
    // Torneos antiguos guardaban así el cierre; no tienen que dejar de poder guardarse
    const legacy = toLocalDateTimeInput(new Date("2099-11-20T00:00:00Z"));
    expect(registrationDeadlineIssue(legacy, "2099-11-20")).toBeNull();
  });

  it("al crear, en el pasado: error; al editar, no se exige futuro", () => {
    expect(registrationDeadlineIssue("2020-01-01T10:00", "2020-02-01", { requireFuture: true })).toMatch(/futura/);
    expect(registrationDeadlineIssue("2020-01-01T10:00", "2020-02-01")).toBeNull();
  });

  it("fecha que no existe (año de 5 cifras): error, no se ignora", () => {
    expect(isValidDateTime("20266-10-31T20:00")).toBe(false);
    expect(registrationDeadlineIssue("20266-10-31T20:00", "2026-11-20")).toBe("Fecha no válida");
  });
});
