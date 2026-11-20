/**
 * Caja con el módulo Cuentas: los movimientos de las partes de una reserva
 * enlazados a su reserva, el Bizum por receptor y, en «Pendiente de cobro»,
 * las partes sin cobrar con enlace a su reserva en vez del cobro suelto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const cashMock = vi.hoisted(() => ({ day: vi.fn(), debts: vi.fn() }));
vi.mock("@/lib/services/cash", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/cash")>()),
  cashService: cashMock,
}));
const accountsOn = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => accountsOn.value }));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
vi.mock("@/lib/services/bookings", () => ({ bookingsService: { bookings: { markPaid: vi.fn() } } }));
vi.mock("@/lib/services/admin", () => ({ adminService: { registrations: { updatePayment: vi.fn() } } }));

import { CajaDay } from "@/components/admin/caja-day";
import { CajaDebts } from "@/components/admin/caja-debts";

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const DAY = {
  date: "2026-11-10",
  timezone: "Europe/Madrid",
  movements: [
    { source: "BOOKING_PART", refId: "p1", bookingId: "b7", at: "2026-11-10T09:30:00.000Z", concept: "Pista 1 · 10:30", person: "Ana", method: "BIZUM", amountCents: 500, bizumReceiver: "Marta" },
    { source: "BOOKING", refId: "b2", at: "2026-11-10T10:30:00.000Z", concept: "Reserva Pista 2", person: "Luis", method: "BIZUM", amountCents: 1800, bizumReceiver: "Club" },
    { source: "BOOKING_PART", refId: "p2", bookingId: "b7", at: "2026-11-10T09:35:00.000Z", concept: "Pista 1 · 10:30", person: "Pepe", method: "CASH", amountCents: 500 },
  ],
  totalsByMethod: { BIZUM: 2300, CASH: 500 },
  bizumByReceiver: { Marta: 500, Club: 1800 },
  totalCents: 2800,
};

describe("caja del día con partes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cashMock.day.mockResolvedValue(DAY);
  });

  it("la parte de una reserva lleva a su reserva y el Bizum dice a qué móvil llegó", async () => {
    wrap(<CajaDay clubId="c1" clubName={null} timeZone="Europe/Madrid" />);
    const links = await screen.findAllByRole("link", { name: "Pista 1 · 10:30" });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/mi-club/reservas/bookings/b7");
    expect(screen.getByText("Bizum · Marta")).toBeInTheDocument();
    expect(screen.getByText("Bizum · Club")).toBeInTheDocument();
    // Una reserva entera no es un enlace
    expect(screen.queryByRole("link", { name: "Reserva Pista 2" })).not.toBeInTheDocument();
  });

  it("el desglose «Bizum por receptor» enseña cada móvil con su importe, «Club» primero", async () => {
    wrap(<CajaDay clubId="c1" clubName={null} timeZone="Europe/Madrid" />);
    const block = await screen.findByLabelText("Bizum por receptor");
    const items = within(block).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Club: 18,00 €");
    expect(items[1]).toHaveTextContent("Marta: 5,00 €");
  });

  it("sin desglose (módulo apagado), no sale esa sección", async () => {
    cashMock.day.mockResolvedValue({ ...DAY, movements: [], bizumByReceiver: undefined, totalsByMethod: {}, totalCents: 0 });
    wrap(<CajaDay clubId="c1" clubName={null} timeZone="Europe/Madrid" />);
    await screen.findByText("No se cobró nada este día.");
    expect(screen.queryByLabelText("Bizum por receptor")).not.toBeInTheDocument();
  });
});

describe("pendiente de cobro con partes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accountsOn.value = true;
    accounts.partners.list.mockResolvedValue([]);
    cashMock.debts.mockResolvedValue({
      totalCents: 1000,
      people: [{
        key: "c:cc1", name: "Ana", userId: null, customerId: "cc1", totalCents: 1000,
        items: [{ source: "BOOKING_PART", refId: "p3", bookingId: "b8", concept: "Pista 3 · 09/11 18:00", date: "2026-11-09T17:00:00.000Z", amountCents: 1000 }],
      }],
    });
  });

  it("la parte sin cobrar se abre en su reserva: no tiene cobro suelto", async () => {
    wrap(<CajaDebts clubId="c1" timeZone="Europe/Madrid" />);
    const link = await screen.findByRole("link", { name: /Abrir la reserva/ });
    expect(link).toHaveAttribute("href", "/mi-club/reservas/bookings/b8");
    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
  });
});
