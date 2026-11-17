/**
 * La campana del equipo del club: no leídas, lista, enlace a la reserva o al
 * torneo, y marcar leídas (una al pulsarla, o todas).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.hoisted(() => vi.fn());
const markReadMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/club-notices", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-notices")>()),
  clubNoticesService: { list: listMock, markRead: markReadMock },
}));

import { ClubNoticesBell } from "@/components/admin/club-notices-bell";
import { noticeHref, timeAgo } from "@/lib/utils/club-notices";

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const page = {
  unread: 2,
  items: [
    {
      id: "n1",
      type: "club_booking_created",
      title: "Nueva reserva",
      body: "Ana ha reservado Pista 1",
      data: { bookingId: "b1" },
      read: false,
      createdAt: iso(5),
    },
    {
      id: "n2",
      type: "club_registration_cancelled",
      title: "Inscripción anulada",
      body: "Luis ha anulado su inscripción",
      data: { tournamentId: "t1", categoryId: "c1" },
      read: false,
      createdAt: iso(180),
    },
  ],
};

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ClubNoticesBell clubId="club-1" />
    </QueryClientProvider>,
  );
}

describe("ClubNoticesBell", () => {
  beforeEach(() => {
    listMock.mockReset().mockResolvedValue(page);
    markReadMock.mockReset().mockResolvedValue({ updated: 1 });
  });

  it("enseña el número de no leídas", async () => {
    renderBell();
    expect(await screen.findByText("2")).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith("club-1");
  });

  it("al abrirla lista los avisos con su enlace a la reserva y al torneo", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /Avisos del club: 2 sin leer/ }));
    expect(screen.getByText("Ana ha reservado Pista 1")).toBeTruthy();
    expect(screen.getByText("hace 5 min")).toBeTruthy();
    expect(screen.getByText("hace 3 h")).toBeTruthy();
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/mi-club/reservas/bookings/b1", "/torneos/t1"]);
  });

  it("pulsar un aviso lo marca leído", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /Avisos del club/ }));
    fireEvent.click(screen.getByText("Ana ha reservado Pista 1"));
    await waitFor(() => expect(markReadMock).toHaveBeenCalledWith("club-1", ["n1"]));
  });

  it("«Marcar todas como leídas» no manda ids", async () => {
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: /Avisos del club/ }));
    fireEvent.click(screen.getByRole("button", { name: "Marcar todas como leídas" }));
    await waitFor(() => expect(markReadMock).toHaveBeenCalledWith("club-1", undefined));
  });

  it("sin avisos, lo dice y no hay número", async () => {
    listMock.mockResolvedValue({ items: [], unread: 0 });
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "Avisos del club" }));
    expect(await screen.findByText(/Aún no hay avisos/)).toBeTruthy();
  });
});

describe("noticeHref / timeAgo", () => {
  it("la reserva manda sobre el torneo; sin ninguno, null", () => {
    expect(noticeHref({ data: { bookingId: "b", tournamentId: "t" } })).toBe("/mi-club/reservas/bookings/b");
    expect(noticeHref({ data: { tournamentId: "t" } })).toBe("/torneos/t");
    expect(noticeHref({ data: {} })).toBeNull();
    expect(noticeHref({ data: null })).toBeNull();
  });

  it("hace cuánto", () => {
    const now = new Date("2026-11-17T12:00:00Z");
    expect(timeAgo("2026-11-17T11:59:40Z", now)).toBe("ahora");
    expect(timeAgo("2026-11-17T11:30:00Z", now)).toBe("hace 30 min");
    expect(timeAgo("2026-11-17T09:00:00Z", now)).toBe("hace 3 h");
    expect(timeAgo("2026-11-16T09:00:00Z", now)).toBe("hace 1 día");
    expect(timeAgo("2026-11-14T09:00:00Z", now)).toBe("hace 3 días");
  });
});
