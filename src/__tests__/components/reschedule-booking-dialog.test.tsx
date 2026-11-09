/**
 * «Cambiar hora o pista» de una reserva:
 * - enseña el precio del hueco elegido frente al actual antes de guardar;
 * - guarda la pista, la hora y la duración elegidas;
 * - si estaba pagada, avisa de que el precio se mantiene.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const svc = vi.hoisted(() => ({
  bookings: { rescheduleOptions: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import { RescheduleBookingDialog } from "@/components/admin/reschedule-booking-dialog";
import type { Booking, RescheduleSlot } from "@/types/bookings";

const NOW_SLOT = "2026-11-12T17:00:00.000Z"; // 18:00 en Madrid
const NEW_SLOT = "2026-11-12T19:00:00.000Z"; // 20:00

const booking = {
  id: "b1",
  courtId: "p1",
  startsAt: NOW_SLOT,
  durationMinutes: 60,
} as Booking;

const slot = (courtId: string, startsAt: string, local: string, priceCents: number): RescheduleSlot => ({
  courtId,
  courtName: courtId === "p1" ? "Pista 1" : "Pista 2",
  startsAt,
  endsAt: startsAt,
  startsAtLocal: local,
  durationMinutes: 60,
  priceCents,
  differenceCents: priceCents - 2000,
});

function renderDialog(priceKept = false) {
  svc.bookings.rescheduleOptions.mockResolvedValue({
    currentPriceCents: 2000,
    priceKept,
    durations: [60, 90],
    slots: [slot("p1", NOW_SLOT, "18:00", 2000), slot("p1", NEW_SLOT, "20:00", 2600)],
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <RescheduleBookingDialog booking={booking} timeZone="Europe/Madrid" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("RescheduleBookingDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enseña el precio nuevo y guarda el hueco elegido", async () => {
    svc.bookings.update.mockResolvedValue({
      booking,
      price: { previousCents: 2000, newCents: 2600, differenceCents: 600, kept: false },
    });
    const { onClose } = renderDialog();

    const hour = await screen.findByLabelText(/Hora de inicio/);
    // Parte de la hora actual: nada que guardar
    expect(screen.getByRole("button", { name: /Guardar cambio/ })).toBeDisabled();
    fireEvent.change(hour, { target: { value: NEW_SLOT } });

    expect(await screen.findByText(/Precio en este hueco/)).toHaveTextContent("26,00");
    fireEvent.click(screen.getByRole("button", { name: /Guardar cambio/ }));

    await waitFor(() =>
      expect(svc.bookings.update).toHaveBeenCalledWith("b1", {
        courtId: "p1",
        startsAt: NEW_SLOT,
        durationMinutes: 60,
      }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Reserva cambiada — jugadores avisados");
  });

  it("pagada: avisa de que el precio se mantiene", async () => {
    renderDialog(true);
    fireEvent.change(await screen.findByLabelText(/Hora de inicio/), { target: { value: NEW_SLOT } });

    expect(await screen.findByText(/Está pagada: se queda en/)).toBeInTheDocument();
  });
});
