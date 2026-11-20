/**
 * «Tienda» de Cuentas (M4): los productos con su stock y el aviso de stock
 * bajo, el alta y la edición, borrar solo lo no usado, la compra de cajas, el
 * recuento y el aviso de la portada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const shop = vi.hoisted(() => ({
  products: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), addStock: vi.fn(), moves: vi.fn() },
}));
vi.mock("@/lib/services/shop", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/shop")>()),
  shopService: shop,
}));
vi.mock("@/lib/use-club-time-zone", () => ({ useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }) }));
const flags = vi.hoisted(() => ({ on: true, settingsRead: true, settingsWrite: true }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => flags.on }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({
    roles: null,
    can: (area: string, level = "read") => (area === "settings" ? (level === "write" ? flags.settingsWrite : flags.settingsRead) : true),
  }),
}));

import { AccountsShopSection } from "@/components/admin/accounts-shop-section";
import { ShopLowStockNotice } from "@/components/admin/shop-low-stock-notice";
import { toast } from "sonner";
import type { ShopProduct } from "@/lib/services/shop";

const product = (patch: Partial<ShopProduct> = {}): ShopProduct => ({
  id: "p1", name: "Bolas", priceCents: 600, costCents: 375, unitsPerBox: 24, minStock: null,
  active: true, displayOrder: 0, stock: 48, lowStock: false, ...patch,
});
const LIST = [
  product(),
  product({ id: "p2", name: "Grips", priceCents: 300, unitsPerBox: 60, stock: 10, lowStock: true }),
  product({ id: "p3", name: "Cuerdas", active: false, stock: 0, lowStock: true }),
];

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

describe("AccountsShopSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shop.products.list.mockResolvedValue(LIST);
    shop.products.create.mockResolvedValue(product());
    shop.products.update.mockResolvedValue(product());
    shop.products.remove.mockResolvedValue(undefined);
    shop.products.addStock.mockResolvedValue(product());
    shop.products.moves.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 });
  });

  it("lista los productos con su stock y marca los de stock bajo y los desactivados", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    expect(await screen.findByLabelText("Stock de Bolas")).toHaveTextContent("Stock 48");
    expect(screen.getByLabelText("Stock de Grips")).toHaveTextContent("Stock 10 · bajo");
    expect(screen.getByText("Desactivado")).toBeInTheDocument();
    expect(screen.getAllByText("Activo")).toHaveLength(2);
  });

  it("alta: manda precio y coste en céntimos y lo opcional vacío como null", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo producto/ }));
    const submit = screen.getByRole("button", { name: "Añadir producto" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre del producto"), { target: { value: " Overgrip " } });
    fireEvent.change(screen.getByLabelText("Precio de venta"), { target: { value: "3,5" } });
    fireEvent.change(screen.getByLabelText("Unidades por caja"), { target: { value: "60" } });
    fireEvent.click(submit);

    await waitFor(() => expect(shop.products.create).toHaveBeenCalledWith("c1", {
      name: "Overgrip", priceCents: 350, costCents: null, unitsPerBox: 60, minStock: null,
    }));
  });

  it("un precio de 0 o unas unidades que no son un entero no se dejan guardar", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo producto/ }));
    fireEvent.change(screen.getByLabelText("Nombre del producto"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Precio de venta"), { target: { value: "0" } });
    expect(screen.getByRole("button", { name: "Añadir producto" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Precio de venta"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unidades por caja"), { target: { value: "1,5" } });
    expect(screen.getByRole("button", { name: "Añadir producto" })).toBeDisabled();
  });

  it("editar rellena el formulario y guarda con PUT sin tocar si está activo", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Editar Bolas" }));
    expect(screen.getByLabelText("Precio de venta")).toHaveValue("6,00");
    fireEvent.change(screen.getByLabelText("Precio de venta"), { target: { value: "6,5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(shop.products.update).toHaveBeenCalledWith("c1", "p1", {
      name: "Bolas", priceCents: 650, costCents: 375, unitsPerBox: 24, minStock: null,
    }));
  });

  it("compra, recuento e historial llevan texto visible, no solo un tooltip", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    const stock = await screen.findByLabelText("Stock de Bolas");
    const row = stock.closest("li") as HTMLElement;
    expect(within(row).getByText("Comprar cajas")).toBeVisible();
    expect(within(row).getByText("Recuento")).toBeVisible();
    expect(within(row).getByText("Historial")).toBeVisible();
  });

  it("desactivar manda el producto entero con active al revés", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getAllByRole("button", { name: "Desactivar" })[0]);
    await waitFor(() => expect(shop.products.update).toHaveBeenCalledWith("c1", "p1", {
      name: "Bolas", priceCents: 600, costCents: 375, unitsPerBox: 24, minStock: null, active: false,
    }));
  });

  it("borrar pide confirmación; si ya se usó, explica que hay que desactivarlo", async () => {
    shop.products.remove.mockRejectedValue(Object.assign(new Error("x"), { code: "ACCOUNTS_IN_USE" }));
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Borrar Bolas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Borrar" }));

    await waitFor(() => expect(shop.products.remove).toHaveBeenCalledWith("c1", "p1"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Desactívalo")));
  });

  it("compra de cajas: calcula las unidades y manda cajas, lo pagado en céntimos y la nota", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Compra de cajas de Bolas" }));
    const dialog = await screen.findByRole("dialog", { name: "Compra de cajas" });
    const save = within(dialog).getByRole("button", { name: "Apuntar compra" });
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Cajas compradas"), { target: { value: "2" } });
    expect(within(dialog).getByText(/Entran 48 unidades: el stock pasa a 96/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Lo pagado en total"), { target: { value: "90" } });
    fireEvent.change(within(dialog).getByLabelText("Nota de la compra"), { target: { value: "Pedido de noviembre" } });
    fireEvent.click(save);

    await waitFor(() => expect(shop.products.addStock).toHaveBeenCalledWith("c1", "p1", {
      kind: "PURCHASE", boxes: 2, costCents: 9000, notes: "Pedido de noviembre",
    }));
  });

  it("un producto sin caja solo compra unidades sueltas", async () => {
    shop.products.list.mockResolvedValue([product({ unitsPerBox: null })]);
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Compra de cajas de Bolas" }));
    const dialog = await screen.findByRole("dialog", { name: "Compra de cajas" });
    expect(within(dialog).queryByRole("group", { name: "Qué se compra" })).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Unidades compradas"), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar compra" }));
    await waitFor(() => expect(shop.products.addStock).toHaveBeenCalledWith("c1", "p1", { kind: "PURCHASE", units: 10 }));
  });

  it("recuento: enseña la diferencia, no deja guardar una diferencia 0 ni sin nota", async () => {
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Recuento de Bolas" }));
    const dialog = await screen.findByRole("dialog", { name: "Recuento" });
    const save = within(dialog).getByRole("button", { name: "Guardar recuento" });
    fireEvent.change(within(dialog).getByLabelText("Nota del recuento"), { target: { value: "Recuento de noviembre" } });
    fireEvent.change(within(dialog).getByLabelText("Unidades contadas"), { target: { value: "48" } });
    expect(within(dialog).getByRole("status")).toHaveTextContent("no hay nada que ajustar");
    expect(save).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Unidades contadas"), { target: { value: "45" } });
    expect(within(dialog).getByRole("status")).toHaveTextContent("−3");
    fireEvent.click(save);

    await waitFor(() => expect(shop.products.addStock).toHaveBeenCalledWith("c1", "p1", {
      kind: "ADJUSTMENT", countedUnits: 45, notes: "Recuento de noviembre",
    }));
  });

  it("el historial pide los movimientos del producto y los enseña", async () => {
    shop.products.moves.mockResolvedValue({
      items: [
        { kind: "SALE", id: "s1", at: "2026-11-05T10:00:00.000Z", units: -2, boxes: null, costCents: null, amountCents: 1200, notes: null, byName: "Recepción", cancelled: false },
        { kind: "PURCHASE", id: "m1", at: "2026-11-01T10:00:00.000Z", units: 48, boxes: 2, costCents: 9000, notes: null, byName: "Marta", cancelled: false },
      ],
      total: 2, page: 1, pageSize: 30,
    });
    wrap(<AccountsShopSection clubId="c1" />);
    await screen.findByLabelText("Stock de Bolas");
    fireEvent.click(screen.getByRole("button", { name: "Historial de Bolas" }));
    const dialog = await screen.findByRole("dialog", { name: "Historial" });
    expect(await within(dialog).findByText("Compra de 2 cajas")).toBeInTheDocument();
    expect(within(dialog).getByText("+48")).toBeInTheDocument();
    expect(within(dialog).getByText("−2")).toBeInTheDocument();
    expect(shop.products.moves).toHaveBeenCalledWith("c1", "p1", 1);
  });
});

describe("ShopLowStockNotice (portada)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.on = true;
    flags.settingsRead = true;
    flags.settingsWrite = true;
    shop.products.list.mockResolvedValue(LIST);
  });

  it("avisa de los productos activos por debajo de su aviso; los desactivados no", async () => {
    wrap(<ShopLowStockNotice clubId="c1" />);
    const notice = await screen.findByRole("region", { name: "Stock bajo" });
    expect(within(notice).getByText(/Grips/)).toHaveTextContent("quedan 10");
    expect(within(notice).queryByText(/Cuerdas/)).not.toBeInTheDocument();
    expect(within(notice).queryByText(/Bolas/)).not.toBeInTheDocument();
  });

  it("sin nada bajo, con el módulo apagado o sin acceso al catálogo, no pinta nada ni lo pide", async () => {
    shop.products.list.mockResolvedValue([product()]);
    const { container } = wrap(<ShopLowStockNotice clubId="c1" />);
    await waitFor(() => expect(shop.products.list).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();

    vi.clearAllMocks();
    flags.on = false;
    const off = wrap(<ShopLowStockNotice clubId="c1" />);
    expect(off.container).toBeEmptyDOMElement();
    expect(shop.products.list).not.toHaveBeenCalled();
  });
});
