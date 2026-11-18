/**
 * Escuela del club: franjas, formulario del grupo (las mismas reglas que el
 * back), cuándo se pasa lista y las rutas del servicio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: http }));

import {
  attendanceTotals,
  canTakeAttendance,
  checkGroupForm,
  emptyGroupForm,
  endTimeOf,
  generateSummaryText,
  groupFormOf,
  isRealDay,
  scheduleChanged,
  sessionDuration,
  sessionLabel,
  slotText,
  slotsSummary,
  type GroupFormValues,
} from "@/lib/utils/school";
import { schoolService } from "@/lib/services/school";
import type { SchoolGroup, SchoolSlot } from "@/types/school";

const slot = (over: Partial<SchoolSlot> = {}): SchoolSlot => ({
  id: "s1", weekday: 1, startTime: "18:00", durationMinutes: 60, preferredCourtId: null, ...over,
});

function validForm(over: Partial<GroupFormValues> = {}): GroupFormValues {
  return {
    ...emptyGroupForm(),
    name: "  Iniciación  ",
    maxStudents: "6",
    startDate: "2026-09-14",
    endDate: "2027-06-18",
    ...over,
  };
}

describe("franjas", () => {
  it("endTimeOf: fin de la franja, 24:00 al límite y null si pasa del día", () => {
    expect(endTimeOf("18:00", 90)).toBe("19:30");
    expect(endTimeOf("23:00", 60)).toBe("24:00");
    expect(endTimeOf("23:30", 60)).toBeNull();
  });

  it("slotText y slotsSummary: el horario semanal en orden", () => {
    expect(slotText(slot({ weekday: 3, startTime: "19:30", durationMinutes: 90 }))).toBe("Miércoles 19:30–21:00");
    expect(
      slotsSummary([slot({ id: "b", weekday: 3 }), slot({ id: "a", weekday: 1, startTime: "10:00" })]),
    ).toBe("Lunes 10:00–11:00 · Miércoles 18:00–19:00");
    expect(slotsSummary([])).toBe("Sin horario");
  });
});

describe("checkGroupForm", () => {
  it("un formulario correcto sale listo para mandar, recortado y con null donde va vacío", () => {
    const r = checkGroupForm(validForm({ level: " ", notes: "", coachStaffId: "" }));
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Iniciación",
        level: null,
        coachStaffId: null,
        maxStudents: 6,
        monthlyFeeCents: null,
        startDate: "2026-09-14",
        endDate: "2027-06-18",
        notes: null,
        slots: [{ weekday: 1, startTime: "18:00", durationMinutes: 60, preferredCourtId: null }],
      },
    });
  });

  it("la cuota mensual se escribe en euros y sale en céntimos; vacía, el grupo no cobra cuota", () => {
    expect(checkGroupForm(validForm({ monthlyFee: "45" }))).toMatchObject({ ok: true, value: { monthlyFeeCents: 4500 } });
    expect(checkGroupForm(validForm({ monthlyFee: " 45,50 " }))).toMatchObject({ ok: true, value: { monthlyFeeCents: 4550 } });
    expect(checkGroupForm(validForm({ monthlyFee: "" }))).toMatchObject({ ok: true, value: { monthlyFeeCents: null } });
  });

  it.each([["abc"], ["-5"], ["0"], ["12,345"], ["100001"]])("una cuota mensual de «%s» no se manda", (monthlyFee) => {
    const r = checkGroupForm(validForm({ monthlyFee }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/cuota/i);
  });

  it("el formulario de un grupo con cuota la vuelve a escribir en euros; sin cuota, vacía", () => {
    const group = {
      id: "g", clubId: "c", name: "Iniciación", level: null, maxStudents: 6, monthlyFeeCents: 4550,
      startDate: "2026-09-14", endDate: "2027-06-18", notes: null, archivedAt: null, createdAt: "", coach: null, slots: [],
    };
    expect(groupFormOf(group).monthlyFee).toBe("45,50");
    expect(groupFormOf({ ...group, monthlyFeeCents: null }).monthlyFee).toBe("");
  });

  it("las franjas que ya existen llevan su id y la pista preferida", () => {
    const form = validForm({
      slots: [{ key: "s1", id: "s1", weekday: "2", startTime: "19:00", durationMinutes: "90", preferredCourtId: "c3" }],
    });
    const r = checkGroupForm(form);
    expect(r.ok && r.value.slots).toEqual([
      { id: "s1", weekday: 2, startTime: "19:00", durationMinutes: 90, preferredCourtId: "c3" },
    ]);
  });

  it.each([
    ["sin nombre", { name: "   " }, "nombre del grupo"],
    ["plazas a cero", { maxStudents: "0" }, "plazas"],
    ["plazas con decimales", { maxStudents: "4.5" }, "plazas"],
    ["más plazas del tope", { maxStudents: "41" }, "plazas"],
    ["sin fechas", { startDate: "", endDate: "" }, "temporada"],
    ["un día que no existe", { startDate: "2026-02-30" }, "temporada"],
    ["fin antes del inicio", { endDate: "2026-09-01" }, "antes de empezar"],
    ["más de 13 meses", { endDate: "2028-01-01" }, "13 meses"],
    ["sin franjas", { slots: [] }, "al menos una franja"],
  ])("no vale: %s", (_name, over, message) => {
    const r = checkGroupForm(validForm(over as Partial<GroupFormValues>));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain(message);
  });

  it("una franja con hora mal escrita, duración fuera de rango o que no cabe en el día", () => {
    const withSlot = (over: Partial<GroupFormValues["slots"][number]>) =>
      validForm({ slots: [{ ...emptyGroupForm().slots[0], ...over }] });
    expect(checkGroupForm(withSlot({ startTime: "25:00" }))).toMatchObject({ ok: false });
    expect(checkGroupForm(withSlot({ durationMinutes: "10" }))).toMatchObject({ ok: false });
    expect(checkGroupForm(withSlot({ durationMinutes: "300" }))).toMatchObject({ ok: false });
    const r = checkGroupForm(withSlot({ startTime: "23:30", durationMinutes: "60" }));
    expect(!r.ok && r.message).toContain("no cabe en el día");
  });

  it("dos franjas del mismo día que se solapan no valen; pegadas sí", () => {
    const two = (secondStart: string) =>
      validForm({
        slots: [
          { key: "a", weekday: "4", startTime: "18:00", durationMinutes: "90", preferredCourtId: "" },
          { key: "b", weekday: "4", startTime: secondStart, durationMinutes: "60", preferredCourtId: "" },
        ],
      });
    const overlap = checkGroupForm(two("19:00"));
    expect(!overlap.ok && overlap.message).toContain("jueves se solapan");
    expect(checkGroupForm(two("19:30")).ok).toBe(true);
  });

  it("groupFormOf devuelve el formulario de un grupo con sus franjas", () => {
    const group = {
      id: "g1", clubId: "c1", name: "Avanzado", level: null, maxStudents: 4, startDate: "2026-09-14",
      endDate: "2027-06-18", notes: "Traer palas", archivedAt: null, createdAt: "2026-09-01T00:00:00Z",
      coach: { staffId: "st1", userId: "u1", name: "Marta" },
      slots: [slot({ id: "s9", preferredCourtId: "c2" })],
    } as SchoolGroup;
    const form = groupFormOf(group);
    expect(form).toMatchObject({ name: "Avanzado", level: "", coachStaffId: "st1", maxStudents: "4", notes: "Traer palas" });
    expect(form.slots).toEqual([
      { key: "s9", id: "s9", weekday: "1", startTime: "18:00", durationMinutes: "60", preferredCourtId: "c2" },
    ]);
  });

  it("isRealDay descarta los días que no existen", () => {
    expect(isRealDay("2028-02-29")).toBe(true);
    expect(isRealDay("2027-02-29")).toBe(false);
    expect(isRealDay("2026-13-01")).toBe(false);
    expect(isRealDay("")).toBe(false);
  });
});

describe("clases y asistencia", () => {
  const MADRID = "Europe/Madrid";
  const session = { status: "SCHEDULED" as const, startsAt: "2026-11-25T17:00:00.000Z", endsAt: "2026-11-25T18:00:00.000Z" };

  it("sessionLabel enseña día y hora de pared del club", () => {
    expect(sessionLabel(session, MADRID)).toMatch(/18:00–19:00$/);
    // 23:30 en Madrid es 22:30Z: el día es el de Madrid, no el UTC
    expect(sessionLabel({ startsAt: "2026-11-25T22:30:00.000Z", endsAt: "2026-11-25T23:30:00.000Z" }, MADRID)).toMatch(
      /^mié,? 25 nov · 23:30–00:30$/,
    );
  });

  it("se pasa lista de hoy y de días pasados, no de mañana ni de una cancelada", () => {
    const now = new Date("2026-11-25T08:00:00.000Z");
    expect(canTakeAttendance(session, now, MADRID)).toBe(true);
    expect(canTakeAttendance(session, new Date("2026-11-30T08:00:00.000Z"), MADRID)).toBe(true);
    expect(canTakeAttendance(session, new Date("2026-11-24T08:00:00.000Z"), MADRID)).toBe(false);
    expect(canTakeAttendance({ ...session, status: "CANCELLED" }, now, MADRID)).toBe(false);
  });

  it("el día de hoy se mide en la zona del club (00:30 del 26 en Madrid es aún 25 en UTC)", () => {
    const lateNight = { status: "SCHEDULED" as const, startsAt: "2026-11-26T17:00:00.000Z" };
    expect(canTakeAttendance(lateNight, new Date("2026-11-25T23:30:00.000Z"), MADRID)).toBe(true);
    expect(canTakeAttendance(lateNight, new Date("2026-11-25T22:30:00.000Z"), MADRID)).toBe(false);
  });

  it("sessionDuration: lo que dura en reloj de pared del club, también si acaba a medianoche", () => {
    expect(
      sessionDuration({ startsAt: "2026-11-25T17:00:00.000Z", endsAt: "2026-11-25T18:30:00.000Z" }, MADRID),
    ).toBe(90);
    // 23:00-24:00 en Madrid
    expect(
      sessionDuration({ startsAt: "2026-11-25T22:00:00.000Z", endsAt: "2026-11-25T23:00:00.000Z" }, MADRID),
    ).toBe(60);
  });

  it("generateSummaryText cuenta lo creado y avisa de lo que se quedó sin pista o se saltó", () => {
    const base = { created: 0, withoutCourt: 0, skippedClosedDays: 0, skippedOutsideHours: 0, removed: 0 };
    expect(generateSummaryText({ ...base, created: 38 })).toBe("Se han creado 38 clases");
    expect(
      generateSummaryText({ ...base, created: 1, withoutCourt: 1, skippedClosedDays: 2, removed: 30 }),
    ).toBe(
      "Se ha creado 1 clase · 30 futuras sustituidas · 1 sin pista libre: asígnala a mano · 2 saltadas porque el club cierra",
    );
    expect(generateSummaryText(base)).toBe("No había clases nuevas que crear");
    // Las que caen fuera del horario del día se avisan aparte de las de días cerrados
    expect(generateSummaryText({ ...base, created: 3, skippedOutsideHours: 2 })).toBe(
      "Se han creado 3 clases · 2 saltadas por caer fuera del horario del club",
    );
    expect(generateSummaryText({ ...base, created: 3, skippedOutsideHours: 1 })).toBe(
      "Se han creado 3 clases · 1 saltada por caer fuera del horario del club",
    );
  });

  it("scheduleChanged: solo si cambian las fechas o las franjas (no el nombre, no el orden)", () => {
    const group = {
      startDate: "2026-09-14",
      endDate: "2027-06-18",
      slots: [slot({ id: "a" }), slot({ id: "b", weekday: 3 })],
    };
    const same = {
      startDate: "2026-09-14",
      endDate: "2027-06-18",
      slots: [
        { weekday: 3, startTime: "18:00", durationMinutes: 60, preferredCourtId: null },
        { id: "a", weekday: 1, startTime: "18:00", durationMinutes: 60 },
      ],
    };
    expect(scheduleChanged(group, same)).toBe(false);
    expect(scheduleChanged(group, { ...same, endDate: "2027-06-25" })).toBe(true);
    expect(scheduleChanged(group, { ...same, slots: [same.slots[0]] })).toBe(true);
    expect(
      scheduleChanged(group, { ...same, slots: [same.slots[0], { ...same.slots[1], durationMinutes: 90 }] }),
    ).toBe(true);
    expect(
      scheduleChanged(group, { ...same, slots: [same.slots[0], { ...same.slots[1], preferredCourtId: "c2" }] }),
    ).toBe(true);
  });

  it("attendanceTotals cuenta presentes, ausentes, justificadas y pendientes", () => {
    expect(
      attendanceTotals([{ status: "PRESENT" }, { status: "PRESENT" }, { status: "ABSENT" }, { status: "EXCUSED" }, { status: null }]),
    ).toEqual({ present: 2, absent: 1, excused: 1, pending: 1 });
  });
});

describe("schoolService", () => {
  beforeEach(() => {
    Object.values(http).forEach((m) => m.mockReset());
    for (const m of Object.values(http)) m.mockResolvedValue({ data: {} });
  });

  it("las rutas son las de /admin/clubs/:clubId/school", async () => {
    await schoolService.groups.list("c1");
    expect(http.get).toHaveBeenLastCalledWith("/admin/clubs/c1/school/groups", { params: undefined });
    await schoolService.groups.list("c1", true);
    expect(http.get).toHaveBeenLastCalledWith("/admin/clubs/c1/school/groups", { params: { archived: "true" } });

    await schoolService.groups.archive("c1", "g1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/groups/g1/archive");
    await schoolService.members.add("c1", "g1", "cc1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/groups/g1/members", { clubCustomerId: "cc1" });
    await schoolService.members.leave("c1", "g1", "m1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/groups/g1/members/m1/leave");
    await schoolService.sessions.generate("c1", "g1");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/groups/g1/sessions/generate");
    await schoolService.sessions.update("c1", "s1", { courtId: null });
    expect(http.patch).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1", { courtId: null });
    await schoolService.sessions.cancel("c1", "s1", "Lluvia");
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/cancel", { reason: "Lluvia", grantRecovery: true });
    await schoolService.sessions.cancel("c1", "s1", undefined, false);
    expect(http.post).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/cancel", { reason: undefined, grantRecovery: false });
    await schoolService.sessions.setAttendance("c1", "s1", [{ clubCustomerId: "cc1", status: "PRESENT" }]);
    expect(http.put).toHaveBeenLastCalledWith("/admin/clubs/c1/school/sessions/s1/attendance", {
      entries: [{ clubCustomerId: "cc1", status: "PRESENT" }],
    });
    await schoolService.coaches.update("c1", "st1", null);
    expect(http.patch).toHaveBeenLastCalledWith("/admin/clubs/c1/school/coaches/st1", { coachBio: null });
  });
});
