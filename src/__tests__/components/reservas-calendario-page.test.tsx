/**
 * Calendario de reservas del club (P12): vista «Día» por horas y pistas en
 * hora del club. Pulsar un hueco libre abre el alta con la pista y la hora
 * ya elegidas; la reserva sale en su franja con los jugadores que siguen en
 * ella (R3-3); la vista «Semana» sigue disponible.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addDaysToKey, zonedDayKey, zonedToDate } from "@/lib/utils/time-zone";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));

const courtsMock = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({
  adminService: { courts: courtsMock, players: { search: vi.fn() } },
}));

const svc = vi.hoisted(() => ({
  operatingHours: { list: vi.fn() },
  exceptions: { list: vi.fn() },
  bookings: { listAll: vi.fn(), create: vi.fn() },
  courtDurations: { list: vi.fn() },
  availability: vi.fn(),
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import CalendarioPage from "../../../app/(admin)/mi-club/reservas/calendario/page";

const MADRID = "Europe/Madrid";
const today = zonedDayKey(new Date(), MADRID);
const at = (day: string, hhmm: string) => zonedToDate(`${day}T${hhmm}`, MADRID)!.toISOString();

const COURTS = [
  { id: "p1", clubId: "c1", name: "Pista 1", isIndoor: false, isCentral: false, order: 1, active: true, type: "DOUBLES" },
  { id: "p2", clubId: "c1", name: "Pista 2", isIndoor: false, isCentral: false, order: 2, active: true, type: "DOUBLES" },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarioPage />
    </QueryClientProvider>,
  );
}

describe("Calendario de reservas — vista Día", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courtsMock.list.mockResolvedValue(COURTS);
    // Abierto todos los días de 09:00 a 23:00
    svc.operatingHours.list.mockResolvedValue(
      [1, 2, 3, 4, 5, 6, 7].map((d) => ({ id: `h${d}`, clubId: "c1", dayOfWeek: d, openTime: "09:00", closeTime: "23:00", active: true })),
    );
    svc.exceptions.list.mockResolvedValue([]);
    svc.bookings.listAll.mockResolvedValue([]);
    svc.courtDurations.list.mockResolvedValue([{ id: "d1", courtId: "p2", minutes: 90, isDefault: true }]);
    svc.availability.mockImplementation(({ date }: { date: string }) =>
      Promise.resolve(
        ["17:30", "18:00"].map((t) => ({
          courtId: "p2", courtName: "Pista 2", courtType: "DOUBLES", isIndoor: false,
          startsAt: at(date, t), endsAt: at(date, t), startsAtLocal: t, durationMinutes: 90,
          priceCents: 2000, priceBreakdown: { slot: 2000, extras: [] },
        })),
      ),
    );
  });

  it("pide las reservas de todo el día del club (00:00 a 23:59:59 en Madrid)", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 09:00" });
    expect(svc.bookings.listAll).toHaveBeenCalledWith({
      clubId: "c1",
      fromDate: at(today, "00:00"),
      toDate: new Date(new Date(at(addDaysToKey(today, 1), "00:00")).getTime() - 1).toISOString(),
    });
  });

  it("pulsar un hueco libre abre el alta con esa pista y esa hora", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Crear reserva en Pista 2 a las 18:00" }));

    expect(await screen.findByText("Crear reserva", { selector: "h2" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Pista 2")).toHaveValue("p2");
    expect(screen.getByDisplayValue(today)).toHaveAttribute("type", "date");
    // La hora llega elegida cuando se cargan los huecos libres
    expect(await screen.findByDisplayValue("18:00")).toHaveValue(at(today, "18:00"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear reserva" })).toBeEnabled());
  });

  it("la reserva sale en su franja, con los jugadores que siguen en ella", async () => {
    svc.bookings.listAll.mockResolvedValue([
      {
        id: "b1", shortCode: "AMT-1", clubId: "c1", courtId: "p1", matchMode: "PRIVATE_AMT", status: "CONFIRMED",
        startsAt: at(today, "18:00"), endsAt: at(today, "19:30"), durationMinutes: 90,
        participants: [
          { id: "x1", userId: "u1", status: "ACCEPTED" },
          { id: "x2", userId: "u2", status: "ACCEPTED" },
          { id: "x3", userId: "u3", status: "DECLINED" },
          { id: "x4", userId: "u4", status: "REMOVED" },
        ],
      },
    ]);
    renderPage();

    const block = await screen.findByRole("link", { name: /18:00–19:30/ });
    expect(block).toHaveAttribute("href", "/mi-club/reservas/bookings/b1");
    expect(within(block).getByText("2 jug.")).toBeInTheDocument();
    // Las franjas que ocupa ya no se ofrecen
    expect(screen.queryByRole("button", { name: "Crear reserva en Pista 1 a las 18:30" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva en Pista 2 a las 18:30" })).toBeInTheDocument();
  });

  it("un día cerrado por excepción lo dice", async () => {
    svc.exceptions.list.mockResolvedValue([
      { id: "e1", clubId: "c1", date: `${today}T00:00:00.000Z`, isClosed: true, customOpen: null, customClose: null, reason: null },
    ]);
    renderPage();
    expect(await screen.findByText("El club está cerrado este día.")).toBeInTheDocument();
  });

  it("«Semana» enseña el resumen por pistas y días", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));
    expect(await screen.findByRole("columnheader", { name: "Pista" })).toBeInTheDocument();
    expect(screen.getByText("0 reservas esta semana")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  });
});
