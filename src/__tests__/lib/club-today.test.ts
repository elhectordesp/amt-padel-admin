import { describe, it, expect } from "vitest";
import { launchPending, launchSteps, plainActivity, todayOccupancy, upcomingBookings } from "@/lib/utils/club-today";
import type { ActivationState, Booking } from "@/types/bookings";
import type { CourtOccupation } from "@/types";

const TZ = "Europe/Madrid";
// 2026-11-10 es invierno en Madrid (UTC+1)
const iso = (hhmm: string) => `2026-11-10T${hhmm}:00+01:00`;
const booking = (id: string, courtId: string, from: string, to: string, status = "CONFIRMED") =>
  ({ id, courtId, startsAt: iso(from), endsAt: iso(to), status }) as unknown as Booking;
const block = (courtId: string, from: string, to: string) =>
  ({ courtId, startsAt: iso(from), endsAt: iso(to), kind: "MAINTENANCE", source: "BLOCK" }) as unknown as CourtOccupation;

const base = { dayKey: "2026-11-10", timeZone: TZ, window: { openTime: "09:00", closeTime: "13:00" } };

describe("todayOccupancy", () => {
  it("reservas y bloqueos frente a las horas abiertas de las pistas activas", () => {
    const r = todayOccupancy({
      ...base,
      courtIds: ["a", "b"],
      bookings: [booking("1", "a", "09:00", "10:30"), booking("2", "b", "12:00", "13:00")],
      occupations: [block("b", "09:00", "10:00")],
    });
    expect(r.openMinutes).toBe(480);
    expect(r.occupiedMinutes).toBe(90 + 60 + 60);
    expect(r.percent).toBe(44);
  });

  it("lo que se pisa en la misma pista no cuenta doble, y las canceladas no ocupan", () => {
    const r = todayOccupancy({
      ...base,
      courtIds: ["a"],
      bookings: [booking("1", "a", "09:00", "10:00"), booking("2", "a", "11:00", "12:00", "CANCELLED")],
      occupations: [block("a", "09:30", "10:30")],
    });
    expect(r.occupiedMinutes).toBe(90);
  });

  it("recorta al horario y se salta pistas que no son activas", () => {
    const r = todayOccupancy({
      ...base,
      courtIds: ["a"],
      bookings: [booking("1", "a", "12:30", "14:00"), booking("2", "inactiva", "09:00", "10:00")],
      occupations: [],
    });
    expect(r.occupiedMinutes).toBe(30);
  });

  it("cerrado hoy o sin pistas: sin porcentaje", () => {
    expect(todayOccupancy({ ...base, window: null, courtIds: ["a"], bookings: [], occupations: [] }).percent).toBeNull();
    expect(todayOccupancy({ ...base, courtIds: [], bookings: [], occupations: [] }).percent).toBeNull();
  });
});

describe("upcomingBookings", () => {
  it("las 5 siguientes sin acabar ni canceladas, por hora", () => {
    const list = [
      booking("pasada", "a", "08:00", "09:00"),
      booking("c", "a", "12:00", "13:00"),
      booking("b", "a", "10:00", "11:00"),
      booking("x", "a", "10:30", "11:30", "CANCELLED"),
      booking("d", "a", "13:00", "14:00"),
      booking("e", "a", "14:00", "15:00"),
      booking("f", "a", "15:00", "16:00"),
      booking("g", "a", "16:00", "17:00"),
    ];
    const now = Date.parse(iso("09:30"));
    expect(upcomingBookings(list, now).map((b) => b.id)).toEqual(["b", "c", "d", "e", "f"]);
  });
});

describe("launchSteps", () => {
  const act = (over: Partial<ActivationState> = {}, failing: string[] = []): ActivationState => ({
    bookingEnabled: false, bookingPublicAt: null, bookingActivationRequestedAt: null, status: "INACTIVE",
    activeTesterCount: 0,
    readiness: {
      ready: failing.length === 0,
      checks: (["COURTS", "OPERATING_HOURS", "COURT_DURATIONS", "COURT_PRICES"] as const).map((code) => ({
        code, ok: !failing.includes(code), missing: [],
      })),
    },
    ...over,
  });

  it("sin datos del back, no hay lista", () => {
    expect(launchSteps({ activation: undefined, rulesMarkdown: "x", clubPendingSetup: false })).toBeNull();
  });

  it("club recién creado: todo pendiente salvo lo que ya tiene", () => {
    const steps = launchSteps({
      activation: act({}, ["COURTS", "OPERATING_HOURS", "COURT_PRICES"]),
      rulesMarkdown: null,
      clubPendingSetup: true,
    })!;
    expect(steps.map((s) => [s.key, s.ok])).toEqual([
      ["club", false], ["courts", false], ["hours", false], ["pricing", false], ["rules", false], ["activation", false],
    ]);
    expect(launchPending(steps)).toBe(true);
  });

  it("todo listo y solicitud enviada: nada pendiente", () => {
    const steps = launchSteps({
      activation: act({ bookingActivationRequestedAt: "2026-11-09T10:00:00Z" }),
      rulesMarkdown: "Normas",
      clubPendingSetup: false,
    })!;
    expect(launchPending(steps)).toBe(false);
  });

  it("con el módulo ya activado no hay lista", () => {
    const steps = launchSteps({
      activation: act({ status: "TESTER_MODE", readiness: null }),
      rulesMarkdown: null,
      clubPendingSetup: true,
    });
    expect(launchPending(steps)).toBe(false);
  });

  it("sin duraciones el enlace va a Pistas; con ellas, a Precios", () => {
    const get = (failing: string[]) =>
      launchSteps({ activation: act({}, failing), rulesMarkdown: "x", clubPendingSetup: false })!.find((s) => s.key === "pricing")!.href;
    expect(get(["COURT_DURATIONS"])).toBe("/mi-club/reservas/pistas");
    expect(get(["COURT_PRICES"])).toBe("/mi-club/reservas/precios");
  });
});

describe("plainActivity", () => {
  it("sin jerga", () => {
    expect(plainActivity("Ana generó el bracket de Open")).toBe("Ana generó el cuadro de Open");
    expect(plainActivity("generó los brackets")).toBe("generó los cuadros");
  });
});
