/**
 * Recuperaciones y bandeja de la escuela: cuándo un aviso gana la recuperación
 * (la misma regla que el back), qué créditos valen para una clase, los ajustes
 * del club y las rutas del servicio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: http }));

import {
  cancelRecoveriesText,
  checkConfigForm,
  creditChoices,
  creditText,
  earnsRecovery,
  marginText,
  requestWho,
} from "@/lib/utils/school-recovery";
import { schoolRecoveryService } from "@/lib/services/school-recovery";
import type { SchoolCredit } from "@/types/school-recovery";

const HOUR = 3_600_000;

const credit = (over: Partial<SchoolCredit> = {}): SchoolCredit => ({
  id: "cr1",
  clubCustomerId: "cc1",
  customerName: "Ana Prueba",
  origin: "ABSENCE",
  status: "available",
  expiresAt: "2027-01-22T22:59:59.999Z",
  sourceSession: { id: "ses0", startsAt: "2026-11-23T17:00:00.000Z", groupName: "Iniciación" },
  usedSession: null,
  usedAt: null,
  voidedAt: null,
  note: null,
  createdAt: "2026-11-20T10:00:00.000Z",
  ...over,
});

describe("earnsRecovery", () => {
  const startsAt = "2026-11-23T17:00:00.000Z";
  const before = (h: number) => new Date(new Date(startsAt).getTime() - h * HOUR);

  it("con la antelación justa gana; con un minuto menos, no", () => {
    expect(earnsRecovery(startsAt, before(24), 24)).toBe(true);
    expect(earnsRecovery(startsAt, new Date(before(24).getTime() + 60_000), 24)).toBe(false);
  });

  it("avisar después de que empiece nunca gana", () => {
    expect(earnsRecovery(startsAt, before(-1), 0)).toBe(false);
  });

  it("usa las horas que fija el club", () => {
    expect(earnsRecovery(startsAt, before(3), 2)).toBe(true);
    expect(earnsRecovery(startsAt, before(3), 4)).toBe(false);
  });
});

describe("marginText", () => {
  it("días y horas, horas y minutos, o minutos", () => {
    expect(marginText(3 * 24 * HOUR + 7 * HOUR)).toBe("3 días y 7 h");
    expect(marginText(24 * HOUR)).toBe("1 día");
    expect(marginText(5 * HOUR + 30 * 60_000)).toBe("5 h 30 min");
    expect(marginText(2 * HOUR)).toBe("2 h");
    expect(marginText(20 * 60_000)).toBe("20 min");
  });

  it("sin margen, que ya empezó", () => {
    expect(marginText(0)).toBe("ya empezada");
    expect(marginText(-5 * 60_000)).toBe("ya empezada");
  });
});

describe("creditChoices", () => {
  const startsAt = "2026-12-01T17:00:00.000Z";

  it("solo disponibles que no caducan antes de la clase y de quien no está ya en su lista, los que antes caducan primero", () => {
    const list = [
      credit({ id: "late", expiresAt: "2027-01-22T22:59:59.999Z" }),
      credit({ id: "soon", clubCustomerId: "cc2", expiresAt: "2026-12-05T22:59:59.999Z" }),
      credit({ id: "expired-before", clubCustomerId: "cc3", expiresAt: "2026-11-30T22:59:59.999Z" }),
      credit({ id: "used", clubCustomerId: "cc4", status: "used" }),
      credit({ id: "in-class", clubCustomerId: "cc5" }),
    ];
    expect(creditChoices(list, startsAt, new Set(["cc5"])).map((c) => c.id)).toEqual(["soon", "late"]);
  });
});

describe("textos", () => {
  it("creditText: de dónde viene y hasta cuándo vale, en la zona del club", () => {
    expect(creditText(credit(), "Europe/Madrid")).toBe(
      "Faltó y avisó con tiempo · clase de Iniciación, lun, 23 nov · caduca el 22 ene 2027",
    );
    expect(creditText(credit({ origin: "MANUAL", sourceSession: null }), "Europe/Madrid")).toBe(
      "Concedida a mano por el club · caduca el 22 ene 2027",
    );
    expect(creditText(credit({ status: "expired" }), "Europe/Madrid")).toContain("caducó el 22 ene 2027");
    expect(creditText(credit({ status: "used" }), "Europe/Madrid")).not.toContain("22 ene");
  });

  it("requestWho: el cliente del club o el nombre que se apuntó", () => {
    expect(requestWho({ customerName: "Ana Prueba", contactName: "otra" })).toBe("Ana Prueba");
    expect(requestWho({ customerName: null, contactName: "Laura Prueba" })).toBe("Laura Prueba");
    expect(requestWho({ customerName: null, contactName: null })).toBe("Sin nombre");
  });

  it("cancelRecoveriesText: lo dado y lo devuelto, y nada si no pasó nada", () => {
    expect(cancelRecoveriesText({ granted: 0, returned: 0 })).toBe("");
    expect(cancelRecoveriesText({ granted: 1, returned: 0 })).toBe("1 alumno gana una recuperación");
    expect(cancelRecoveriesText({ granted: 6, returned: 2 })).toBe(
      "6 alumnos ganan una recuperación · 2 recuperaciones devueltas a quien se había apuntado",
    );
  });
});

describe("checkConfigForm", () => {
  it("valores buenos, listos para mandar", () => {
    expect(checkConfigForm({ recoveryNoticeHours: "48", recoveryValidDays: "90" })).toEqual({
      ok: true,
      value: { recoveryNoticeHours: 48, recoveryValidDays: 90 },
    });
    expect(checkConfigForm({ recoveryNoticeHours: "0", recoveryValidDays: "1" }).ok).toBe(true);
  });

  it("las mismas reglas que el back: horas de 0 a 720 y días de 1 a 730, enteros", () => {
    for (const form of [
      { recoveryNoticeHours: "", recoveryValidDays: "60" },
      { recoveryNoticeHours: "-1", recoveryValidDays: "60" },
      { recoveryNoticeHours: "721", recoveryValidDays: "60" },
      { recoveryNoticeHours: "2.5", recoveryValidDays: "60" },
      { recoveryNoticeHours: "24", recoveryValidDays: "0" },
      { recoveryNoticeHours: "24", recoveryValidDays: "731" },
      { recoveryNoticeHours: "24", recoveryValidDays: "" },
    ]) {
      expect(checkConfigForm(form).ok).toBe(false);
    }
  });
});

describe("schoolRecoveryService", () => {
  beforeEach(() => {
    Object.values(http).forEach((m) => m.mockReset());
    for (const m of Object.values(http)) m.mockResolvedValue({ data: {} });
  });

  it("las rutas son las de /admin/clubs/:clubId/school", async () => {
    await schoolRecoveryService.absences.register("c1", "s1", { clubCustomerId: "cc1", noticedAt: "2026-11-20T10:00:00.000Z" });
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/absences", {
      clubCustomerId: "cc1",
      noticedAt: "2026-11-20T10:00:00.000Z",
    });
    await schoolRecoveryService.absences.undo("c1", "s1", "cc1");
    expect(http.delete).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/absences/cc1");

    await schoolRecoveryService.recoveries.use("c1", "s1", "cr1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/recoveries", { creditId: "cr1" });
    await schoolRecoveryService.recoveries.giveBack("c1", "s1", "cr1");
    expect(http.delete).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/recoveries/cr1");

    await schoolRecoveryService.credits.list("c1", { status: "available", clubCustomerId: "cc1" });
    expect(http.get).toHaveBeenLastCalledWith("/admin/clubs/c1/school/credits", {
      params: { status: "available", clubCustomerId: "cc1" },
    });
    await schoolRecoveryService.credits.grant("c1", "cc1", "Lesión");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/credits", { clubCustomerId: "cc1", note: "Lesión" });
    await schoolRecoveryService.credits.void("c1", "cr1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/credits/cr1/void");

    await schoolRecoveryService.config.get("c1");
    expect(http.get).toHaveBeenLastCalledWith("/admin/clubs/c1/school/config");
    await schoolRecoveryService.config.update("c1", { recoveryNoticeHours: 12 });
    expect(http.put).toHaveBeenLastCalledWith("/admin/clubs/c1/school/config", { recoveryNoticeHours: 12 });

    await schoolRecoveryService.requests.list("c1", "PENDING");
    expect(http.get).toHaveBeenLastCalledWith("/admin/clubs/c1/school/requests", { params: { status: "PENDING" } });
    await schoolRecoveryService.requests.create("c1", { kind: "OTHER", message: "Hola" });
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/requests", { kind: "OTHER", message: "Hola" });
    await schoolRecoveryService.requests.accept("c1", "r1", { clubCustomerId: "cc1" });
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/requests/r1/accept", { clubCustomerId: "cc1" });
    await schoolRecoveryService.requests.accept("c1", "r1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/requests/r1/accept", {});
    await schoolRecoveryService.requests.reject("c1", "r1", "Sin plazas");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/requests/r1/reject", { note: "Sin plazas" });
  });
});
