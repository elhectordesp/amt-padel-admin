/**
 * Mostrador de reservas (L3):
 * - el bloque del calendario dice el titular, si está cobrada o se debe, y las
 *   que esperan invitaciones van con el borde discontinuo; su enlace lleva la
 *   vuelta al calendario en ese día;
 * - el titular es el cliente del club; si no, el contacto de la reserva de
 *   mostrador y, si no, quien la apuntó;
 * - la ficha vuelve al calendario si se viene de él (solo a rutas del
 *   calendario) y, si no, al listado;
 * - el alta: «Por teléfono» por defecto, precio a la vista, cliente (buscado o
 *   dado de alta) y «Cobrada ahora» en la misma petición;
 * - el listado, en tabla, con «Sin pagar».
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
const searchParams = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(searchParams.value) }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/use-me", () => ({ useMe: () => ({ data: { id: "club-admin", name: "Gestor" } }) }));
const adminMock = vi.hoisted(() => ({
  clubs: { findOne: vi.fn() },
  courts: { list: vi.fn() },
  players: { search: vi.fn() },
}));
vi.mock("@/lib/services/admin", () => ({ adminService: adminMock }));

const svc = vi.hoisted(() => ({
  courtDurations: { list: vi.fn() },
  availability: vi.fn(),
  bookings: { list: vi.fn(), detail: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});
const customersSvc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>(
    "@/lib/services/club-customers",
  );
  return { ...actual, clubCustomersService: customersSvc };
});

import { BookingCreateDialog } from "@/components/admin/booking-create-dialog";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import BookingsListPage from "../../../app/(admin)/mi-club/reservas/bookings/page";
import BookingDetailPage from "../../../app/(admin)/mi-club/reservas/bookings/[id]/page";
import { bookingHolder, isUnpaid } from "@/lib/utils/booking-labels";
import type { Booking } from "@/types/bookings";
import type { Court } from "@/types";

const BOOKING = {
  id: "b1", shortCode: "AMT-XP9W", clubId: "c1", courtId: "p1", creatorUserId: "staff",
  matchMode: "ADMIN_MANUAL", status: "CONFIRMED", isCompetitive: false,
  startsAt: "2026-11-02T17:00:00.000Z", endsAt: "2026-11-02T18:30:00.000Z", durationMinutes: 90,
  priceCents: 2000, priceBreakdown: { slot: 2000, extras: [] }, paymentMethod: "PENDING", paidAt: null,
  openMatchSlotsRemaining: null, openMatchMinLspa: null, openMatchMaxLspa: null,
  notes: null, rulesAcceptedAt: null, rulesVersion: null, reminder24hSentAt: null, reminder2hSentAt: null,
  createdAt: "2026-10-28T10:00:00.000Z", updatedAt: "2026-10-28T10:00:00.000Z",
  court: { id: "p1", name: "Pista 1", type: "DOUBLES", isIndoor: false },
  clubCustomer: { id: "cc1", name: "Marta Ruiz", phone: "600111222" },
  creator: { id: "staff", name: "Recepción" },
  participants: [],
} as unknown as Booking;

describe("bookingHolder / isUnpaid", () => {
  it("titular: el cliente del club; si no, el contacto de mostrador; si no, quien la apuntó", () => {
    expect(bookingHolder(BOOKING)).toBe("Marta Ruiz");
    const contact = {
      ...BOOKING,
      clubCustomer: null,
      participants: [{ id: "x", userId: null, guestName: "Juan", status: "AUTO_ACCEPTED" }],
    } as unknown as Booking;
    expect(bookingHolder(contact)).toBe("Juan");
    expect(bookingHolder({ ...BOOKING, clubCustomer: null, participants: [] })).toBe("Recepción");
    expect(bookingHolder({ ...BOOKING, clubCustomer: undefined, creator: undefined })).toBeNull();
  });

  it("se debe: pendiente, con importe y no cancelada", () => {
    expect(isUnpaid(BOOKING)).toBe(true);
    expect(isUnpaid({ ...BOOKING, paymentMethod: "CASH_AT_VENUE" })).toBe(false);
    expect(isUnpaid({ ...BOOKING, priceCents: 0 })).toBe(false);
    expect(isUnpaid({ ...BOOKING, status: "CANCELLED" })).toBe(false);
    expect(isUnpaid({ ...BOOKING, paymentMethod: null })).toBe(false);
  });
});

describe("ReservasDayGrid — bloque de la reserva", () => {
  const courts = [{ id: "p1", name: "Pista 1" }] as Court[];
  const grid = (bookings: Booking[], period: "todo" | "tarde" = "todo") =>
    render(
      <ReservasDayGrid
        date="2026-11-02"
        timeZone="Europe/Madrid"
        courts={courts}
        bookings={bookings}
        window={{ openTime: "09:00", closeTime: "22:00" }}
        onSlotClick={vi.fn()}
        period={period}
      />,
    );

  it("titular, sin cobrar, y enlace a la ficha con la vuelta al calendario de ese día", () => {
    grid([BOOKING], "tarde");
    const link = screen.getByRole("link", { name: /Marta Ruiz/ });
    expect(link).toHaveTextContent("Sin cobrar");
    expect(link.getAttribute("href")).toBe(
      `/mi-club/reservas/bookings/b1?volver=${encodeURIComponent("/mi-club/reservas/calendario?fecha=2026-11-02&franja=tarde")}`,
    );
  });

  it("cobrada: el icono lo dice", () => {
    grid([{ ...BOOKING, paymentMethod: "CASH_AT_VENUE" }]);
    expect(screen.getByRole("link", { name: /Marta Ruiz/ })).toHaveTextContent("Cobrada");
  });

  it("esperando invitaciones: borde discontinuo; confirmada, no", () => {
    const { unmount } = grid([{ ...BOOKING, status: "PENDING_INVITES" }]);
    expect(screen.getByRole("link", { name: /Marta Ruiz/ }).className).toContain("border-dashed");
    unmount();
    grid([BOOKING]);
    expect(screen.getByRole("link", { name: /Marta Ruiz/ }).className).not.toContain("border-dashed");
  });

  it("lleva su leyenda", () => {
    grid([BOOKING]);
    expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("Esperando invitaciones");
  });
});

function renderWith(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

describe("Ficha — volver a donde venías", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.clubs.findOne.mockResolvedValue({ id: "c1", name: "Club", timezone: "Europe/Madrid" });
    svc.bookings.detail.mockResolvedValue(BOOKING);
  });

  const renderDetail = async () => {
    await act(async () => {
      renderWith(<BookingDetailPage params={Promise.resolve({ id: "b1" })} />);
    });
  };

  it("con ?volver= del calendario, vuelve a él (día y franja)", async () => {
    searchParams.value = `volver=${encodeURIComponent("/mi-club/reservas/calendario?fecha=2026-11-02&franja=tarde")}`;
    await renderDetail();
    const back = await screen.findByRole("link", { name: /Volver al calendario/ });
    expect(back.getAttribute("href")).toBe("/mi-club/reservas/calendario?fecha=2026-11-02&franja=tarde");
  });

  it("una vuelta que no es del calendario se ignora: al listado", async () => {
    searchParams.value = `volver=${encodeURIComponent("https://malo.example/x")}`;
    await renderDetail();
    const back = await screen.findByRole("link", { name: /Volver al listado/ });
    expect(back.getAttribute("href")).toBe("/mi-club/reservas/bookings");
  });

  it("sin ?volver=, al listado; y un solo título con el código", async () => {
    searchParams.value = "";
    await renderDetail();
    expect(await screen.findByRole("link", { name: /Volver al listado/ })).toBeInTheDocument();
    expect(screen.getByTestId("header")).toHaveTextContent("Reserva AMT-XP9W");
    expect(screen.queryByRole("heading", { name: /Reserva/ })).not.toBeInTheDocument();
  });

  it("pago con los nombres nuevos", async () => {
    await renderDetail();
    expect(await screen.findByRole("button", { name: "Cobrada en el club (efectivo o tarjeta)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobrada por transferencia u otro" })).toBeInTheDocument();
  });
});

describe("Listado — tabla y «Sin pagar»", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.clubs.findOne.mockResolvedValue({ id: "c1", name: "Club", timezone: "Europe/Madrid" });
    svc.bookings.list.mockResolvedValue({
      items: [BOOKING, { ...BOOKING, id: "b2", shortCode: "AMT-2222", paymentMethod: "CASH_AT_VENUE", clubCustomer: null }],
      total: 2,
    });
  });

  it("titular, modo con la etiqueta de la ficha, importe y pago", async () => {
    renderWith(<BookingsListPage />);
    expect(await screen.findByText("Marta Ruiz")).toBeInTheDocument();
    expect(screen.getAllByText(/Reservada en mostrador/).length).toBeGreaterThan(0);
    expect(screen.queryByText("ADMIN_MANUAL")).not.toBeInTheDocument();
    expect(screen.getByText("Sin cobrar")).toBeInTheDocument();
    expect(screen.getByText("Cobrada")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Titular" })).toBeInTheDocument();
  });

  it("«Sin pagar» pide solo las que se deben, desde la primera página", async () => {
    renderWith(<BookingsListPage />);
    await screen.findByText("Marta Ruiz");
    fireEvent.click(screen.getByRole("checkbox", { name: "Sin pagar" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.objectContaining({ unpaid: "true", offset: 0 })),
    );
  });

  it("mantiene las casillas y «Seleccionar todas»", async () => {
    renderWith(<BookingsListPage />);
    await screen.findByText("Marta Ruiz");
    expect(screen.getByRole("checkbox", { name: "Seleccionar la reserva AMT-XP9W" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seleccionar todas/ })).toBeInTheDocument();
  });
});

describe("Alta de reserva — mostrador", () => {
  const SLOT = "2026-11-02T17:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.courts.list.mockResolvedValue([{ id: "p1", name: "Pista 1", active: true, type: "DOUBLES" }]);
    svc.courtDurations.list.mockResolvedValue([{ id: "d", courtId: "p1", minutes: 90, isDefault: true }]);
    svc.availability.mockResolvedValue([
      {
        courtId: "p1", courtName: "Pista 1", courtType: "DOUBLES", isIndoor: false, startsAt: SLOT,
        endsAt: SLOT, startsAtLocal: "18:00", durationMinutes: 90, priceCents: 2000,
        priceBreakdown: { slot: 2000, extras: [] },
      },
    ]);
    svc.bookings.create.mockResolvedValue({ id: "b9" });
    customersSvc.list.mockResolvedValue({
      items: [{ id: "cc1", name: "Marta Ruiz", phone: "600111222" }],
      total: 1, page: 1, pageSize: 6,
    });
  });

  const open = async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <BookingCreateDialog
          open onClose={vi.fn()} clubId="c1" timeZone="Europe/Madrid"
          initial={{ courtId: "p1", date: "2026-11-02", startsAt: SLOT }}
        />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("18:00");
  };

  it("«Por teléfono» por defecto, con el precio a la vista y sin jerga", async () => {
    await open();
    expect(screen.getByRole("radio", { name: /Por teléfono/ })).toBeChecked();
    expect(screen.getAllByText(/20,00 €/).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/walk-in|LSPA|AMT/i);
  });

  it("el pie con los botones queda fuera de la zona que se desplaza", async () => {
    await open();
    const scroller = screen.getByRole("button", { name: "Crear reserva" }).closest("div.overflow-y-auto");
    expect(scroller).toBeNull();
  });

  it("cliente buscado y «Cobrada ahora»: todo en una petición", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "Marta" } });
    fireEvent.click(await screen.findByRole("button", { name: /Marta Ruiz/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Cobrada ahora/ }));
    fireEvent.change(screen.getByLabelText("Cómo se ha cobrado"), { target: { value: "PAID_MANUAL" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));

    await waitFor(() =>
      expect(svc.bookings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          matchMode: "ADMIN_MANUAL",
          clubCustomerId: "cc1",
          payNow: { method: "PAID_MANUAL" },
        }),
      ),
    );
  });

  it("sin marcar «Cobrada ahora» ni elegir cliente, no manda ni payNow ni clubCustomerId", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));
    await waitFor(() => expect(svc.bookings.create).toHaveBeenCalled());
    const payload = svc.bookings.create.mock.calls[0][0];
    expect(payload).not.toHaveProperty("payNow");
    expect(payload).not.toHaveProperty("clubCustomerId");
  });

  it("cliente nuevo: alta rápida con nombre y teléfono, y se asigna a la reserva", async () => {
    customersSvc.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 6 });
    customersSvc.create.mockResolvedValue({ id: "cc9", name: "Luis", phone: "611222333" });
    await open();
    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "Luis" } });
    fireEvent.click(await screen.findByRole("button", { name: /Dar de alta/ }));
    fireEvent.change(screen.getByLabelText("Teléfono del cliente"), { target: { value: "611222333" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir cliente" }));

    await waitFor(() =>
      expect(customersSvc.create).toHaveBeenCalledWith("c1", { name: "Luis", phone: "611222333" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Crear reserva" }));
    await waitFor(() =>
      expect(svc.bookings.create).toHaveBeenCalledWith(expect.objectContaining({ clubCustomerId: "cc9" })),
    );
  });
});
