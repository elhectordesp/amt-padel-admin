/**
 * GET /bookings desde el panel:
 * - los estados van como claves repetidas (statuses=A&statuses=B), que es lo
 *   que entiende el back (Express 5); «statuses[]=A» se perdía;
 * - `listAll` pide todas las páginas (el back no da más de 100 por petición).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

const getMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { get: getMock } }));

import { bookingsService } from "@/lib/services/bookings";
import type { Booking } from "@/types/bookings";

const b = (id: string) => ({ id }) as Booking;

describe("bookingsService.bookings", () => {
  beforeEach(() => getMock.mockReset());

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
});
