/**
 * Bonos en la ficha de un cliente (B14): ver su saldo, su caducidad y sus
 * usos; vender uno del catálogo (cobrado o pendiente de cobro); marcarlo
 * cobrado o quitarle el cobro; y cancelarlo con una devolución que no pase de
 * lo que costó. Sin acceso de escritura a la caja, solo se lee.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const accessMock = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: accessMock.can }) }));

const svc = vi.hoisted(() => ({
  types: { list: vi.fn() },
  customer: { list: vi.fn(), sell: vi.fn() },
  setPayment: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("@/lib/services/club-vouchers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-vouchers")>()),
  clubVouchersService: svc,
}));

import { CustomerVouchersSection } from "@/components/admin/customer-vouchers-section";
import { toast } from "sonner";

const VOUCHER = {
  id: "v1", clubId: "c1", typeId: "t1", clubCustomerId: "cc1", name: "Bono 10", sessions: 10, priceCents: 12000,
  paymentMethod: null, paidAt: null, expiresAt: "2026-12-18T22:59:59.999Z", cancelledAt: null,
  refundAmountCents: null, cancelNotes: null, soldById: "u1", createdAt: "2026-11-18T09:00:00.000Z",
  paid: false, usedSessions: 3, remainingSessions: 7, status: "ACTIVE",
  uses: [{ id: "u-1", bookingId: "b1", usedAt: "2026-11-20T10:00:00.000Z", startsAt: "2026-11-25T17:00:00.000Z", courtName: "Pista 2" }],
};
const PAID = { ...VOUCHER, paymentMethod: "CARD", paid: true, paidAt: "2026-11-18T09:05:00.000Z" };

const TYPES = [
  { id: "t1", clubId: "c1", name: "Bono 10", sessions: 10, priceCents: 12000, validDays: 30, active: true },
  { id: "t2", clubId: "c1", name: "Bono antiguo", sessions: 5, priceCents: 7000, validDays: null, active: false },
];

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CustomerVouchersSection clubId="c1" customerId="cc1" timeZone="Europe/Madrid" />
    </QueryClientProvider>,
  );
}

describe("CustomerVouchersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.can.mockReturnValue(true);
    svc.customer.list.mockResolvedValue([VOUCHER]);
    svc.types.list.mockResolvedValue(TYPES);
    svc.customer.sell.mockResolvedValue(VOUCHER);
    svc.setPayment.mockResolvedValue(PAID);
    svc.cancel.mockResolvedValue({ ...PAID, status: "CANCELLED" });
  });

  it("enseña el bono con su saldo, su estado, su cobro, su caducidad en hora del club y sus usos", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("7 de 10 sesiones")).toBeInTheDocument();
    const detail = screen.getByText(/Vendido el 18\/11\/2026/);
    expect(detail).toHaveTextContent("120,00 €");
    expect(detail).toHaveTextContent("Pendiente de cobro");
    // 22:59:59.999Z del 18-12 es el 18-12 a las 23:59 en Madrid
    expect(detail).toHaveTextContent("Caduca el 18/12/2026");
    expect(screen.getByRole("link", { name: /Pista 2 · 25\/11\/2026, 18:00/ })).toHaveAttribute(
      "href",
      "/mi-club/reservas/bookings/b1",
    );
  });

  it("sin bonos, lo dice", async () => {
    svc.customer.list.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("No tiene bonos.")).toBeInTheDocument();
  });

  describe("vender", () => {
    async function openSell() {
      renderSection();
      await screen.findByText("Bono 10");
      fireEvent.click(screen.getByRole("button", { name: /Vender bono/ }));
      return within(await screen.findByRole("dialog", { name: "Vender bono" }));
    }

    it("ofrece solo los tipos activos y, sin cobrarlo, lo vende pendiente de cobro", async () => {
      const dialog = await openSell();
      expect(await dialog.findByText("Bono 10 · 10 sesiones · 120,00 €")).toBeInTheDocument();
      expect(dialog.queryByText(/Bono antiguo/)).not.toBeInTheDocument();
      // Sin elegir bono, no se puede vender
      expect(dialog.getByRole("button", { name: "Vender bono" })).toBeDisabled();

      fireEvent.click(dialog.getByRole("radio"));
      fireEvent.click(dialog.getByRole("button", { name: "Vender bono" }));

      await waitFor(() => expect(svc.customer.sell).toHaveBeenCalledWith("c1", "cc1", { typeId: "t1" }));
      expect(toast.success).toHaveBeenCalledWith("Bono vendido, pendiente de cobro");
    });

    it("cobrado en el momento: pide el método y lo manda", async () => {
      const dialog = await openSell();
      fireEvent.click(await dialog.findByRole("radio"));
      fireEvent.click(dialog.getByLabelText("Cobrarlo ahora"));
      // Cobrarlo exige método
      expect(dialog.getByRole("button", { name: "Vender bono" })).toBeDisabled();
      fireEvent.click(dialog.getByRole("button", { name: "Efectivo" }));
      fireEvent.click(dialog.getByRole("button", { name: "Vender bono" }));

      await waitFor(() =>
        expect(svc.customer.sell).toHaveBeenCalledWith("c1", "cc1", { typeId: "t1", method: "CASH" }),
      );
    });

    it("sin tipos activos en el catálogo, manda a crearlos", async () => {
      svc.types.list.mockResolvedValue([TYPES[1]]);
      const dialog = await openSell();
      expect(await dialog.findByText(/No hay bonos en el catálogo/)).toBeInTheDocument();
      expect(dialog.getByRole("button", { name: "Vender bono" })).toBeDisabled();
    });

    it("si el back rechaza la venta, enseña su mensaje y no cierra", async () => {
      svc.customer.sell.mockRejectedValue({ response: { data: { message: "Este tipo de bono está dado de baja" } } });
      const dialog = await openSell();
      fireEvent.click(await dialog.findByRole("radio"));
      fireEvent.click(dialog.getByRole("button", { name: "Vender bono" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Este tipo de bono está dado de baja"));
      expect(screen.getByRole("dialog", { name: "Vender bono" })).toBeInTheDocument();
    });
  });

  describe("cobrar", () => {
    it("«Marcar cobrado» manda el método elegido", async () => {
      renderSection();
      await screen.findByText("Bono 10");
      fireEvent.click(screen.getByRole("button", { name: "Marcar cobrado" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Cobrar bono" }));
      expect(dialog.getByRole("button", { name: "Marcar cobrado" })).toBeDisabled();
      fireEvent.click(dialog.getByRole("button", { name: "Tarjeta" }));
      fireEvent.click(dialog.getByRole("button", { name: "Marcar cobrado" }));
      await waitFor(() => expect(svc.setPayment).toHaveBeenCalledWith("c1", "v1", "CARD"));
    });

    it("uno cobrado ofrece quitar el cobro (con confirmación) y lo manda como PENDING", async () => {
      svc.customer.list.mockResolvedValue([PAID]);
      renderSection();
      await screen.findByText("Bono 10");
      expect(screen.getByText(/Cobrado · Tarjeta/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Marcar cobrado" })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Quitar el cobro" }));
      const dialog = within(await screen.findByRole("dialog"));
      fireEvent.click(dialog.getByRole("button", { name: "Quitar el cobro" }));
      await waitFor(() => expect(svc.setPayment).toHaveBeenCalledWith("c1", "v1", "PENDING"));
    });
  });

  describe("cancelar y devolver", () => {
    async function openCancel(voucher: typeof PAID | typeof VOUCHER = PAID) {
      svc.customer.list.mockResolvedValue([voucher]);
      renderSection();
      await screen.findByText("Bono 10");
      fireEvent.click(screen.getByRole("button", { name: "Cancelar bono" }));
      return within(await screen.findByRole("dialog"));
    }

    // Fechas fijas lejos de hoy: lo gastado ya empezó (2020) o aún no ha empezado (2099)
    const PAST_USE = { id: "u-1", bookingId: "b1", usedAt: "2020-11-20T10:00:00.000Z", startsAt: "2020-11-25T17:00:00.000Z", courtName: "Pista 2" };
    const FUTURE_USE = { ...PAST_USE, id: "u-2", bookingId: "b2", startsAt: "2099-11-25T17:00:00.000Z" };

    it("propone devolver lo proporcional a las sesiones que quedan, avisa de que lo gastado se queda y manda el importe en céntimos", async () => {
      const dialog = await openCancel({ ...PAID, uses: [PAST_USE] });
      expect(dialog.getByText(/La sesión ya gastada se queda|Las 3 sesiones ya gastadas se quedan/)).toBeInTheDocument();
      const amount = dialog.getByLabelText("Importe devuelto (a mano)");
      // 7 de 10 sesiones sin gastar: 70 % de 120 €
      expect(amount).toHaveValue("84,00");

      fireEvent.change(amount, { target: { value: "60" } });
      fireEvent.change(dialog.getByLabelText("Notas de la cancelación"), { target: { value: "Se lesionó" } });
      fireEvent.click(dialog.getByRole("button", { name: "Cancelar bono" }));

      await waitFor(() =>
        expect(svc.cancel).toHaveBeenCalledWith("c1", "v1", { refundAmountCents: 6000, notes: "Se lesionó" }),
      );
    });

    it("las reservas que aún no han empezado vuelven al bono: el texto lo dice y la devolución las cuenta como sin gastar", async () => {
      const dialog = await openCancel({ ...PAID, usedSessions: 3, remainingSessions: 7, uses: [PAST_USE, PAST_USE, FUTURE_USE] });
      expect(dialog.getByText(/Las 2 sesiones ya gastadas se quedan/)).toBeInTheDocument();
      expect(dialog.getByText(/La reserva que aún no ha empezado vuelve al bono y queda pendiente de cobro/)).toBeInTheDocument();
      expect(dialog.getByText(/Las 8 sesiones sin gastar se pierden/)).toBeInTheDocument();
      // 7 sin gastar + 1 que vuelve = 8 de 10: 96 €
      expect(dialog.getByLabelText("Importe devuelto (a mano)")).toHaveValue("96,00");
    });

    it("una devolución mayor que el precio no se manda y dice por qué", async () => {
      const dialog = await openCancel();
      fireEvent.change(dialog.getByLabelText("Importe devuelto (a mano)"), { target: { value: "200" } });
      expect(dialog.getByText(/No se puede devolver más de lo que costó el bono \(120,00 €\)/)).toBeInTheDocument();
      fireEvent.click(dialog.getByRole("button", { name: "Cancelar bono" }));
      expect(svc.cancel).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it("sin importe, cancela sin devolución (no manda refundAmountCents)", async () => {
      const dialog = await openCancel();
      fireEvent.change(dialog.getByLabelText("Importe devuelto (a mano)"), { target: { value: "" } });
      fireEvent.click(dialog.getByRole("button", { name: "Cancelar bono" }));
      await waitFor(() => expect(svc.cancel).toHaveBeenCalledWith("c1", "v1", {}));
    });

    it("uno sin cobrar no ofrece devolver nada", async () => {
      const dialog = await openCancel(VOUCHER);
      expect(dialog.queryByLabelText("Importe devuelto (a mano)")).not.toBeInTheDocument();
      fireEvent.click(dialog.getByRole("button", { name: "Cancelar bono" }));
      await waitFor(() => expect(svc.cancel).toHaveBeenCalledWith("c1", "v1", {}));
    });
  });

  it("un bono cancelado no admite acciones y dice lo que se devolvió", async () => {
    svc.customer.list.mockResolvedValue([
      { ...PAID, status: "CANCELLED", cancelledAt: "2026-11-22T10:00:00.000Z", refundAmountCents: 6000 },
    ]);
    renderSection();
    await screen.findByText("Bono 10");
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
    expect(screen.getByText(/Cancelado el 22\/11\/2026 · devuelto 60,00 €/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar bono" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar el cobro" })).not.toBeInTheDocument();
  });

  it("un bono de clases privadas lo dice y enseña las clases en que se gastó (sin enlace de reserva)", async () => {
    svc.customer.list.mockResolvedValue([
      {
        ...PAID,
        name: "Bono 8 clases",
        kind: "PRIVATE_CLASS",
        uses: [
          { id: "u-1", bookingId: null, privateClassId: "pc1", usedAt: "2026-11-20T10:00:00.000Z", startsAt: "2026-11-25T17:00:00.000Z", courtName: "Pista 2" },
          { id: "u-2", bookingId: null, privateClassId: "pc2", usedAt: "2026-11-21T10:00:00.000Z", startsAt: "2026-11-26T17:00:00.000Z", courtName: null },
        ],
      },
    ]);
    renderSection();
    await screen.findByText("Bono 8 clases");
    expect(screen.getByText("Clases privadas")).toBeInTheDocument();
    expect(screen.getByText("Clases privadas pagadas con este bono (2)")).toBeInTheDocument();
    expect(screen.getByText("Clase privada · Pista 2 · 25/11/2026, 18:00")).toBeInTheDocument();
    // Si la clase se quedó sin pista, no se inventa una
    expect(screen.getByText("Clase privada · 26/11/2026, 18:00")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sin permiso de escritura en la caja, se lee pero no hay botones", async () => {
    accessMock.can.mockImplementation((_area: string, level = "read") => level === "read");
    renderSection();
    await screen.findByText("Bono 10");
    expect(screen.queryByRole("button", { name: /Vender bono/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar cobrado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar bono" })).not.toBeInTheDocument();
  });
});
