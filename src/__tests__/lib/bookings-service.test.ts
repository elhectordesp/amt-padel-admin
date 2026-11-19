/**
 * GET /bookings desde el panel:
 * - los estados van como claves repetidas (statuses=A&statuses=B), que es lo
 *   que entiende el back (Express 5); «statuses[]=A» se perdía;
 * - `listAll` pide todas las páginas (el back no da más de 100 por petición);
 * - cancelar varias (el back admite 100 por petición) va en lotes de 100 y junta
 *   los resultados; con «devolver lo cobrado» lo manda en cada lote;
 * - cancelar una con devolución manda el importe; sin ella, solo el motivo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { get: getMock, post: postMock, delete: deleteMock } }));

import { bookingsService } from "@/lib/services/bookings";
import type { Booking } from "@/types/bookings";

const b = (id: string) => ({ id }) as Booking;

describe("bookingsService.bookings", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
  });

  it("list manda los estados como claves repetidas", async () => {
    getMock.mockResolvedValue({ data: { items: [], total: 0 } });
    await bookingsService.bookings.list({ clubId: "c1", statuses: ["CONFIRMED", "IN_PROGRESS"] });

    const [url, config] = getMock.mock.calls[0];
    expect(axios.getUri({ url, ...config })).toBe("/bookings?clubId=c1&statuses=CONFIRMED&statuses=IN_PROGRESS");
  });

  it("listAll junta todas las páginas de 100, sin repetir", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => b(`b${i}`));
    const page2 = [b("b99"), b("b100"), b("b101")];
    getMock
      .mockResolvedValueOnce({ data: { items: page1, total: 102 } })
      .mockResolvedValueOnce({ data: { items: page2, total: 102 } });

    const all = await bookingsService.bookings.listAll({ clubId: "c1", fromDate: "a", toDate: "z" });

    expect(all).toHaveLength(102);
    expect(getMock).toHaveBeenCalledTimes(2);
    expect(getMock.mock.calls[0][1].params).toMatchObject({ limit: 100, offset: 0 });
    expect(getMock.mock.calls[1][1].params).toMatchObject({ limit: 100, offset: 100 });
  });

  it("listAll con una sola página hace una petición", async () => {
    getMock.mockResolvedValue({ data: { items: [b("x")], total: 1 } });
    expect(await bookingsService.bookings.listAll({ clubId: "c1" })).toEqual([b("x")]);
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  describe("cancelMany", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `b${i}`);
    // Cada lote cancela todo lo que se le manda salvo `failing`
    const respondByBatch = (failing: string[] = []) =>
      postMock.mockImplementation((_url: string, body: { ids: string[] }) =>
        Promise.resolve({
          data: {
            cancelled: body.ids.filter((id) => !failing.includes(id)),
            failed: body.ids.filter((id) => failing.includes(id)).map((id) => ({ id, code: "BOOKING_ALREADY_CANCELLED" })),
          },
        }),
      );

    it("más de 100: en lotes de 100 y junta lo cancelado y lo fallido de todos", async () => {
      respondByBatch(["b5", "b150"]);

      const result = await bookingsService.bookings.cancelMany(ids(250), "Lluvia");

      expect(postMock).toHaveBeenCalledTimes(3);
      expect(postMock.mock.calls.map(([, body]) => body.ids.length)).toEqual([100, 100, 50]);
      expect(postMock.mock.calls[0][0]).toBe("/bookings/cancel-many");
      expect(postMock.mock.calls[0][1].reason).toBe("Lluvia");
      expect(result.cancelled).toHaveLength(248);
      expect(result.failed).toEqual([
        { id: "b5", code: "BOOKING_ALREADY_CANCELLED" },
        { id: "b150", code: "BOOKING_ALREADY_CANCELLED" },
      ]);
    });

    it("si falla un lote intermedio, conserva lo ya cancelado y marca el resto sin procesar", async () => {
      postMock
        .mockResolvedValueOnce({ data: { cancelled: ids(100), failed: [] } })
        .mockRejectedValueOnce(new Error("Network Error"));

      const result = await bookingsService.bookings.cancelMany(ids(250));

      expect(postMock).toHaveBeenCalledTimes(2);
      expect(result.cancelled).toHaveLength(100);
      expect(result.failed).toHaveLength(150);
      expect(result.failed[0]).toEqual({ id: "b100", code: "NOT_PROCESSED" });
    });

    it("si falla el primer lote, el error sale tal cual", async () => {
      postMock.mockRejectedValueOnce(new Error("Network Error"));
      await expect(bookingsService.bookings.cancelMany(ids(250))).rejects.toThrow("Network Error");
    });

    it("hasta 100, una sola petición", async () => {
      respondByBatch();
      await bookingsService.bookings.cancelMany(ids(100));
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    it("«devolver lo cobrado» va en cada lote; sin él, no se manda la clave", async () => {
      respondByBatch();
      await bookingsService.bookings.cancelMany(ids(150), undefined, true);
      expect(postMock.mock.calls.map(([, body]) => body.refundPaid)).toEqual([true, true]);

      postMock.mockClear();
      await bookingsService.bookings.cancelMany(ids(10), undefined, false);
      expect(postMock.mock.calls[0][1]).not.toHaveProperty("refundPaid");
    });
  });

  describe("cancel", () => {
    it("con devolución, manda el importe en céntimos junto al motivo", async () => {
      deleteMock.mockResolvedValue({ data: {} });
      await bookingsService.bookings.cancel("b1", "Lluvia", 1250);
      expect(deleteMock).toHaveBeenCalledWith("/bookings/b1", { data: { reason: "Lluvia", refundAmountCents: 1250 } });
    });

    it("sin devolución (o de 0), solo el motivo", async () => {
      deleteMock.mockResolvedValue({ data: {} });
      await bookingsService.bookings.cancel("b1", "Lluvia");
      await bookingsService.bookings.cancel("b2", undefined, 0);
      expect(deleteMock.mock.calls[0][1]).toEqual({ data: { reason: "Lluvia" } });
      expect(deleteMock.mock.calls[1][1].data).not.toHaveProperty("refundAmountCents");
    });
  });
});
