/**
 * «Vender» (módulo Cuentas, M4): los productos activos en botones, la cantidad,
 * el aviso de stock, y las tres formas de cobrar (método, a deber, pendiente).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const shop = vi.hoisted(() => ({ products: { list: vi.fn() }, sales: { sell: vi.fn() } }));
vi.mock("@/lib/services/shop", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/shop")>()),
  shopService: shop,
}));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
vi.mock("@/lib/services/club-customers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-customers")>()),
  clubCustomersService: { list: vi.fn().mockResolvedValue({ items: [], total: 0 }), create: vi.fn() },
}));

import { ShopSellDialog } from "@/components/admin/shop-sell-dialog";
import { toast } from "sonner";
import type { ShopProduct, ShopSale } from "@/lib/services/shop";

const product = (patch: Partial<ShopProduct> = {}): ShopProduct => ({
  id: "p1", name: "Bolas", priceCents: 600, costCents: null, unitsPerBox: 24, minStock: null,
  active: true, displayOrder: 0, stock: 48, lowStock: false, ...patch,
});
const PRODUCTS = [
  product(),
  product({ id: "p2", name: "Grips", priceCents: 300, unitsPerBox: 60, stock: 70 }),
  product({ id: "p3", name: "Viejo", active: false }),
];
const SALE = { id: "s1", productName: "Bolas", quantity: 1, amountCents: 600 } as ShopSale;

const onClose = vi.fn();
const onDone = vi.fn();

function renderDialog(bookingId?: string, bookingHasCustomer = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ShopSellDialog clubId="c1" bookingId={bookingId} bookingHasCustomer={bookingHasCustomer} onDone={onDone} onClose={onClose} />
    </QueryClientProvider>,
  );
}

const pickProduct = async (name: string) => fireEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
const way = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const submit = (name: RegExp) => screen.getByRole("button", { name });

describe("ShopSellDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shop.products.list.mockResolvedValue(PRODUCTS);
    shop.sales.sell.mockResolvedValue({ sale: SALE, stockAfter: 47 });
    accounts.partners.list.mockResolvedValue([
      { id: "m1", name: "Marta", active: true },
      { id: "m2", name: "Baja", active: false },
    ]);
  });

  it("solo ofrece los productos activos, con su precio", async () => {
    renderDialog();
    expect(await screen.findByRole("button", { name: /Bolas/ })).toHaveTextContent("6,00");
    expect(screen.getByRole("button", { name: /Grips/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Viejo/ })).not.toBeInTheDocument();
  });

  it("sin producto elegido no se puede cobrar", async () => {
    renderDialog();
    await screen.findByRole("button", { name: /Bolas/ });
    expect(submit(/Cobrar/)).toBeDisabled();
  });

  it("vende cobrado en efectivo: la cantidad se cambia con + y −, copia producto y cantidad y avisa de lo que queda", async () => {
    renderDialog();
    await pickProduct("Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Una más" }));
    fireEvent.click(screen.getByRole("button", { name: "Una más" }));
    fireEvent.click(screen.getByRole("button", { name: "Una menos" }));
    expect(screen.getByLabelText("Cantidad")).toHaveTextContent("2");
    way("Efectivo");
    fireEvent.click(submit(/Cobrar/));

    await waitFor(() => expect(shop.sales.sell).toHaveBeenCalledWith("c1", {
      productId: "p1", quantity: 2, payment: { method: "CASH" },
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onDone).toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("avisa antes de vender si queda poco o no queda, y deja vender igual", async () => {
    shop.products.list.mockResolvedValue([product({ stock: 25, lowStock: false }), product({ id: "p2", name: "Grips", stock: 0, lowStock: true })]);
    renderDialog();
    await pickProduct("Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Una más" }));
    expect(screen.getByRole("status")).toHaveTextContent("Stock bajo: quedarán 23");

    await pickProduct("Grips");
    expect(screen.getByRole("status")).toHaveTextContent("Sin stock");
    way("Tarjeta");
    expect(submit(/Cobrar/)).toBeEnabled();
  });

  it("tras vender sin stock, el toast avisa de lo que dice el back", async () => {
    shop.sales.sell.mockResolvedValue({ sale: SALE, stockAfter: -1 });
    renderDialog();
    await pickProduct("Bolas");
    way("Efectivo");
    fireEvent.click(submit(/Cobrar/));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("sin stock")));
  });

  it("Bizum: no deja cobrar hasta elegir a qué móvil llegó (solo socios activos) y manda el socio o null para «Club»", async () => {
    renderDialog();
    await pickProduct("Grips");
    way("Bizum");
    expect(submit(/Cobrar/)).toBeDisabled();
    expect(await screen.findByRole("button", { name: "Marta" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baja" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Club" }));
    fireEvent.click(submit(/Cobrar/));

    await waitFor(() => expect(shop.sales.sell).toHaveBeenCalledWith("c1", {
      productId: "p2", quantity: 1, payment: { method: "BIZUM", bizumPartnerId: null },
    }));
  });

  it("a deber sin reserva pide quién debe; con un nombre, lo manda", async () => {
    renderDialog();
    await pickProduct("Bolas");
    way("Debe");
    expect(submit(/Dejar a deber/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Pendiente" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre de quien compra"), { target: { value: " Pablo " } });
    fireEvent.click(submit(/Dejar a deber/));

    await waitFor(() => expect(shop.sales.sell).toHaveBeenCalledWith("c1", {
      productId: "p1", quantity: 1, label: "Pablo", payment: { debt: true },
    }));
  });

  it("el aviso de venta hecha enseña el importe que devolvió el servidor, no el calculado", async () => {
    shop.sales.sell.mockResolvedValue({ sale: { ...SALE, quantity: 2, amountCents: 1150 }, stockAfter: 47 });
    renderDialog();
    await pickProduct("Bolas");
    way("Efectivo");
    fireEvent.click(submit(/Cobrar/));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vendido: 2 × Bolas · 11,50 €"));
  });

  it("dentro de una reserva sin cliente del club, «Debe» pide elegir a alguien y no promete «quien reservó»", async () => {
    renderDialog("b9", false);
    await pickProduct("Bolas");
    way("Debe");
    expect(submit(/Dejar a deber/)).toBeDisabled();
    expect(screen.queryByText(/debe quien reservó/)).not.toBeInTheDocument();
    expect(screen.getByText(/Elige quién debe/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre de quien compra"), { target: { value: "Pablo" } });
    expect(submit(/Dejar a deber/)).toBeEnabled();
  });

  it("dentro de una reserva: lleva su id, a deber no pide persona y existe «Pendiente»", async () => {
    renderDialog("b9", true);
    await pickProduct("Bolas");
    way("Debe");
    expect(screen.getByText(/debe quien reservó/)).toBeInTheDocument();
    expect(submit(/Dejar a deber/)).toBeEnabled();
    way("Pendiente");
    fireEvent.click(submit(/Dejar pendiente/));

    await waitFor(() => expect(shop.sales.sell).toHaveBeenCalledWith("c1", {
      productId: "p1", quantity: 1, bookingId: "b9", payment: { pending: true },
    }));
  });

  it("si el back rechaza, el diálogo sigue abierto y muestra el error", async () => {
    shop.sales.sell.mockRejectedValue(Object.assign(new Error("El producto está desactivado"), { code: "ACCOUNTS_SHOP_INVALID" }));
    renderDialog();
    await pickProduct("Bolas");
    way("Efectivo");
    fireEvent.click(submit(/Cobrar/));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El producto está desactivado"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sin productos activos explica dónde se dan de alta", async () => {
    shop.products.list.mockResolvedValue([product({ active: false })]);
    renderDialog();
    expect(await screen.findByText(/No hay productos activos/)).toBeInTheDocument();
  });
});
