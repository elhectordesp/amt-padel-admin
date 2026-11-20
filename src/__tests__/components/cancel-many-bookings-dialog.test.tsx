/**
 * «Cancelar seleccionadas»: si alguna de las marcadas está cobrada en dinero,
 * deja devolver a cada una todo lo cobrado; si ninguna lo está, no hay nada
 * que devolver y no pregunta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const cancelManyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/bookings", () => ({
  bookingsService: { bookings: { cancelMany: cancelManyMock } },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { CancelManyBookingsDialog } from "@/components/admin/cancel-many-bookings-dialog";

function renderDialog(refundable?: { count: number; cents: number }) {
  const onDone = vi.fn();
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CancelManyBookingsDialog ids={["a", "b", "c"]} refundable={refundable} onDone={onDone} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
  return { onDone };
}

describe("CancelManyBookingsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelManyMock.mockResolvedValue({ cancelled: ["a", "b", "c"], failed: [] });
  });

  it("con cobradas entre las marcadas, ofrece devolver lo cobrado y dice cuántas y cuánto", () => {
    renderDialog({ count: 2, cents: 3600 });
    const box = screen.getByRole("checkbox", { name: /Devolver lo cobrado/ });
    expect(box).not.toBeChecked();
    expect(box.closest("label")).toHaveTextContent("2 reservas cobradas, 36,00 € en total");
  });

  it("sin marcar la casilla, cancela sin devolver", async () => {
    renderDialog({ count: 1, cents: 1800 });
    fireEvent.click(screen.getByRole("button", { name: /Sí, cancelar 3 reservas/ }));
    await waitFor(() => expect(cancelManyMock).toHaveBeenCalledWith(["a", "b", "c"], undefined, false));
  });

  it("con la casilla marcada, lo manda", async () => {
    renderDialog({ count: 1, cents: 1800 });
    fireEvent.click(screen.getByRole("checkbox", { name: /Devolver lo cobrado/ }));
    fireEvent.change(screen.getByLabelText("Motivo de la cancelación"), { target: { value: "Lluvia" } });
    fireEvent.click(screen.getByRole("button", { name: /Sí, cancelar 3 reservas/ }));
    await waitFor(() => expect(cancelManyMock).toHaveBeenCalledWith(["a", "b", "c"], "Lluvia", true));
  });

  it.each([
    ["ninguna cobrada", { count: 0, cents: 0 }],
    ["sin dato", undefined],
  ])("%s: no pregunta por devoluciones", (_label, refundable) => {
    renderDialog(refundable);
    expect(screen.queryByRole("checkbox", { name: /Devolver lo cobrado/ })).not.toBeInTheDocument();
  });
});
