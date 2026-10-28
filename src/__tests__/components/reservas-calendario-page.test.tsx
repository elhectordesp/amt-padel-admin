/**
 * Calendario de reservas del club (P12): vista «Día» por horas y pistas en
 * hora del club. Pulsar un hueco libre abre el alta con la pista y la hora
 * ya elegidas; la reserva sale en su franja con los jugadores que siguen en
 * ella (R3-3); la vista «Semana» sigue disponible.
 *
 * Hoy es el domingo 25/10/2026 (cambio de hora) a las 11:00 de Madrid y el
 * navegador está en Canarias: lo esperado va en literales, así que volver a
 * la hora del navegador haría fallar los tests.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

const COURTS = [
  { id: "p1", clubId: "c1", name: "Pista 1", isIndoor: false, isCentral: false, order: 1, active: true, type: "DOUBLES" },
  { id: "p2", clubId: "c1", name: "Pista 2", isIndoor: false, isCentral: false, order: 2, active: true, type: "DOUBLES" },
];

// Huecos libres de la Pista 2 el 25/10: 17:30 y 18:00 en Madrid (ya en horario de invierno)
const SLOTS = [
  { t: "17:30", iso: "2026-10-25T16:30:00.000Z" },
  { t: "18:00", iso: "2026-10-25T17:00:00.000Z" },
].map(({ t, iso }) => ({
  courtId: "p2", courtName: "Pista 2", courtType: "DOUBLES", isIndoor: false,
  startsAt: iso, endsAt: iso, startsAtLocal: t, durationMinutes: 90,
  priceCents: 2000, priceBreakdown: { slot: 2000, extras: [] },
}));

const booking = (over: object) => ({
  id: "b1", shortCode: "AMT-1", clubId: "c1", courtId: "p1", matchMode: "PRIVATE_AMT", status: "CONFIRMED",
  startsAt: "2026-10-25T17:00:00.000Z", endsAt: "2026-10-25T18:30:00.000Z", durationMinutes: 90,
  participants: [],
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarioPage />
    </QueryClientProvider>,
  );
}

const browserTz = process.env.TZ;

beforeAll(() => {
  // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-25T10:00:00.000Z"));
  process.env.TZ = "Atlantic/Canary";
});

afterAll(() => {
  process.env.TZ = browserTz;
  vi.useRealTimers();
});

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
  svc.availability.mockResolvedValue(SLOTS);
});

describe("Calendario de reservas — vista Día", () => {
  it("pide las reservas del día del club: de las 00:00 a las 23:59:59.999 de Madrid", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 09:00" });
    expect(svc.bookings.listAll).toHaveBeenCalledWith({
      clubId: "c1",
      fromDate: "2026-10-24T22:00:00.000Z",
      toDate: "2026-10-25T22:59:59.999Z",
    });
    expect(svc.exceptions.list).toHaveBeenCalledWith("c1", { fromDate: "2026-10-25", toDate: "2026-10-25" });
  });

  it("pulsar un hueco libre abre el alta con esa pista y esa hora", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Crear reserva en Pista 2 a las 18:00" }));

    expect(await screen.findByText("Crear reserva", { selector: "h2" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Pista 2")).toHaveValue("p2");
    expect(screen.getByDisplayValue("2026-10-25")).toHaveAttribute("type", "date");
    // La hora llega elegida cuando se cargan los huecos libres
    expect(await screen.findByDisplayValue("18:00")).toHaveValue("2026-10-25T17:00:00.000Z");
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear reserva" })).toBeEnabled());
  });

  it("si a esa hora no cabe la duración, el alta lo dice en vez de dejar la hora en blanco", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Crear reserva en Pista 2 a las 22:30" }));

    expect(await screen.findByRole("status")).toHaveTextContent("A las 22:30 no hay hueco de 90 min en Pista 2.");
    expect(screen.getByDisplayValue("— elige una hora —")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeDisabled();
  });

  it("la reserva sale en su franja, con los jugadores que siguen en ella", async () => {
    svc.bookings.listAll.mockResolvedValue([
      booking({
        participants: [
          { id: "x1", userId: "u1", status: "ACCEPTED" },
          { id: "x2", userId: "u2", status: "ACCEPTED" },
          { id: "x3", userId: "u3", status: "DECLINED" },
          { id: "x4", userId: "u4", status: "REMOVED" },
        ],
      }),
    ]);
    renderPage();

    const block = await screen.findByRole("link", { name: /18:00–19:30/ });
    expect(block).toHaveAttribute("href", "/mi-club/reservas/bookings/b1");
    expect(within(block).getByText("2 jug.")).toBeInTheDocument();
    // Las franjas que ocupa ya no se ofrecen
    expect(screen.queryByRole("button", { name: "Crear reserva en Pista 1 a las 18:30" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva en Pista 2 a las 18:30" })).toBeInTheDocument();
  });

  it("el bloque se estira a todas sus franjas (con h-full medían igual 60 y 90 min)", async () => {
    svc.bookings.listAll.mockResolvedValue([booking({})]);
    renderPage();

    const block = await screen.findByRole("link", { name: /18:00–19:30/ });
    const cell = block.closest("td")!;
    expect(cell).toHaveAttribute("rowspan", "3");
    // jsdom no calcula alturas: se comprueba la maqueta que las da (medida en Chromium)
    expect(cell).toHaveClass("relative");
    expect(block).toHaveClass("absolute", "inset-0.5");
    expect(block).not.toHaveClass("h-full");
  });

  it("el «+» de los huecos libres se ve siempre, no solo con el ratón encima", async () => {
    renderPage();
    const slot = await screen.findByRole("button", { name: "Crear reserva en Pista 1 a las 09:00" });
    expect(within(slot).getByText("+")).not.toHaveClass("opacity-0");
  });

  it("el día va con solo la primera letra en mayúscula", async () => {
    renderPage();
    expect(await screen.findByText("Domingo, 25 oct")).toBeInTheDocument();
  });

  it("el contacto solo es la etiqueta en una reserva por teléfono; si no, un invitado es un jugador más", async () => {
    const guests = [
      { id: "x1", userId: "u1", status: "ACCEPTED" },
      { id: "x2", userId: "u2", status: "ACCEPTED" },
      { id: "x3", userId: null, guestName: "Juan", status: "AUTO_ACCEPTED" },
    ];
    svc.bookings.listAll.mockResolvedValue([
      booking({ id: "conInvitado", matchMode: "PRIVATE_WITH_GUESTS", participants: guests }),
      booking({
        id: "telefono", courtId: "p2", matchMode: "ADMIN_MANUAL",
        participants: [{ id: "y1", userId: null, guestName: "Marta 600 000 000", status: "AUTO_ACCEPTED" }],
      }),
    ]);
    renderPage();

    const [p1Block, p2Block] = await screen.findAllByRole("link", { name: /18:00–19:30/ });
    expect(within(p1Block).getByText("3 jug.")).toBeInTheDocument();
    expect(within(p1Block).queryByText("Juan")).not.toBeInTheDocument();
    expect(within(p2Block).getByText("Marta 600 000 000")).toBeInTheDocument();
  });

  it("un día cerrado por excepción lo dice", async () => {
    svc.exceptions.list.mockResolvedValue([
      { id: "e1", clubId: "c1", date: "2026-10-25T00:00:00.000Z", isClosed: true, customOpen: null, customClose: null, reason: null },
    ]);
    renderPage();
    expect(await screen.findByText("El club está cerrado este día.")).toBeInTheDocument();
  });

  it("si fallan las pistas es un fallo de carga, no «Sin pistas activas»", async () => {
    courtsMock.list.mockRejectedValue(new Error("500"));
    renderPage();
    expect(await screen.findByText("No se pudo cargar el día. Vuelve a intentarlo.")).toBeInTheDocument();
    expect(screen.queryByText(/Sin pistas activas/)).not.toBeInTheDocument();
  });
});

describe("Calendario de reservas — vista Semana", () => {
  it("pide de lunes a domingo del club y pone cada reserva en su día de Madrid", async () => {
    // Domingo a las 23:30 de Madrid, y una cancelada que se ve pero no cuenta
    svc.bookings.listAll.mockResolvedValue([
      booking({ id: "tarde", startsAt: "2026-10-25T22:30:00.000Z", endsAt: "2026-10-25T23:30:00.000Z", durationMinutes: 60 }),
      booking({ id: "anulada", status: "CANCELLED", startsAt: "2026-10-21T17:00:00.000Z", endsAt: "2026-10-21T18:30:00.000Z" }),
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(await screen.findByRole("columnheader", { name: "Pista" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(8);
    expect(svc.bookings.listAll).toHaveBeenLastCalledWith({
      clubId: "c1",
      fromDate: "2026-10-18T22:00:00.000Z",
      toDate: "2026-10-25T22:59:59.999Z",
    });
    expect(screen.getByText("1 reserva esta semana")).toBeInTheDocument();
    const sunday = within(screen.getByRole("row", { name: /^Pista 1/ })).getAllByRole("cell")[7];
    expect(within(sunday).getByText("23:30")).toBeInTheDocument();
  });

  it("si fallan las pistas es un fallo de carga, no «Sin pistas activas»", async () => {
    courtsMock.list.mockRejectedValue(new Error("500"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));
    expect(await screen.findByText("No se pudo cargar la semana. Vuelve a intentarlo.")).toBeInTheDocument();
    expect(screen.queryByText(/Sin pistas activas/)).not.toBeInTheDocument();
  });
});
