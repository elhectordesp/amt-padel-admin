/**
 * Reservas fijas desde el panel: cada llamada va a su ruta bajo
 * /admin/clubs/:clubId/booking-series con lo que pide el contrato. Crear,
 * ampliar y terminar escriben una reserva por fecha: con más tiempo que los 10 s
 * de siempre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { get: getMock, post: postMock } }));

import { bookingSeriesQK, bookingSeriesService } from "@/lib/services/booking-series";

const PLAN = {
  courtId: "p3", clubCustomerId: "k1", startDate: "2026-12-01", endDate: "2027-06-30", startTime: "19:30", durationMinutes: 90,
};

describe("bookingSeriesService", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    postMock.mockResolvedValue({ data: { ok: true } });
  });

  it("preview manda el plan a /preview, sin tiempo de espera extra", async () => {
    await bookingSeriesService.preview("c1", PLAN);
    expect(postMock).toHaveBeenCalledWith("/admin/clubs/c1/booking-series/preview", PLAN);
  });

  it("create manda el plan con las notas y espera hasta 30 s", async () => {
    await bookingSeriesService.create("c1", { ...PLAN, notes: "Cuenta abierta" });
    expect(postMock).toHaveBeenCalledWith("/admin/clubs/c1/booking-series", { ...PLAN, notes: "Cuenta abierta" }, { timeout: 30_000 });
  });

  it("list pide las activas por defecto y las que se le pidan", async () => {
    getMock.mockResolvedValue({ data: [{ id: "s1" }] });
    expect(await bookingSeriesService.list("c1")).toEqual([{ id: "s1" }]);
    expect(getMock).toHaveBeenLastCalledWith("/admin/clubs/c1/booking-series", { params: { status: "active" } });
    await bookingSeriesService.list("c1", "ended");
    expect(getMock).toHaveBeenLastCalledWith("/admin/clubs/c1/booking-series", { params: { status: "ended" } });
  });

  it("list sin cuerpo devuelve una lista vacía", async () => {
    getMock.mockResolvedValue({ data: null });
    expect(await bookingSeriesService.list("c1")).toEqual([]);
  });

  it("detail pide la reserva fija con sus reservas", async () => {
    getMock.mockResolvedValue({ data: { id: "s1", bookings: [] } });
    expect(await bookingSeriesService.detail("c1", "s1")).toEqual({ id: "s1", bookings: [] });
    expect(getMock).toHaveBeenCalledWith("/admin/clubs/c1/booking-series/s1");
  });

  it("ampliar: la vista previa y la ampliación llevan la nueva fecha de fin", async () => {
    await bookingSeriesService.extendPreview("c1", "s1", "2027-09-30");
    expect(postMock).toHaveBeenLastCalledWith("/admin/clubs/c1/booking-series/s1/extend-preview", { endDate: "2027-09-30" });
    await bookingSeriesService.extend("c1", "s1", "2027-09-30");
    expect(postMock).toHaveBeenLastCalledWith("/admin/clubs/c1/booking-series/s1/extend", { endDate: "2027-09-30" }, { timeout: 30_000 });
  });

  it("terminar manda desde qué día y el motivo, si lo hay", async () => {
    await bookingSeriesService.end("c1", "s1", { fromDate: "2026-12-10", reason: "Lluvia" });
    expect(postMock).toHaveBeenLastCalledWith(
      "/admin/clubs/c1/booking-series/s1/end",
      { fromDate: "2026-12-10", reason: "Lluvia" },
      { timeout: 30_000 },
    );
  });

  it("las claves de consulta cuelgan del club, para refrescarlas juntas", () => {
    expect(bookingSeriesQK.list("c1", "active").slice(0, 2)).toEqual(bookingSeriesQK.all("c1"));
    expect(bookingSeriesQK.detail("c1", "s1").slice(0, 2)).toEqual(bookingSeriesQK.all("c1"));
  });
});
