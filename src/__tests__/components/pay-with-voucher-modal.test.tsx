/**
 * «Pagar con bono» al cobrar una reserva (B14): solo salen los bonos que el
 * back da por válidos para esa reserva (con saldo, sin cancelar y vigentes a
 * su fecha); uno pendiente de cobro también vale; el error del back se enseña.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const svc = vi.hoisted(() => ({ booking: { usable: vi.fn(), use: vi.fn() } }));
vi.mock("@/lib/services/club-vouchers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-vouchers")>()),
  clubVouchersService: svc,
}));

import { PayWithVoucherModal } from "@/components/admin/pay-with-voucher-modal";
import { toast } from "sonner";

const base = {
  clubId: "c1", typeId: "t1", clubCustomerId: "cc1", sessions: 10, priceCents: 12000,
  paymentMethod: "CASH", paidAt: "2026-11-18T09:00:00.000Z", cancelledAt: null, refundAmountCents: null,
  cancelNotes: null, soldById: "u1", createdAt: "2026-11-18T09:00:00.000Z", paid: true,
  usedSessions: 3, remainingSessions: 7, status: "ACTIVE", uses: [],
};
const V1 = { ...base, id: "v1", name: "Bono 10", expiresAt: "2026-12-18T22:59:59.999Z" };
const V2 = { ...base, id: "v2", name: "Bono 5", sessions: 5, remainingSessions: 1, expiresAt: null, paid: false, paymentMethod: null, paidAt: null };

const onDone = vi.fn();
const onClose = vi.fn();

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PayWithVoucherModal
        clubId="c1"
        bookingId="b1"
        subtitle="AMT-1 · Pista 1"
        timeZone="Europe/Madrid"
        onDone={onDone}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
}

describe("PayWithVoucherModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.booking.usable.mockResolvedValue([V1, V2]);
    svc.booking.use.mockResolvedValue({ id: "b1" });
  });

  it("pide los bonos de ESA reserva y enseña saldo, caducidad y si falta cobrarlos", async () => {
    renderModal();
    expect(await screen.findByText("Bono 10")).toBeInTheDocument();
    expect(svc.booking.usable).toHaveBeenCalledWith("c1", "b1");
    expect(screen.getByText(/7 de 10 sesiones · Caduca el 18\/12\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/1 de 5 sesiones · Sin caducidad · pendiente de cobro/)).toBeInTheDocument();
  });

  it("sin elegir bono no se puede pagar; al elegir uno, descuenta de ese y avisa", async () => {
    renderModal();
    await screen.findByText("Bono 5");
    const pay = screen.getByRole("button", { name: /Pagar con bono/ });
    expect(pay).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Bono 5/));
    fireEvent.click(pay);

    await waitFor(() => expect(svc.booking.use).toHaveBeenCalledWith("c1", "b1", "v2"));
    expect(toast.success).toHaveBeenCalledWith("Reserva pagada con bono");
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sin ningún bono válido, lo dice y no deja pagar", async () => {
    svc.booking.usable.mockResolvedValue([]);
    renderModal();
    expect(await screen.findByText(/no tiene ningún bono con sesiones/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pagar con bono/ })).toBeDisabled();
  });

  it("si el back lo rechaza (agotado, caducado...), enseña su mensaje y no cierra", async () => {
    svc.booking.use.mockRejectedValue({ response: { data: { message: "Al bono no le quedan sesiones" } } });
    renderModal();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByLabelText(/Bono 10/));
    fireEvent.click(screen.getByRole("button", { name: /Pagar con bono/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Al bono no le quedan sesiones"));
    expect(onClose).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
