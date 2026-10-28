/**
 * Vista «Día» del calendario de reservas: el horario del día como el back
 * (excepción > horario semanal) y la rejilla franjas × pistas en la hora del
 * club, no en la del navegador.
 */
import { describe, it, expect } from "vitest";
import {
  bookingsByCourtAndDay,
  buildDayGrid,
  dayRangeIso,
  isoDayOfWeek,
  resolveDayWindow,
  weekDayKeys,
  type DayGridCell,
} from "@/lib/utils/booking-day-grid";
import type { Court } from "@/types";
import type { Booking, ClubOperatingHours, ClubScheduleException } from "@/types/bookings";

const MADRID = "Europe/Madrid";
const DAY = "2026-10-28"; // miércoles, horario de invierno (UTC+1)

const hours = (dayOfWeek: number, openTime: string, closeTime: string, active = true): ClubOperatingHours =>
  ({ id: `h${dayOfWeek}`, clubId: "c1", dayOfWeek, openTime, closeTime, active });

const exception = (p: Partial<ClubScheduleException>): ClubScheduleException => ({
  id: "e1", clubId: "c1", date: "2026-10-28T00:00:00.000Z", isClosed: false,
  customOpen: null, customClose: null, reason: null, ...p,
});

const court = (id: string, extra: Partial<Court> = {}): Court =>
  ({ id, clubId: "c1", name: `Pista ${id}`, isIndoor: false, isCentral: false, order: 0, active: true, ...extra });

const booking = (p: Partial<Booking>): Booking =>
  ({
    id: "b1", shortCode: "AMT-1", clubId: "c1", courtId: "p1", creatorUserId: "u1",
    matchMode: "PRIVATE_AMT", status: "CONFIRMED", durationMinutes: 90,
    startsAt: "2026-10-28T17:00:00.000Z", endsAt: "2026-10-28T18:30:00.000Z",
    participants: [],
    ...p,
  }) as Booking;

const kinds = (cells: DayGridCell[]) => cells.map((c) => c.kind);

describe("isoDayOfWeek", () => {
  it("lunes 1 … domingo 7, sin depender de la zona", () => {
    expect(isoDayOfWeek("2026-10-26")).toBe(1);
    expect(isoDayOfWeek(DAY)).toBe(3);
    expect(isoDayOfWeek("2026-11-01")).toBe(7);
  });
});

describe("dayRangeIso", () => {
  it("un día cualquiera: de las 00:00 al último milisegundo en Madrid", () => {
    expect(dayRangeIso("2026-10-28", "2026-10-28", MADRID)).toEqual({
      fromDate: "2026-10-27T23:00:00.000Z",
      toDate: "2026-10-28T22:59:59.999Z",
    });
  });

  it("el día del cambio de hora (25/10/2026) dura 25 horas", () => {
    expect(dayRangeIso("2026-10-25", "2026-10-25", MADRID)).toEqual({
      fromDate: "2026-10-24T22:00:00.000Z",
      toDate: "2026-10-25T22:59:59.999Z",
    });
  });

  it("en otra zona, otro rango (no depende de la del navegador)", () => {
    expect(dayRangeIso("2026-10-25", "2026-10-25", "Atlantic/Canary")).toEqual({
      fromDate: "2026-10-24T23:00:00.000Z",
      toDate: "2026-10-25T23:59:59.999Z",
    });
  });

  it("una semana: del lunes a las 00:00 al final del domingo", () => {
    expect(dayRangeIso("2026-10-19", "2026-10-25", MADRID)).toEqual({
      fromDate: "2026-10-18T22:00:00.000Z",
      toDate: "2026-10-25T22:59:59.999Z",
    });
  });
});

describe("weekDayKeys", () => {
  const WEEK = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];

  it("de lunes a domingo, sea cual sea el día de partida", () => {
    expect(weekDayKeys("2026-10-25")).toEqual(WEEK);
    expect(weekDayKeys("2026-10-19")).toEqual(WEEK);
    expect(weekDayKeys("2026-10-22")).toEqual(WEEK);
  });

  it("semanas antes y después, cruzando de mes", () => {
    expect(weekDayKeys("2026-10-25", 1)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
    expect(weekDayKeys("2026-10-25", -1)[0]).toBe("2026-10-12");
  });
});

describe("bookingsByCourtAndDay", () => {
  it("una reserva del domingo a las 23:30 de Madrid (22:30Z) cae en el domingo de esa semana", () => {
    const late = booking({ id: "tarde", startsAt: "2026-10-25T22:30:00.000Z", endsAt: "2026-10-25T23:30:00.000Z" });
    const range = dayRangeIso("2026-10-19", "2026-10-25", MADRID);
    expect(late.startsAt >= range.fromDate && late.startsAt <= range.toDate).toBe(true);
    expect(bookingsByCourtAndDay([late], MADRID).p1["2026-10-25"]).toEqual([late]);
  });

  it("el día es el del club: lo que en Canarias es domingo, en Madrid ya es lunes", () => {
    const b = booking({ id: "noche", startsAt: "2026-10-25T23:30:00.000Z" });
    expect(Object.keys(bookingsByCourtAndDay([b], MADRID).p1)).toEqual(["2026-10-26"]);
    expect(Object.keys(bookingsByCourtAndDay([b], "Atlantic/Canary").p1)).toEqual(["2026-10-25"]);
  });

  it("por pista y, cada día, por hora de inicio", () => {
    const b2 = booking({ id: "b2", startsAt: "2026-10-28T19:00:00.000Z" });
    const b1 = booking({ id: "b1", startsAt: "2026-10-28T09:00:00.000Z" });
    const other = booking({ id: "b3", courtId: "p2", startsAt: "2026-10-28T10:00:00.000Z" });
    const grid = bookingsByCourtAndDay([b2, other, b1], MADRID);
    expect(grid.p1["2026-10-28"].map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(grid.p2["2026-10-28"].map((b) => b.id)).toEqual(["b3"]);
  });
});

describe("resolveDayWindow", () => {
  const weekly = [hours(3, "09:00", "23:00"), hours(4, "10:00", "22:00")];

  it("sin excepción: el horario semanal de ese día", () => {
    expect(resolveDayWindow(DAY, weekly, [])).toEqual({ openTime: "09:00", closeTime: "23:00" });
  });

  it("la excepción llega como la medianoche UTC del día y cuenta (antes no casaba con «YYYY-MM-DD»)", () => {
    const closed = exception({ isClosed: true });
    expect(resolveDayWindow(DAY, weekly, [closed])).toBeNull();
    const custom = exception({ customOpen: "16:00", customClose: "20:00" });
    expect(resolveDayWindow(DAY, weekly, [custom])).toEqual({ openTime: "16:00", closeTime: "20:00" });
  });

  it("una excepción sin horario propio deja el semanal; la de otro día no cuenta", () => {
    expect(resolveDayWindow(DAY, weekly, [exception({ reason: "Aviso" })]))
      .toEqual({ openTime: "09:00", closeTime: "23:00" });
    expect(resolveDayWindow(DAY, weekly, [exception({ date: "2026-10-29T00:00:00.000Z", isClosed: true })]))
      .toEqual({ openTime: "09:00", closeTime: "23:00" });
  });

  it("sin horario activo ese día: cerrado", () => {
    expect(resolveDayWindow(DAY, [hours(3, "09:00", "23:00", false)], [])).toBeNull();
  });
});

describe("buildDayGrid", () => {
  const window = { openTime: "09:00", closeTime: "23:00" };

  it("franjas de 30 min de la apertura al cierre, libres y pulsables", () => {
    const grid = buildDayGrid({ dayKey: DAY, courts: [court("p1")], bookings: [], window, timeZone: MADRID })!;
    expect(grid.rows[0]).toBe(9 * 60);
    expect(grid.rows.at(-1)).toBe(22 * 60 + 30);
    expect(grid.rows).toHaveLength(28);
    expect(grid.cells.p1.every((c) => c.kind === "free" && c.bookable)).toBe(true);
  });

  it("coloca la reserva en la hora del club: 17:00 UTC son las 18:00 en Madrid, 90 min = 3 franjas", () => {
    const grid = buildDayGrid({ dayKey: DAY, courts: [court("p1")], bookings: [booking({})], window, timeZone: MADRID })!;
    const row = grid.rows.indexOf(18 * 60);
    expect(grid.cells.p1[row]).toMatchObject({ kind: "booking", span: 3 });
    expect(kinds(grid.cells.p1.slice(row + 1, row + 3))).toEqual(["covered", "covered"]);
    expect(grid.cells.p1[row + 3]).toEqual({ kind: "free", bookable: true });
  });

  it("con otra zona, la misma reserva cae en otra fila (no usa la del navegador)", () => {
    const grid = buildDayGrid({
      dayKey: DAY, courts: [court("p1")], bookings: [booking({})], window, timeZone: "Atlantic/Canary",
    })!;
    expect(grid.cells.p1[grid.rows.indexOf(17 * 60)]).toMatchObject({ kind: "booking" });
  });

  it("las canceladas no ocupan el hueco", () => {
    const grid = buildDayGrid({
      dayKey: DAY, courts: [court("p1")], bookings: [booking({ status: "CANCELLED" })], window, timeZone: MADRID,
    })!;
    expect(grid.cells.p1.every((c) => c.kind === "free")).toBe(true);
  });

  it("una reserva fuera del horario se ve: la rejilla se alarga, pero esas franjas no se ofrecen", () => {
    const early = booking({ startsAt: "2026-10-28T07:00:00.000Z", endsAt: "2026-10-28T08:00:00.000Z", durationMinutes: 60 });
    const grid = buildDayGrid({ dayKey: DAY, courts: [court("p1"), court("p2")], bookings: [early], window, timeZone: MADRID })!;
    expect(grid.rows[0]).toBe(8 * 60);
    expect(grid.cells.p1[0]).toMatchObject({ kind: "booking", span: 2 });
    expect(grid.cells.p2[0]).toEqual({ kind: "free", bookable: false });
    expect(grid.cells.p2[2]).toEqual({ kind: "free", bookable: true });
  });

  it("cerrado: sin reservas no hay rejilla; con reservas, solo ellas y nada pulsable", () => {
    expect(buildDayGrid({ dayKey: DAY, courts: [court("p1")], bookings: [], window: null, timeZone: MADRID })).toBeNull();
    const grid = buildDayGrid({ dayKey: DAY, courts: [court("p1")], bookings: [booking({})], window: null, timeZone: MADRID })!;
    expect(grid.rows).toEqual([18 * 60, 18 * 60 + 30, 19 * 60]);
    expect(grid.cells.p1[0]).toMatchObject({ kind: "booking", span: 3 });
  });

  it("los bloqueos de la pista ese día salen como «Bloqueada», no como huecos libres", () => {
    const blocked = court("p1", {
      blocks: [
        { id: "k1", courtId: "p1", startDate: DAY, endDate: DAY, startTime: "10:00", endTime: "11:00", reason: "Torneo", createdAt: "" },
        { id: "k2", courtId: "p1", startDate: "2026-10-29", endDate: "2026-10-30", startTime: null, endTime: null, reason: null, createdAt: "" },
      ],
    });
    const grid = buildDayGrid({ dayKey: DAY, courts: [blocked], bookings: [], window, timeZone: MADRID })!;
    expect(kinds(grid.cells.p1.slice(1, 5))).toEqual(["free", "blocked", "blocked", "free"]);
    expect(grid.cells.p1[2]).toEqual({ kind: "blocked", reason: "Torneo" });

    const allDay = court("p2", { blocks: [{ id: "k3", courtId: "p2", startDate: DAY, endDate: DAY, startTime: null, endTime: null, reason: null, createdAt: "" }] });
    const grid2 = buildDayGrid({ dayKey: DAY, courts: [allDay], bookings: [], window, timeZone: MADRID })!;
    expect(grid2.cells.p2.every((c) => c.kind === "blocked")).toBe(true);
  });

  it("las reservas de pistas que no salen (inactivas) no rompen la rejilla", () => {
    const grid = buildDayGrid({
      dayKey: DAY, courts: [court("p1")], bookings: [booking({ courtId: "otra" })], window, timeZone: MADRID,
    })!;
    expect(grid.cells.p1.every((c) => c.kind === "free")).toBe(true);
  });
});
