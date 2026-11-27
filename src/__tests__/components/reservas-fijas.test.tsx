/**
 * Reservas fijas (el mismo hueco cada semana):
 * - el alta: «Repetir cada semana» solo con cliente y en «Por teléfono»; con él
 *   puesto no hay «Cobrada ahora» y el botón es «Ver fechas»; el segundo paso
 *   enseña cada fecha con su estado y el total, y «Crear N reservas» las crea;
 * - la página «Reservas fijas»: lista, filtro Activas/Terminadas, estado vacío,
 *   ver, ampliar y terminar (con lo que se queda), y solo con escritura;
 * - la marca «Fija» en el calendario, el listado y la ficha de la reserva.
 *
 * Hoy es el 28/10/2026 a las 11:00 de Madrid (el reloj, fijo).
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const meMock = vi.hoisted(() => ({ data: { id: "staff", name: "Gestor" } as Record<string, unknown> | undefined }));
vi.mock("@/lib/use-me", () => ({ useMe: () => meMock }));
const adminMock = vi.hoisted(() => ({
  clubs: { findOne: vi.fn() },
  courts: { list: vi.fn() },
  players: { search: vi.fn() },
}));
vi.mock("@/lib/services/admin", () => ({ adminService: adminMock }));

const svc = vi.hoisted(() => ({
  courtDurations: { list: vi.fn() },
  availability: vi.fn(),
  bookings: { list: vi.fn(), detail: vi.fn(), create: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});
const customersSvc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: customersSvc };
});
const seriesSvc = vi.hoisted(() => ({
  preview: vi.fn(), create: vi.fn(), list: vi.fn(), detail: vi.fn(), extendPreview: vi.fn(), extend: vi.fn(), end: vi.fn(),
}));
vi.mock("@/lib/services/booking-series", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/booking-series")>("@/lib/services/booking-series");
  return { ...actual, bookingSeriesService: seriesSvc };
});

import { BookingCreateDialog } from "@/components/admin/booking-create-dialog";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import BookingsListPage from "../../../app/(admin)/mi-club/reservas/bookings/page";
import BookingDetailPage from "../../../app/(admin)/mi-club/reservas/bookings/[id]/page";
import ReservasFijasPage from "../../../app/(admin)/mi-club/reservas/fijas/page";
import type { SeriesDetail, SeriesOccurrence, SeriesPreview, SeriesView } from "@/lib/services/booking-series";
import type { Booking } from "@/types/bookings";
import type { Court } from "@/types";

beforeAll(() => {
  // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00.000Z"));
});
afterAll(() => {
  vi.useRealTimers();
});

function renderWith(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{ui}</Suspense>
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const SLOT = "2026-11-02T17:00:00.000Z"; // lunes 2/11, 18:00 en Madrid

const occ = (date: string, status: SeriesOccurrence["status"], extra: Partial<SeriesOccurrence> = {}): SeriesOccurrence => ({
  date, startsAt: `${date}T17:00:00.000Z`, endsAt: `${date}T18:30:00.000Z`, status,
  courtId: "p1", courtName: "Pista 1", priceCents: 2000, reason: null, ...extra,
});
const NONE = { courtId: null, courtName: null, priceCents: null };

const PREVIEW: SeriesPreview = {
  weekday: 1,
  occurrences: [
    occ("2026-11-02", "FREE"),
    occ("2026-11-09", "OTHER_COURT", { courtId: "p4", courtName: "Pista 4" }),
    occ("2026-11-16", "UNAVAILABLE", { ...NONE, reason: "CLUB_CLOSED" }),
  ],
  totals: { free: 1, otherCourt: 1, unavailable: 1, priceCents: 4000 },
};

const SERIES: SeriesView = {
  id: "s1", courtId: "p3", courtName: "Pista 3", clubCustomerId: "k1", customerName: "Hugo", weekday: 2,
  startTime: "19:30", durationMinutes: 90, startDate: "2026-12-01", endDate: "2027-03-31", endedAt: null,
  upcomingCount: 12, nextStartsAt: "2026-12-01T18:30:00.000Z",
};

const row = (id: string, startsAt: string, extra: Record<string, unknown> = {}) => ({
  id, shortCode: `AMT-${id.toUpperCase()}`, startsAt, endsAt: startsAt, courtId: "p3", courtName: "Pista 3",
  status: "CONFIRMED", paymentMethod: "PENDING", priceCents: 2000, paidAmountCents: null, hasMoney: false, ...extra,
});

const DETAIL: SeriesDetail = {
  ...SERIES,
  bookings: [
    row("b1", "2026-12-01T18:30:00.000Z", { paymentMethod: "CASH", paidAmountCents: 2000, hasMoney: true }),
    row("b2", "2026-12-08T18:30:00.000Z", { courtId: "p4", courtName: "Pista 4" }),
    row("b3", "2026-12-15T18:30:00.000Z", { status: "CANCELLED" }),
  ] as SeriesDetail["bookings"],
};

const FIXED_BOOKING = {
  id: "b1", shortCode: "AMT-XP9W", clubId: "c1", courtId: "p1", creatorUserId: "staff",
  matchMode: "ADMIN_MANUAL", status: "CONFIRMED", isCompetitive: false,
  startsAt: "2026-11-02T17:00:00.000Z", endsAt: "2026-11-02T18:30:00.000Z", durationMinutes: 90,
  priceCents: 2000, priceBreakdown: { slot: 2000, extras: [] }, paymentMethod: "PENDING", paidAt: null,
  openMatchSlotsRemaining: null, openMatchMinLspa: null, openMatchMaxLspa: null,
  notes: null, rulesAcceptedAt: null, rulesVersion: null, reminder24hSentAt: null, reminder2hSentAt: null,
  createdAt: "2026-10-28T10:00:00.000Z", updatedAt: "2026-10-28T10:00:00.000Z",
  court: { id: "p1", name: "Pista 1", type: "DOUBLES", isIndoor: false },
  clubCustomer: { id: "k1", name: "Hugo", phone: null },
  creator: { id: "staff", name: "Recepción" },
  participants: [], recurringGroupId: "s1",
} as unknown as Booking;

// ── El alta ─────────────────────────────────────────────────────────────────

describe("Alta de una reserva fija (en el diálogo de reserva)", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.courts.list.mockResolvedValue([{ id: "p1", name: "Pista 1", active: true, type: "DOUBLES" }]);
    svc.courtDurations.list.mockResolvedValue([{ id: "d", courtId: "p1", minutes: 90, isDefault: true }]);
    svc.availability.mockResolvedValue([
      {
        courtId: "p1", courtName: "Pista 1", courtType: "DOUBLES", isIndoor: false, startsAt: SLOT,
        endsAt: SLOT, startsAtLocal: "18:00", durationMinutes: 90, priceCents: 2000,
        priceBreakdown: { slot: 2000, extras: [] },
      },
    ]);
    customersSvc.list.mockResolvedValue({
      items: [{ id: "cc1", name: "Hugo", phone: null }],
      total: 1, page: 1, pageSize: 6,
    });
    seriesSvc.preview.mockResolvedValue(PREVIEW);
    seriesSvc.create.mockResolvedValue({ series: SERIES, occurrences: PREVIEW.occurrences });
  });

  const open = async (initial = { courtId: "p1", date: "2026-11-02", startsAt: SLOT }) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    render(
      <QueryClientProvider client={qc}>
        <BookingCreateDialog open onClose={onClose} clubId="c1" timeZone="Europe/Madrid" initial={initial} />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("18:00");
    return invalidate;
  };
  const pickCustomer = async () => {
    fireEvent.change(screen.getByLabelText("Buscar cliente"), { target: { value: "Hugo" } });
    fireEvent.click(await screen.findByRole("button", { name: /Hugo/ }));
  };
  const repeat = () => screen.getByRole("checkbox", { name: "Repetir cada semana" });

  it("«Repetir cada semana» sale solo con cliente elegido y en «Por teléfono»", async () => {
    await open();
    expect(screen.queryByRole("checkbox", { name: "Repetir cada semana" })).not.toBeInTheDocument();
    await pickCustomer();
    expect(repeat()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Con jugadores/ }));
    expect(screen.queryByRole("checkbox", { name: "Repetir cada semana" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Por teléfono/ }));
    expect(repeat()).toBeInTheDocument();
  });

  it("con él puesto: «Hasta» propone el 30 de junio, no hay «Cobrada ahora» y el botón es «Ver fechas»", async () => {
    await open();
    await pickCustomer();
    expect(screen.getByRole("checkbox", { name: /Cobrada ahora/ })).toBeInTheDocument();
    fireEvent.click(repeat());

    expect(screen.getByLabelText("Hasta")).toHaveValue("2027-06-30");
    expect(screen.getByLabelText("Hasta")).toHaveAttribute("max", "2027-11-01");
    expect(screen.getByText(/Se reserva los lunes a las 18:00/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Cobrada ahora/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /No avisar al jugador/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Partido competitivo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear reserva" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver fechas" })).toBeEnabled();

    // Al apagarlo, todo vuelve
    fireEvent.click(repeat());
    expect(screen.getByRole("checkbox", { name: /Cobrada ahora/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear reserva" })).toBeInTheDocument();
  });

  it("«Ver fechas» pide la vista previa con el plan y enseña cada fecha con su estado, el total y «Crear N reservas»", async () => {
    await open();
    await pickCustomer();
    fireEvent.click(repeat());
    fireEvent.click(screen.getByRole("button", { name: "Ver fechas" }));

    await screen.findByRole("list", { name: "Fechas" });
    expect(seriesSvc.preview).toHaveBeenCalledWith("c1", {
      courtId: "p1", clubCustomerId: "cc1", startDate: "2026-11-02", endDate: "2027-06-30", startTime: "18:00", durationMinutes: 90,
    });
    const dates = within(screen.getByRole("list", { name: "Fechas" })).getAllByRole("listitem");
    expect(dates).toHaveLength(3);
    expect(dates[0]).toHaveTextContent("lun 2 nov");
    expect(dates[0]).toHaveTextContent("Libre · 20,00 €");
    expect(dates[1]).toHaveTextContent("lun 9 nov");
    expect(dates[1]).toHaveTextContent("En Pista 4 · 20,00 €");
    expect(dates[2]).toHaveTextContent("lun 16 nov");
    expect(dates[2]).toHaveTextContent("No se puede: el club cierra");
    expect(screen.getByText("2 reservas · 40,00 €, 1 en otra pista, 1 fecha sin hueco")).toBeInTheDocument();
    expect(screen.getByText("Hugo")).toBeInTheDocument();
    expect(screen.getByText(/Lunes 18:00 · 90 min · Pista 1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear 2 reservas" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Atrás" })).toBeInTheDocument();
    expect(seriesSvc.create).not.toHaveBeenCalled();
    expect(svc.bookings.create).not.toHaveBeenCalled();
  });

  it("«Crear 2 reservas» las crea con las notas, avisa de cómo ha ido, refresca reservas y cierra", async () => {
    const invalidate = await open();
    await pickCustomer();
    fireEvent.change(screen.getByLabelText(/Notas/), { target: { value: "  Cuenta abierta  " } });
    fireEvent.click(repeat());
    fireEvent.click(screen.getByRole("button", { name: "Ver fechas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Crear 2 reservas" }));

    await waitFor(() =>
      expect(seriesSvc.create).toHaveBeenCalledWith("c1", {
        courtId: "p1", clubCustomerId: "cc1", startDate: "2026-11-02", endDate: "2027-06-30", startTime: "18:00",
        durationMinutes: 90, notes: "Cuenta abierta",
      }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Reserva fija creada: 2 reservas, 1 en otra pista, 1 fecha sin hueco"),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["bookings", "list"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["booking-series", "c1"] });
    expect(onClose).toHaveBeenCalled();
    expect(svc.bookings.create).not.toHaveBeenCalled();
  });

  it("«Atrás» vuelve al formulario con lo que había puesto", async () => {
    await open();
    await pickCustomer();
    fireEvent.click(repeat());
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2027-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Ver fechas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Atrás" }));

    expect(screen.getByRole("button", { name: "Ver fechas" })).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta")).toHaveValue("2027-01-31");
    expect(screen.queryByRole("list", { name: "Fechas" })).not.toBeInTheDocument();
  });

  it("una fecha «Hasta» a más de un año no deja ver las fechas y dice por qué", async () => {
    await open();
    await pickCustomer();
    fireEvent.click(repeat());
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2027-12-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Una reserva fija dura como mucho un año: hasta el 1/11 como máximo.");
    expect(screen.getByRole("button", { name: "Ver fechas" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("La fecha de fin no puede ser anterior a la de inicio.");
    expect(seriesSvc.preview).not.toHaveBeenCalled();
  });

  it("si el back rechaza el plan, enseña su motivo bajo el campo y no pasa al segundo paso", async () => {
    seriesSvc.preview.mockRejectedValue(new ApiError("Esa pista no admite esa duración", 400, "BOOKING_SERIES_INVALID"));
    await open();
    await pickCustomer();
    fireEvent.click(repeat());
    fireEvent.click(screen.getByRole("button", { name: "Ver fechas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esa pista no admite esa duración");
    expect(screen.queryByRole("list", { name: "Fechas" })).not.toBeInTheDocument();
  });

  it("si ninguna fecha está libre, no se puede crear y lo explica", async () => {
    seriesSvc.preview.mockResolvedValue({
      weekday: 1,
      occurrences: [occ("2026-11-02", "UNAVAILABLE", { ...NONE, reason: "TAKEN" })],
      totals: { free: 0, otherCourt: 0, unavailable: 1, priceCents: 0 },
    });
    await open();
    await pickCustomer();
    fireEvent.click(repeat());
    fireEvent.click(screen.getByRole("button", { name: "Ver fechas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ninguna de las fechas está libre");
    expect(screen.getByText(/No se puede: todas las pistas ocupadas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear 0 reservas" })).toBeDisabled();
  });

  it("si al crear ya se ocuparon todas, dice qué hacer y el diálogo sigue abierto", async () => {
    seriesSvc.create.mockRejectedValue(new ApiError("Ninguna de las fechas está libre", 409, "BOOKING_SERIES_EMPTY"));
    await open();
    await pickCustomer();
    fireEvent.click(repeat());
    fireEvent.click(screen.getByRole("button", { name: "Ver fechas" }));
    fireEvent.click(await screen.findByRole("button", { name: "Crear 2 reservas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Prueba con otra hora, otra pista o más semanas.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Atrás" })).toBeEnabled();
  });

  it("una hora que ya ha empezado no se puede repetir", async () => {
    // Ayer a las 18:00: ya jugada
    svc.availability.mockResolvedValue([
      {
        courtId: "p1", courtName: "Pista 1", courtType: "DOUBLES", isIndoor: false, startsAt: "2026-10-27T17:00:00.000Z",
        endsAt: "2026-10-27T17:00:00.000Z", startsAtLocal: "18:00", durationMinutes: 90, priceCents: 2000,
        priceBreakdown: { slot: 2000, extras: [] },
      },
    ]);
    await open({ courtId: "p1", date: "2026-10-27", startsAt: "2026-10-27T17:00:00.000Z" });
    await pickCustomer();
    await waitFor(() => expect(repeat()).toBeDisabled());
    expect(screen.getByText("Esa hora ya ha empezado: no se puede repetir.")).toBeInTheDocument();
  });
});

// ── La página «Reservas fijas» ──────────────────────────────────────────────

describe("Página «Reservas fijas»", () => {
  const coach = {
    id: "coach", name: "Profe", activeClubId: "c1",
    clubs: [{ clubId: "c1", clubName: "Club Centro", roles: ["COACH"] }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    meMock.data = { id: "staff", name: "Gestor" };
    adminMock.clubs.findOne.mockResolvedValue({ id: "c1", name: "Club", timezone: "Europe/Madrid" });
    seriesSvc.list.mockResolvedValue([SERIES]);
    seriesSvc.detail.mockResolvedValue(DETAIL);
  });

  it("lista cada reserva fija: titular, día y hora, pista, fechas y próximas con la siguiente", async () => {
    renderWith(<ReservasFijasPage />);
    const tr = (await screen.findByText("Hugo")).closest("tr")!;
    expect(seriesSvc.list).toHaveBeenCalledWith("c1", "active");
    expect(tr).toHaveTextContent("Martes 19:30 · 90 min");
    expect(tr).toHaveTextContent("Pista 3");
    expect(tr).toHaveTextContent("Desde el 1/12 hasta el 31/3");
    expect(tr).toHaveTextContent("12 próximas");
    expect(tr).toHaveTextContent("Siguiente: mar 1 dic");
    expect(within(tr).getByRole("button", { name: "Ver" })).toBeInTheDocument();
    expect(within(tr).getByRole("button", { name: /Ampliar/ })).toBeInTheDocument();
    expect(within(tr).getByRole("button", { name: "Terminar" })).toBeInTheDocument();
    expect(screen.getByTestId("header")).toHaveTextContent("Reservas fijas");
  });

  it("sin ninguna, explica cómo crear una", async () => {
    seriesSvc.list.mockResolvedValue([]);
    renderWith(<ReservasFijasPage />);
    expect(
      await screen.findByText("Aún no hay reservas fijas. Créalas desde el calendario: elige el hueco y marca “Repetir cada semana”."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir al calendario/ })).toHaveAttribute("href", "/mi-club/reservas/calendario");
  });

  it("«Terminadas» pide las terminadas, con su estado, y sin «Terminar» ni «Ampliar»", async () => {
    seriesSvc.list.mockImplementation((_c: string, status: string) =>
      Promise.resolve(status === "ended" ? [{ ...SERIES, endedAt: "2026-10-20T10:00:00.000Z", upcomingCount: 0, nextStartsAt: null }] : [SERIES]),
    );
    renderWith(<ReservasFijasPage />);
    await screen.findByText("Hugo");
    fireEvent.click(screen.getByRole("button", { name: "Terminadas" }));
    await waitFor(() => expect(seriesSvc.list).toHaveBeenLastCalledWith("c1", "ended"));
    const tr = (await screen.findByText("Sin próximas")).closest("tr")!;
    expect(tr).toHaveTextContent("Terminada");
    expect(within(tr).queryByRole("button", { name: "Terminar" })).not.toBeInTheDocument();
    expect(within(tr).queryByRole("button", { name: /Ampliar/ })).not.toBeInTheDocument();
    expect(within(tr).getByRole("button", { name: "Ver" })).toBeInTheDocument();
  });

  it("quien solo lee (Entrenador) ve la lista y «Ver», sin ampliar, terminar ni crear", async () => {
    meMock.data = coach;
    renderWith(<ReservasFijasPage />);
    const tr = (await screen.findByText("Hugo")).closest("tr")!;
    expect(within(tr).getByRole("button", { name: "Ver" })).toBeInTheDocument();
    expect(within(tr).queryByRole("button", { name: /Ampliar/ })).not.toBeInTheDocument();
    expect(within(tr).queryByRole("button", { name: "Terminar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ir al calendario/ })).not.toBeInTheDocument();
  });

  it("si no llega la lista, lo dice y se puede reintentar", async () => {
    seriesSvc.list.mockRejectedValueOnce(new Error("Sin conexión"));
    renderWith(<ReservasFijasPage />);
    expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("Hugo")).toBeInTheDocument();
  });

  it("«Ver» enseña sus reservas por fecha: cobro, pista distinta y enlace a cada ficha", async () => {
    renderWith(<ReservasFijasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver" }));
    const dialog = await screen.findByRole("dialog", { name: "Reserva fija" });
    const items = await within(dialog).findAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("mar 1 dic");
    expect(items[0]).toHaveTextContent("Cobrada");
    expect(items[1]).toHaveTextContent("Pista 4");
    expect(items[1]).toHaveTextContent("Sin cobrar");
    expect(items[2]).toHaveTextContent("Cancelada");
    expect(within(items[0]).getByRole("link", { name: "Abrir la reserva AMT-B1" })).toHaveAttribute(
      "href", "/mi-club/reservas/bookings/b1",
    );
    // Se cierra con la X de la cabecera o con «Cerrar» del pie
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" })[1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("con ?serie= en la dirección (el enlace de la ficha), abre su detalle y al cerrarlo quita el parámetro", async () => {
    nav.search = "serie=s1";
    renderWith(<ReservasFijasPage />);
    const dialog = await screen.findByRole("dialog", { name: "Reserva fija" });
    expect(seriesSvc.detail).toHaveBeenCalledWith("c1", "s1");
    await within(dialog).findByRole("list", { name: "Reservas de la reserva fija" });
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" })[0]);
    expect(nav.replace).toHaveBeenCalledWith("/mi-club/reservas/fijas");
  });

  describe("ampliar", () => {
    it("propone el 30 de junio, enseña las fechas nuevas sin crear nada y, al confirmar, las crea", async () => {
      seriesSvc.extendPreview.mockResolvedValue({
        weekday: 2,
        occurrences: [occ("2027-04-06", "FREE", { courtId: "p3", courtName: "Pista 3" }), occ("2027-04-13", "OTHER_COURT", { courtId: "p4", courtName: "Pista 4" })],
        totals: { free: 1, otherCourt: 1, unavailable: 0, priceCents: 4000 },
      });
      seriesSvc.extend.mockResolvedValue({ series: SERIES, occurrences: [occ("2027-04-06", "FREE"), occ("2027-04-13", "OTHER_COURT")] });
      const { invalidate } = renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Ampliar/ }));

      const dialog = await screen.findByRole("dialog", { name: /Ampliar la reserva fija de Hugo/ });
      expect(within(dialog).getByLabelText("Nueva fecha de fin")).toHaveValue("2027-06-30");
      fireEvent.click(within(dialog).getByRole("button", { name: "Ver fechas" }));

      await within(dialog).findByRole("list", { name: "Fechas" });
      expect(seriesSvc.extendPreview).toHaveBeenCalledWith("c1", "s1", "2027-06-30");
      expect(seriesSvc.extend).not.toHaveBeenCalled();
      expect(within(dialog).getByText("2 reservas · 40,00 €, 1 en otra pista")).toBeInTheDocument();

      fireEvent.click(within(dialog).getByRole("button", { name: "Crear 2 reservas" }));
      await waitFor(() => expect(seriesSvc.extend).toHaveBeenCalledWith("c1", "s1", "2027-06-30"));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reserva fija ampliada: 2 reservas más, 1 en otra pista"));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["bookings", "list"] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["booking-series", "c1"] });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("una fecha que no es posterior al fin actual no se puede pedir, y dice por qué", async () => {
      renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Ampliar/ }));
      const dialog = await screen.findByRole("dialog", { name: /Ampliar/ });
      fireEvent.change(within(dialog).getByLabelText("Nueva fecha de fin"), { target: { value: "2027-03-31" } });
      expect(within(dialog).getByRole("alert")).toHaveTextContent("La nueva fecha tiene que ser posterior al 31/3.");
      expect(within(dialog).getByRole("button", { name: "Ver fechas" })).toBeDisabled();
    });

    it("si la reserva fija ya estaba terminada, el motivo sale en llano", async () => {
      seriesSvc.extendPreview.mockRejectedValue(new ApiError("Esta reserva fija ya está terminada", 409, "BOOKING_SERIES_ENDED"));
      renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: /Ampliar/ }));
      const dialog = await screen.findByRole("dialog", { name: /Ampliar/ });
      fireEvent.click(within(dialog).getByRole("button", { name: "Ver fechas" }));
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("crea otra desde el calendario");
    });
  });

  describe("terminar", () => {
    it("pide confirmación explicando qué se cancela, no manda nada hasta confirmar y enseña lo que se queda", async () => {
      seriesSvc.end.mockResolvedValue({
        series: { ...SERIES, endedAt: "2026-10-28T10:00:00.000Z" },
        cancelled: 9,
        kept: [{ id: "b2", shortCode: "AMT-B2", startsAt: "2026-12-08T18:30:00.000Z" }],
      });
      const { invalidate } = renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));

      const confirm = await screen.findByRole("dialog", { name: /¿Terminar la reserva fija de Hugo\?/ });
      expect(confirm).toHaveTextContent("no tienen cobros ni deuda");
      expect(confirm).toHaveTextContent("Las que sí los tienen se quedan");
      expect(confirm).toHaveTextContent("Ahora le quedan 12 reservas por delante.");
      expect(within(confirm).getByLabelText("Terminar desde el día")).toHaveValue("2026-10-28");
      expect(seriesSvc.end).not.toHaveBeenCalled();

      fireEvent.change(within(confirm).getByLabelText("Motivo de la cancelación"), { target: { value: " Cambia de pista " } });
      fireEvent.click(within(confirm).getByRole("button", { name: "Sí, terminar" }));
      await waitFor(() => expect(seriesSvc.end).toHaveBeenCalledWith("c1", "s1", { fromDate: "2026-10-28", reason: "Cambia de pista" }));

      const result = await screen.findByRole("dialog", { name: "Reserva fija terminada" });
      expect(within(result).getByRole("status")).toHaveTextContent("Se han cancelado 9 reservas.");
      expect(result).toHaveTextContent("Esta reserva se queda porque tiene cobros o deuda");
      expect(within(result).getByRole("link", { name: "Abrir la reserva AMT-B2" })).toHaveAttribute(
        "href", "/mi-club/reservas/bookings/b2",
      );
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["bookings", "list"] });
      fireEvent.click(within(result).getByRole("button", { name: "Entendido" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("sin motivo no manda ninguno (el back pone «Fin de la reserva fija»)", async () => {
      seriesSvc.end.mockResolvedValue({ series: SERIES, cancelled: 0, kept: [] });
      renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Sí, terminar" }));
      await waitFor(() => expect(seriesSvc.end).toHaveBeenCalledWith("c1", "s1", { fromDate: "2026-10-28" }));
      const result = await screen.findByRole("dialog", { name: "Reserva fija terminada" });
      expect(result).toHaveTextContent("No se ha cancelado ninguna reserva.");
      expect(result).toHaveTextContent("No se ha quedado ninguna reserva con cobros o deuda.");
    });

    it("«No, volver» cierra sin terminar nada", async () => {
      renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));
      fireEvent.click(await screen.findByRole("button", { name: "No, volver" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(seriesSvc.end).not.toHaveBeenCalled();
    });

    it("un día anterior a hoy no deja confirmar", async () => {
      renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));
      const confirm = await screen.findByRole("dialog");
      fireEvent.change(within(confirm).getByLabelText("Terminar desde el día"), { target: { value: "2026-10-01" } });
      expect(within(confirm).getByRole("alert")).toHaveTextContent("Solo se puede terminar desde hoy en adelante.");
      expect(within(confirm).getByRole("button", { name: "Sí, terminar" })).toBeDisabled();
    });

    it("si el back rechaza, avisa con el texto en llano y el diálogo sigue abierto", async () => {
      seriesSvc.end.mockRejectedValue(new ApiError("Esta reserva fija ya está terminada", 409, "BOOKING_SERIES_ENDED"));
      renderWith(<ReservasFijasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Terminar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Sí, terminar" }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("ya está terminada")));
      expect(screen.getByRole("dialog", { name: /¿Terminar la reserva fija/ })).toBeInTheDocument();
    });
  });
});

// ── La marca «Fija» ─────────────────────────────────────────────────────────

describe("Marca «Fija»", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.search = "";
    meMock.data = { id: "staff", name: "Gestor" };
    adminMock.clubs.findOne.mockResolvedValue({ id: "c1", name: "Club", timezone: "Europe/Madrid" });
    seriesSvc.detail.mockResolvedValue(DETAIL);
  });

  const courts = [{ id: "p1", name: "Pista 1" }] as Court[];
  const grid = (bookings: Booking[]) =>
    render(
      <ReservasDayGrid
        date="2026-11-02"
        timeZone="Europe/Madrid"
        courts={courts}
        bookings={bookings}
        window={{ openTime: "09:00", closeTime: "22:00" }}
        onSlotClick={vi.fn()}
        period="tarde"
      />,
    );

  it("calendario: el bloque de una reserva fija lleva «Fija» y la leyenda lo explica; el de una normal, no", () => {
    const { unmount } = grid([FIXED_BOOKING]);
    expect(screen.getByRole("link", { name: /Hugo/ })).toHaveTextContent("Fija");
    expect(screen.getByRole("link", { name: /Hugo/ })).toHaveAttribute("title", expect.stringContaining("Reserva fija"));
    expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("Fija: se repite cada semana");
    unmount();
    grid([{ ...FIXED_BOOKING, recurringGroupId: null }]);
    expect(screen.getByRole("link", { name: /Hugo/ })).not.toHaveTextContent("Fija");
    expect(screen.getByRole("list", { name: "Leyenda" })).not.toHaveTextContent("Fija");
  });

  it("listado: la fila de una reserva fija lleva «Fija»; la normal, no", async () => {
    svc.bookings.list.mockResolvedValue({
      items: [FIXED_BOOKING, { ...FIXED_BOOKING, id: "b2", shortCode: "AMT-2222", recurringGroupId: null }],
      total: 2,
    });
    renderWith(<BookingsListPage />);
    const fixedRow = (await screen.findByText(/AMT-XP9W/)).closest("tr")!;
    expect(fixedRow).toHaveTextContent("Fija");
    expect(screen.getByText(/AMT-2222/).closest("tr")).not.toHaveTextContent("Fija");
  });

  it("ficha: «Fija» en la cabecera y «Reserva fija de Hugo · martes 19:30 · hasta el 31/3 · Ver» con enlace a la reserva fija", async () => {
    svc.bookings.detail.mockResolvedValue(FIXED_BOOKING);
    await act(async () => {
      renderWith(<BookingDetailPage params={Promise.resolve({ id: "b1" })} />);
    });
    const notice = (await screen.findByText("Reserva fija de Hugo · martes 19:30 · hasta el 31/3")).parentElement!;
    expect(seriesSvc.detail).toHaveBeenCalledWith("c1", "s1");
    expect(within(notice).getByRole("link", { name: "Ver" })).toHaveAttribute("href", "/mi-club/reservas/fijas?serie=s1");
    expect(screen.getAllByText("Fija").length).toBeGreaterThan(0);
  });

  it("ficha de una reserva normal: ni marca ni línea, y no pide ninguna reserva fija", async () => {
    svc.bookings.detail.mockResolvedValue({ ...FIXED_BOOKING, recurringGroupId: null });
    await act(async () => {
      renderWith(<BookingDetailPage params={Promise.resolve({ id: "b1" })} />);
    });
    await screen.findByText("Lunes, 2 de noviembre de 2026");
    expect(screen.queryByText("Fija")).not.toBeInTheDocument();
    expect(screen.queryByText(/Reserva fija de/)).not.toBeInTheDocument();
    expect(seriesSvc.detail).not.toHaveBeenCalled();
  });
});
