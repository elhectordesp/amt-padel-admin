/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * «Cobrar pareja»: los dos jugadores marcados, método obligatorio, el que ya
 * pagó sale como pagado y fuera de la selección, y al guardar una sola llamada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/services/admin", () => ({
  adminService: { registrations: { payPair: vi.fn() } },
  registrationsQK: { list: (tournamentId: string) => ["registrations", tournamentId] },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import PayPairModal from "../../../components/admin/pay-pair-modal";
import { adminService } from "@/lib/services/admin";
import { toast } from "sonner";

const reg = (over: Record<string, unknown> = {}): any => ({
  id:           "reg-1",
  tournamentId: "t1",
  categoryId:   "cat-1",
  userId:       "u-ana",
  partnerId:    "u-bea",
  user:         { name: "Ana López" },
  partner:      { name: "Bea Ruiz" },
  category:     { gender: "F", level: "3a", price: 30 },
  status:       "PENDING",
  paid:         false,
  partnerPayment: { paid: false },
  createdAt:    "2026-11-01T10:00:00Z",
  ...over,
});

function renderModal(registration: any) {
  const onClose = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PayPairModal registration={registration} tournamentId="t1" onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

describe("PayPairModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enseña el precio, marca a los dos y no guarda sin método", () => {
    renderModal(reg());

    expect(screen.getByText("30 €")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Ana López/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Bea Ruiz/ })).toBeChecked();
    expect(screen.getByRole("button", { name: /Cobrar y confirmar/ })).toBeDisabled();
  });

  it("cobra a los dos con el método elegido en una sola llamada", async () => {
    vi.mocked(adminService.registrations.payPair).mockResolvedValue({ registrationId: "reg-1", confirmed: true, status: "CONFIRMED" });
    const onClose = renderModal(reg());

    fireEvent.click(screen.getByRole("button", { name: "Efectivo" }));
    fireEvent.click(screen.getByRole("button", { name: /Cobrar y confirmar/ }));

    await waitFor(() => expect(adminService.registrations.payPair).toHaveBeenCalledWith("reg-1", {
      players: ["titular", "partner"], paymentMethod: "CASH", paidAmountCents: 1500, titularId: "u-ana", partnerId: "u-bea",
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Cobrado y pareja confirmada");
  });

  it("el que ya pagó sale como pagado y fuera de la selección; se puede desmarcar al otro", async () => {
    vi.mocked(adminService.registrations.payPair).mockResolvedValue({ registrationId: "reg-1", confirmed: true, status: "CONFIRMED" });
    renderModal(reg({ paid: true }));

    expect(screen.getByText("Pagado")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Ana López/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /Ana López/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Tarjeta" }));
    fireEvent.click(screen.getByRole("button", { name: /Cobrar y confirmar/ }));
    await waitFor(() => expect(adminService.registrations.payPair).toHaveBeenCalledWith("reg-1", expect.objectContaining({
      players: ["partner"], paymentMethod: "CARD",
    })));
  });

  it("el importe por jugador empieza en la mitad del precio y se puede cambiar", async () => {
    vi.mocked(adminService.registrations.payPair).mockResolvedValue({ registrationId: "reg-1", confirmed: true, status: "CONFIRMED" });
    renderModal(reg());

    const amount = screen.getByLabelText("Importe por jugador");
    expect(amount).toHaveValue("15,00");
    fireEvent.click(screen.getByRole("button", { name: "Bizum" }));
    fireEvent.change(amount, { target: { value: "12,50" } });
    fireEvent.click(screen.getByRole("button", { name: /Cobrar y confirmar/ }));
    await waitFor(() => expect(adminService.registrations.payPair).toHaveBeenCalledWith("reg-1", expect.objectContaining({
      paymentMethod: "BIZUM", paidAmountCents: 1250,
    })));
  });

  it("con un importe que no es un número, no se puede cobrar", () => {
    renderModal(reg());
    fireEvent.click(screen.getByRole("button", { name: "Efectivo" }));
    fireEvent.change(screen.getByLabelText("Importe por jugador"), { target: { value: "abc" } });
    expect(screen.getByRole("button", { name: /Cobrar y confirmar/ })).toBeDisabled();
  });

  it("en la lista de espera lo dice y no promete confirmar", () => {
    renderModal(reg({ status: "WAITLIST" }));

    expect(screen.getByText(/se cobra, pero no se confirma/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeInTheDocument();
  });
});
