/**
 * Caja con la tienda (M4): los movimientos de ventas enlazados a su reserva y
 * las ventas pendientes de «Pendiente de cobro», que se cobran ahí mismo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const cashMock = vi.hoisted(() => ({ day: vi.fn(), debts: vi.fn() }));
vi.mock("@/lib/services/cash", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/cash")>()),
  cashService: cashMock,
}));
const shop = vi.hoisted(() => ({ products: { list: vi.fn() }, sales: { list: vi.fn(), pay: vi.fn() } }));
vi.mock("@/lib/services/shop", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/shop")>()),
  shopService: shop,
}));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => true }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: () => true }) }));
vi.mock("@/lib/services/bookings", () => ({ bookingsService: { bookings: { markPaid: vi.fn() } } }));
vi.mock("@/lib/services/admin", () => ({ adminService: { registrations: { updatePayment: vi.fn() } } }));
vi.mock("@/lib/services/club-customers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-customers")>()),
  clubCustomersService: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }), create: vi.fn() },
}));
vi.mock("@/components/admin/cash-closure-panel", () => ({ CashClosurePanel: () => null }));

import { CajaDay } from "@/components/admin/caja-day";
import { CajaDebts } from "@/components/admin/caja-debts";

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const DAY = {
  date: "2026-11-10",
  timezone: "Europe/Madrid",
  movements: [
    { source: "SALE", refId: "s1", bookingId: "b7", at: "2026-11-10T09:30:00.000Z", concept: "Tienda: 2 × Bolas", person: "Ana", method: "BIZUM", amountCents: 1200, bizumReceiver: "Marta" },
    { source: "SALE", refId: "s2", at: "2026-11-10T10:30:00.000Z", concept: "Devolución de la tienda: 1 × Grip", person: "Recepción", method: "CASH", amountCents: -300 },
  ],
  totalsByMethod: { BIZUM: 1200, CASH: -300 },
  bizumByReceiver: { Marta: 1200 },
  totalCents: 900,
};

describe("caja del día con la tienda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cashMock.day.mockResolvedValue(DAY);
    shop.sales.list.mockResolvedValue([]);
    shop.products.list.mockResolvedValue([]);
  });

  it("la venta de una reserva lleva a ella; la devolución suelta, no; el Bizum dice el móvil", async () => {
    wrap(<CajaDay clubId="c1" clubName={null} timeZone="Europe/Madrid" />);
    const link = await screen.findByRole("link", { name: "Tienda: 2 × Bolas" });
    expect(link).toHaveAttribute("href", "/mi-club/reservas/bookings/b7");
    expect(screen.getByText("Devolución de la tienda: 1 × Grip")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Devolución/ })).not.toBeInTheDocument();
    expect(screen.getByText("Bizum · Marta")).toBeInTheDocument();
  });

  it("incluye «Tienda del día» con «Vender»", async () => {
    wrap(<CajaDay clubId="c1" clubName={null} timeZone="Europe/Madrid" />);
    expect(await screen.findByRole("region", { name: "Tienda" })).toBeInTheDocument();
    // El día de la caja es hoy en la zona del club
    expect(shop.sales.list).toHaveBeenCalledWith("c1", { date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
});

describe("Pendiente de cobro con la tienda", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cashMock.debts.mockResolvedValue({
      people: [{
        key: "customer:cc1", name: "Luis", userId: null, customerId: "cc1", totalCents: 1200,
        items: [{ source: "SALE", refId: "s9", bookingId: "b7", concept: "Tienda: 2 × Bolas", date: "2026-11-09T09:30:00.000Z", amountCents: 1200 }],
      }],
      totalCents: 1200,
    });
    accounts.partners.list.mockResolvedValue([]);
    shop.sales.pay.mockResolvedValue({});
  });

  it("la venta pendiente se cobra ahí mismo, por su id y con el método elegido", async () => {
    wrap(<CajaDebts clubId="c1" timeZone="Europe/Madrid" />);
    expect(await screen.findByText("Tienda: 2 × Bolas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cobrar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar la venta" });
    expect(within(dialog).getByText("Cobrar 12,00 €")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Efectivo" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Cobrar$/ }));

    await waitFor(() => expect(shop.sales.pay).toHaveBeenCalledWith("c1", "s9", { method: "CASH" }));
  });
});
