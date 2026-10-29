/**
 * Alta de reservas desde el panel:
 * - el LSPA de un partido abierto es un entero de 40 o más, como pide el back
 *   (antes admitía decimales y el back lo rechazaba) (R3-5);
 * - la hora que llega del calendario solo vale si es un hueco libre; si no
 *   cabe, se dice por qué, y vuelve si con otra duración cabe;
 * - el club reserva para otros sin ocupar plaza (D14): 4 en dobles, 2 en individual;
 * - una reserva que ya ha empezado ni es competitiva ni abierta (fila 39);
 * - los errores del back se enseñan con su mensaje.
 *
 * Hoy es el 28/10/2026 a las 11:00 de Madrid: el reloj está fijo para que
 * las horas de prueba no pasen a «ya empezadas» con el tiempo.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

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

import { BookingCreateDialog, hasStarted, lspaRangeError } from "@/components/admin/booking-create-dialog";

const SLOT = "2026-11-02T17:00:00.000Z";
// Ayer a las 18:00: ya jugada
const PAST = "2026-10-27T17:00:00.000Z";

const slot = (startsAt: string, startsAtLocal: string) => ({
  courtId: "p1", courtName: "Pista 1", courtType: "DOUBLES", isIndoor: false, startsAt,
  endsAt: startsAt, startsAtLocal, durationMinutes: 90, priceCents: 2000,
  priceBreakdown: { slot: 2000, extras: [] },
});

beforeAll(() => {
  // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00.000Z"));
});

afterAll(() => {
  vi.useRealTimers();
});

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

describe("hasStarted", () => {
  const NOW = Date.parse("2026-10-28T10:00:00.000Z");
  it("ya empezada si la hora es la de ahora o anterior; sin hora, no", () => {
    expect(hasStarted("2026-10-27T17:00:00.000Z", NOW)).toBe(true);
    expect(hasStarted("2026-10-28T10:00:00.000Z", NOW)).toBe(true);
    expect(hasStarted("2026-10-28T10:30:00.000Z", NOW)).toBe(false);
    expect(hasStarted("", NOW)).toBe(false);
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

  it("una hora que ya ha empezado (fila 39): ni competitiva ni abierta, y se manda isCompetitive false", async () => {
    svc.availability.mockResolvedValue([slot(PAST, "18:00")]);
    renderDialog({ courtId: "p1", date: "2026-10-27", startsAt: PAST });
    await screen.findByDisplayValue("18:00");

    const competitive = screen.getByRole("checkbox", { name: /Partido competitivo/ });
    expect(competitive).toBeDisabled();
    expect(competitive).not.toBeChecked();
    expect(screen.getByText(/su resultado no puntúa/)).toBeInTheDocument();
    const open = screen.getByRole("radio", { name: /Abierta/ });
    expect(open).toBeDisabled();
    expect(open).toHaveAccessibleName(/el partido ya ha empezado/);

    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));
    await waitFor(() =>
      expect(svc.bookings.create).toHaveBeenCalledWith(
        expect.objectContaining({ startsAt: PAST, isCompetitive: false, matchMode: "PRIVATE_AMT" }),
      ),
    );
  });

  it("competitiva para una hora futura sí se manda; si luego se elige una ya empezada, deja de serlo", async () => {
    svc.availability.mockResolvedValue([slot(PAST, "09:00"), slot(SLOT, "18:00")]);
    renderDialog();
    await screen.findByDisplayValue("18:00");
    const competitive = screen.getByRole("checkbox", { name: /Partido competitivo/ });
    fireEvent.click(competitive);
    expect(competitive).toBeChecked();

    fireEvent.change(screen.getByDisplayValue("18:00"), { target: { value: PAST } });
    expect(competitive).not.toBeChecked();
    expect(competitive).toBeDisabled();
  });

  it("abierta y luego una hora ya empezada: lo dice y no deja crear", async () => {
    svc.availability.mockResolvedValue([slot(PAST, "09:00"), slot(SLOT, "18:00")]);
    renderDialog();
    await screen.findByDisplayValue("18:00");
    fireEvent.click(screen.getByRole("radio", { name: /Abierta/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("18:00"), { target: { value: PAST } });
    expect(screen.getByRole("alert")).toHaveTextContent("no se puede abrir a otros jugadores");
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();
  });

  it("si el back lo rechaza, se ve su mensaje (p. ej. BOOKING_CONCURRENCY_CONFLICT)", async () => {
    svc.bookings.create.mockRejectedValue(
      new ApiError("Había mucha actividad, inténtalo de nuevo", 409, "BOOKING_CONCURRENCY_CONFLICT"),
    );
    renderDialog();
    await screen.findByDisplayValue("18:00");
    fireEvent.click(screen.getByRole("button", { name: "Crear reserva" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Había mucha actividad, inténtalo de nuevo"));
  });

  it("una hora que no es un hueco libre no se puede reservar", async () => {
    renderDialog({ courtId: "p1", date: "2026-11-02", startsAt: "2026-11-02T08:00:00.000Z" });
    await screen.findByDisplayValue("— elige una hora —");
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();
  });

  it("si la hora del calendario no cabe con esa duración, lo dice; con una en que cabe, vuelve", async () => {
    svc.courtDurations.list.mockResolvedValue([
      { id: "d60", courtId: "p1", minutes: 60, isDefault: false },
      { id: "d90", courtId: "p1", minutes: 90, isDefault: true },
    ]);
    // A las 18:00 solo cabe un partido de 60 min
    svc.availability.mockImplementation(({ duration }: { duration: number }) =>
      Promise.resolve(
        duration === 60
          ? [{
              courtId: "p1", courtName: "Pista 1", courtType: "DOUBLES", isIndoor: false, startsAt: SLOT,
              endsAt: SLOT, startsAtLocal: "18:00", durationMinutes: 60, priceCents: 1500,
              priceBreakdown: { slot: 1500, extras: [] },
            }]
          : [],
      ),
    );
    renderDialog();

    expect(await screen.findByRole("status")).toHaveTextContent("A las 18:00 no hay hueco de 90 min en Pista 1.");
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("90 min"), { target: { value: "60" } });
    expect(await screen.findByDisplayValue("18:00")).toHaveValue(SLOT);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear reserva" })).toBeEnabled());
  });
});
