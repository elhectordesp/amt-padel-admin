/**
 * Alta de reservas desde el panel:
 * - el LSPA de un partido abierto es un entero de 40 o más, como pide el back
 *   (antes admitía decimales y el back lo rechazaba) (R3-5);
 * - la hora que llega del calendario solo vale si es un hueco libre;
 * - el club reserva para otros sin ocupar plaza (D14): 4 en dobles, 2 en individual.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const courtsList = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/admin", () => ({
  adminService: { courts: { list: courtsList }, players: { search: vi.fn() } },
}));

const svc = vi.hoisted(() => ({
  courtDurations: { list: vi.fn() },
  availability: vi.fn(),
  bookings: { create: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import { BookingCreateDialog, lspaRangeError } from "@/components/admin/booking-create-dialog";

const SLOT = "2026-11-02T17:00:00.000Z";

function renderDialog(initial = { courtId: "p1", date: "2026-11-02", startsAt: SLOT }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BookingCreateDialog open onClose={vi.fn()} clubId="c1" initial={initial} />
    </QueryClientProvider>,
  );
}

describe("lspaRangeError", () => {
  it("vacío vale; enteros de 40 o más; el mínimo no supera al máximo", () => {
    expect(lspaRangeError("", "")).toBeNull();
    expect(lspaRangeError("40", "")).toBeNull();
    expect(lspaRangeError("45", "60")).toBeNull();
    expect(lspaRangeError("45.5", "")).toMatch(/entero/);
    expect(lspaRangeError("", "39")).toMatch(/40 o más/);
    expect(lspaRangeError("60", "45")).toMatch(/mayor que el máximo/);
  });
});

describe("BookingCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courtsList.mockResolvedValue([{ id: "p1", name: "Pista 1", active: true, type: "DOUBLES" }]);
    svc.courtDurations.list.mockResolvedValue([{ id: "d", courtId: "p1", minutes: 90, isDefault: true }]);
    svc.availability.mockResolvedValue([
      {
        courtId: "p1", courtName: "Pista 1", courtType: "DOUBLES", isIndoor: false, startsAt: SLOT,
        endsAt: SLOT, startsAtLocal: "18:00", durationMinutes: 90, priceCents: 2000,
        priceBreakdown: { slot: 2000, extras: [] },
      },
    ]);
    svc.bookings.create.mockResolvedValue({ id: "b1" });
  });

  it("partido abierto: un LSPA con decimales no se manda; un entero sí", async () => {
    renderDialog();
    await screen.findByDisplayValue("18:00");
    fireEvent.click(screen.getByRole("radio", { name: /Abierta/ }));

    const [min] = screen.getAllByRole("spinbutton");
    fireEvent.change(min, { target: { value: "45.5" } });
    expect(screen.getByRole("alert")).toHaveTextContent("número entero");
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();

    fireEvent.change(min, { target: { value: "45" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));

    await waitFor(() =>
      expect(svc.bookings.create).toHaveBeenCalledWith(
        expect.objectContaining({ matchMode: "OPEN", startsAt: SLOT, openMatchMinLspa: 45 }),
      ),
    );
  });

  async function addGuests(names: string[]) {
    const input = screen.getByPlaceholderText("Invitado por nombre…");
    for (const name of names) {
      fireEvent.change(input, { target: { value: name } });
      fireEvent.keyDown(input, { key: "Enter" });
    }
  }

  it("el club no ocupa plaza (D14): en dobles caben 4 jugadores", async () => {
    renderDialog();
    await screen.findByDisplayValue("18:00");
    await addGuests(["Ana", "Bea", "Carla", "Dani"]);

    expect(screen.getByText("Jugadores: 4/4")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Invitado por nombre…")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));

    await waitFor(() =>
      expect(svc.bookings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          matchMode: "PRIVATE_WITH_GUESTS",
          participants: ["Ana", "Bea", "Carla", "Dani"].map((guestName) => ({ guestName })),
        }),
      ),
    );
    // Ni normas ni nada del club como jugador
    expect(svc.bookings.create.mock.calls[0][0]).not.toHaveProperty("rulesVersion");
  });

  it("en una pista individual caben 2", async () => {
    courtsList.mockResolvedValue([{ id: "p1", name: "Pista 1", active: true, type: "SINGLES" }]);
    renderDialog();
    await screen.findByDisplayValue("18:00");
    await addGuests(["Ana", "Bea"]);

    expect(screen.getByText("Jugadores: 2/2")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Invitado por nombre…")).not.toBeInTheDocument();
  });

  it("una hora que no es un hueco libre no se puede reservar", async () => {
    renderDialog({ courtId: "p1", date: "2026-11-02", startsAt: "2026-11-02T08:00:00.000Z" });
    await screen.findByDisplayValue("— elige una hora —");
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();
  });
});
