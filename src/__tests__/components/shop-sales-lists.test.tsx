/**
 * Las ventas de la tienda en la ficha de una reserva y en la caja del día
 * (módulo Cuentas, M4): cobrar las pendientes, anular según su estado y quién
 * puede hacerlo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const shop = vi.hoisted(() => ({ products: { list: vi.fn() }, sales: { list: vi.fn(), sell: vi.fn(), pay: vi.fn(), cancel: vi.fn() } }));
vi.mock("@/lib/services/shop", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/shop")>()),
  shopService: shop,
}));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
const flags = vi.hoisted(() => ({ on: true, cashWrite: true, accounts: true }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => flags.on }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: null, can: (area: string, level = "read") => (area === "cash" && level === "write" ? flags.cashWrite : area === "accounts" && level === "write" ? flags.accounts : true) }),
}));
vi.mock("@/lib/services/club-customers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-customers")>()),
  clubCustomersService: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }), create: vi.fn() },
}));

import { BookingShopSales } from "@/components/admin/booking-shop-sales";
import { ShopDaySales, ShopSellButton } from "@/components/admin/shop-day-sales";
import { toast } from "sonner";
import type { ShopSale } from "@/lib/services/shop";

const sale = (patch: Partial<ShopSale> = {}): ShopSale => ({
  id: "s1", productName: "Bolas", quantity: 2, unitPriceCents: 600, amountCents: 1200, bookingId: "b1",
  personName: null, status: "PAID", paymentMethod: "CASH", bizumPartnerName: null, paidAt: "2026-11-20T10:00:00.000Z",
  debtId: null, debtStatus: null, cancelledAt: null, refundAmountCents: null, soldByName: "Recepción", createdAt: "2026-11-20T10:00:00.000Z",
  ...patch,
});
const PENDING = sale({ id: "s2", status: "PENDING", paymentMethod: null, paidAt: null, productName: "Grips", quantity: 1, amountCents: 300 });
const DEBT = sale({ id: "s3", status: "DEBT", paymentMethod: null, paidAt: null, debtId: "d1", debtStatus: "OPEN", productName: "Cuerdas", personName: "Pablo" });
const CANCELLED = sale({ id: "s4", productName: "Bote", cancelledAt: "2026-11-20T11:00:00.000Z", refundAmountCents: 1200 });

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("tienda en la ficha de la reserva", () => {
  const onChanged = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    flags.on = true;
    flags.cashWrite = true;
    flags.accounts = true;
    // El «hoy» de estas pruebas es el día de las ventas
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-20T18:00:00.000Z") });
    shop.sales.list.mockResolvedValue([sale(), PENDING, DEBT, CANCELLED]);
    shop.products.list.mockResolvedValue([]);
    accounts.partners.list.mockResolvedValue([]);
    shop.sales.cancel.mockResolvedValue(sale());
    shop.sales.pay.mockResolvedValue(sale());
  });

  afterEach(() => vi.useRealTimers());

  const renderBooking = (status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") =>
    wrap(<BookingShopSales clubId="c1" bookingId="b1" status={status} onChanged={onChanged} />);

  it("pide las ventas de esa reserva y enseña cada una con su estado", async () => {
    renderBooking();
    expect(await screen.findByText(/2 × Bolas/)).toBeInTheDocument();
    expect(shop.sales.list).toHaveBeenCalledWith("c1", { bookingId: "b1" });
    expect(screen.getByText("Cobrada · Efectivo")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de cobro")).toBeInTheDocument();
    expect(screen.getByText("A deber")).toBeInTheDocument();
    expect(screen.getByText("Anulada")).toBeInTheDocument();
  });

  it("solo la pendiente se cobra; las anuladas no se pueden anular otra vez", async () => {
    renderBooking();
    await screen.findByText(/2 × Bolas/);
    expect(screen.getAllByRole("button", { name: /Cobrar/ })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Anular/ })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Anular 2 × Bote/ })).not.toBeInTheDocument();
  });

  it("cobrar una pendiente: método y, con Bizum, a qué móvil", async () => {
    accounts.partners.list.mockResolvedValue([{ id: "m1", name: "Marta", active: true }]);
    renderBooking();
    await screen.findByText(/2 × Bolas/);
    fireEvent.click(screen.getByRole("button", { name: /Cobrar/ }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar la venta" });
    expect(within(dialog).getByRole("button", { name: /Cobrar/ })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Bizum" }));
    fireEvent.click(await within(dialog).findByRole("button", { name: "Marta" }));
    fireEvent.click(within(dialog).getByRole("button", { name: /Cobrar/ }));

    await waitFor(() => expect(shop.sales.pay).toHaveBeenCalledWith("c1", "s2", { method: "BIZUM", bizumPartnerId: "m1" }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("anular pide confirmación y dice qué pasa con el dinero", async () => {
    renderBooking();
    await screen.findByText(/2 × Bolas/);
    fireEvent.click(screen.getByRole("button", { name: /Anular 2 × Bolas/ }));
    expect(await screen.findByText(/Se devolverán 12,00/)).toBeInTheDocument();
    // Una cobrada pide motivo: sin él no se puede anular
    expect(screen.getByRole("button", { name: "Anular venta" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "ab" } });
    expect(screen.getByRole("button", { name: "Anular venta" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "Cobrada por error" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular venta" }));

    await waitFor(() => expect(shop.sales.cancel).toHaveBeenCalledWith("c1", "s1", "Cobrada por error"));
    expect(toast.success).toHaveBeenCalledWith("Venta anulada");
    expect(onChanged).toHaveBeenCalled();
  });

  it("si el back dice que ya no se puede anular (deuda cobrada), enseña su mensaje", async () => {
    shop.sales.cancel.mockRejectedValue(Object.assign(new Error("La deuda de la venta ya se ha cobrado o cerrado"), { code: "ACCOUNTS_SALE_LOCKED" }));
    renderBooking();
    await screen.findByText(/2 × Bolas/);
    fireEvent.click(screen.getByRole("button", { name: /Anular 2 × Cuerdas/ }));
    // Una a deber no pide motivo
    expect(screen.queryByLabelText("Motivo de la anulación")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Anular venta" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La deuda de la venta ya se ha cobrado o cerrado"));
  });

  it("una venta cobrada otro día solo se anula con el área accounts; una pendiente o a deber, con la caja", async () => {
    flags.accounts = false;
    shop.sales.list.mockResolvedValue([
      sale({ paidAt: "2026-11-19T10:00:00.000Z" }),
      sale({ id: "s5", productName: "Grips", paidAt: "2026-11-20T10:00:00.000Z" }),
      PENDING, DEBT,
    ]);
    renderBooking();
    await screen.findByText(/2 × Bolas/);
    expect(screen.queryByRole("button", { name: /Anular 2 × Bolas/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anular 2 × Grips/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anular 1 × Grips/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anular 2 × Cuerdas/ })).toBeInTheDocument();
  });

  it("una venta a deber con la deuda cobrada, perdonada o perdida lo dice y no ofrece anular", async () => {
    shop.sales.list.mockResolvedValue([
      { ...DEBT, id: "s6", productName: "Cuerdas", debtStatus: "PAID" },
      { ...DEBT, id: "s7", productName: "Overgrips", debtStatus: "FORGIVEN" },
      { ...DEBT, id: "s8", productName: "Pelotas", debtStatus: "LOST" },
    ]);
    renderBooking();
    await screen.findByText(/2 × Cuerdas/);
    expect(screen.getByText("Deuda cobrada")).toBeInTheDocument();
    expect(screen.getByText("Deuda perdonada")).toBeInTheDocument();
    expect(screen.getByText("Deuda perdida")).toBeInTheDocument();
    expect(screen.queryByText("A deber")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Anular/ })).not.toBeInTheDocument();
  });

  it("quien solo lee ve lo vendido pero no vende, cobra ni anula", async () => {
    flags.cashWrite = false;
    renderBooking();
    await screen.findByText(/2 × Bolas/);
    expect(screen.queryByRole("button", { name: /Vender/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Anular/ })).not.toBeInTheDocument();
  });

  it("«Vender en esta reserva» no sale en una reserva cancelada", async () => {
    renderBooking("CANCELLED");
    await screen.findByText(/2 × Bolas/);
    expect(screen.queryByRole("button", { name: /Vender en esta reserva/ })).not.toBeInTheDocument();
  });

  it("con el módulo apagado no pinta nada ni pide nada", () => {
    flags.on = false;
    renderBooking();
    expect(screen.queryByText("Tienda")).not.toBeInTheDocument();
    expect(shop.sales.list).not.toHaveBeenCalled();
  });
});

describe("tienda en la caja del día", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.on = true;
    flags.cashWrite = true;
    shop.sales.list.mockResolvedValue([sale()]);
    shop.products.list.mockResolvedValue([]);
  });

  it("pide las ventas del día y ofrece «Vender»", async () => {
    wrap(<ShopDaySales clubId="c1" date="2026-11-20" />);
    expect(await screen.findByText(/2 × Bolas/)).toBeInTheDocument();
    expect(shop.sales.list).toHaveBeenCalledWith("c1", { date: "2026-11-20" });
    fireEvent.click(screen.getByRole("button", { name: /Vender/ }));
    expect(await screen.findByRole("dialog", { name: "Vender" })).toBeInTheDocument();
  });

  it("un día sin ventas lo dice", async () => {
    shop.sales.list.mockResolvedValue([]);
    wrap(<ShopDaySales clubId="c1" date="2026-11-20" />);
    expect(await screen.findByText("No se ha vendido nada este día.")).toBeInTheDocument();
  });

  it("sin permiso de cobro o con el módulo apagado no sale ni «Vender»", () => {
    flags.cashWrite = false;
    const { container, rerender } = wrap(<><ShopDaySales clubId="c1" date="2026-11-20" /><ShopSellButton clubId="c1" /></>);
    expect(container).toBeEmptyDOMElement();
    flags.cashWrite = true;
    flags.on = false;
    rerender(<QueryClientProvider client={new QueryClient()}><ShopSellButton clubId="c1" /></QueryClientProvider>);
    expect(screen.queryByRole("button", { name: /Vender/ })).not.toBeInTheDocument();
  });
});
