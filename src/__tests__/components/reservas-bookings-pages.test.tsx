/**
 * Listado y detalle de reservas del club (R3-3):
 * - «Próximas» no trae las canceladas;
 * - quien rechazó o salió no cuenta como jugador;
 * - el aviso de cancelar dice a cuántos avisa de verdad el back (los que
 *   siguen y tienen cuenta, sin el propio club), y no da número hasta saber
 *   quién cancela;
 * - días y horas en hora del club (su zona), como el calendario.
 *
 * Hoy es el 28/10/2026 a las 11:00 de Madrid, el club está en Madrid y el
 * navegador en Canarias: lo esperado va en literales, así que volver a la
 * hora del navegador haría fallar los tests. Con un club en Canarias (B1),
 * el navegador pasa a Madrid.
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/components/admin/booking-create-dialog", () => ({ BookingCreateDialog: () => null }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const meMock = vi.hoisted(() => ({
  data: { id: "club-admin", name: "Gestor" } as { id: string; name: string } | undefined,
}));
vi.mock("@/lib/use-me", () => ({ useMe: () => meMock }));
const clubsMock = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));
const club = (timezone: string) => ({ id: "c1", name: "Club Centro", timezone });

const svc = vi.hoisted(() => ({
  bookings: { list: vi.fn(), detail: vi.fn(), cancel: vi.fn(), markPaid: vi.fn(), setResult: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});
const voucherSvc = vi.hoisted(() => ({ booking: { usable: vi.fn(), use: vi.fn(), remove: vi.fn() } }));
vi.mock("@/lib/services/club-vouchers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-vouchers")>("@/lib/services/club-vouchers");
  return { ...actual, clubVouchersService: voucherSvc };
});

const partsSvc = vi.hoisted(() => ({ view: vi.fn() }));
vi.mock("@/lib/services/booking-parts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/booking-parts")>("@/lib/services/booking-parts");
  return { ...actual, bookingPartsService: partsSvc };
});
const accountsSvc = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/accounts")>("@/lib/services/accounts");
  return { ...actual, accountsService: accountsSvc };
});

import BookingsListPage from "../../../app/(admin)/mi-club/reservas/bookings/page";
import BookingDetailPage from "../../../app/(admin)/mi-club/reservas/bookings/[id]/page";

const BOOKING = {
  id: "b1", shortCode: "AMT-XP9W", clubId: "c1", courtId: "p1", creatorUserId: "club-admin",
  matchMode: "PRIVATE_AMT", status: "CONFIRMED", isCompetitive: false,
  startsAt: "2026-11-02T17:00:00.000Z", endsAt: "2026-11-02T18:30:00.000Z", durationMinutes: 90,
  priceCents: 2000, priceBreakdown: { slot: 2000, extras: [] }, paymentMethod: "PENDING", paidAt: null,
  openMatchSlotsRemaining: null, openMatchMinLspa: null, openMatchMaxLspa: null,
  notes: null, rulesAcceptedAt: null, rulesVersion: null, reminder24hSentAt: null, reminder2hSentAt: null,
  createdAt: "2026-10-28T10:00:00.000Z", updatedAt: "2026-10-28T10:00:00.000Z",
  court: { id: "p1", name: "Pista 1", type: "DOUBLES", isIndoor: false },
  participants: [
    { id: "x0", userId: "club-admin", guestName: null, isCreator: true, status: "AUTO_ACCEPTED", user: { id: "club-admin", name: "Gestor" } },
    { id: "x1", userId: "u1", guestName: null, isCreator: false, status: "ACCEPTED", user: { id: "u1", name: "Óscar" } },
    { id: "x2", userId: "u2", guestName: null, isCreator: false, status: "INVITED", user: { id: "u2", name: "Pepe" } },
    { id: "x3", userId: "u3", guestName: null, isCreator: false, status: "DECLINED", user: { id: "u3", name: "Rosa" } },
    { id: "x4", userId: null, guestName: "Juan", isCreator: false, status: "AUTO_ACCEPTED" },
  ],
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

async function renderDetail() {
  // `use(params)` suspende hasta que se resuelve la promesa: dentro de act
  await act(async () => {
    wrap(<BookingDetailPage params={Promise.resolve({ id: "b1" })} />);
  });
}

const browserTz = process.env.TZ;

beforeAll(() => {
  // Solo el reloj: los temporizadores siguen siendo los de verdad (findBy, React Query)
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-28T10:00:00.000Z"));
  process.env.TZ = "Atlantic/Canary";
});

afterAll(() => {
  process.env.TZ = browserTz;
  vi.useRealTimers();
});

describe("Listado de reservas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 1 });
  });

  it("«Hoy» es el día del club: de las 00:00 a las 23:59:59.999 de Madrid", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    expect(svc.bookings.list).toHaveBeenCalledWith({
      clubId: "c1",
      limit: 50,
      offset: 0,
      fromDate: "2026-10-27T23:00:00.000Z",
      toDate: "2026-10-28T22:59:59.999Z",
      order: "asc",
    });
  });

  it("«Próximas» empieza al acabar el día del club e «Histórico» acaba al empezar", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    fireEvent.click(screen.getByRole("button", { name: "Próximas" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ fromDate: "2026-10-28T22:59:59.999Z" }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ toDate: "2026-10-27T23:00:00.000Z" }),
      ),
    );
  });

  it("cada reserva con su día y su hora de Madrid", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByText("18:00 - 19:30")).toBeInTheDocument();
    expect(screen.getByText(/lun, 2 nov/)).toBeInTheDocument();
  });

  it("«Próximas» pide solo las que siguen en pie, de la más cercana a la más lejana", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    fireEvent.click(screen.getByRole("button", { name: "Próximas" }));

    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ statuses: ["PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"], order: "asc" }),
      ),
    );
  });

  it("«Hoy» va por orden de hora; «Histórico», de la más reciente hacia atrás", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.objectContaining({ order: "asc" }));

    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ order: "asc" })),
    );
  });

  it("quien rechazó no cuenta como jugador; el precio, con coma", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByText("4 jugadores")).toBeInTheDocument();
    expect(screen.getByText("20,00 €")).toBeInTheDocument();
  });

  it("con uno solo, «1 jugador» (antes «1 jugadores»)", async () => {
    svc.bookings.list.mockResolvedValue({
      items: [{ ...BOOKING, participants: [BOOKING.participants[1]] }],
      total: 1,
    });
    wrap(<BookingsListPage />);
    expect(await screen.findByText("1 jugador")).toBeInTheDocument();
  });
});

describe("Listado de reservas por páginas y con búsqueda (B3)", () => {
  // 120 reservas en el back: tres páginas de 50
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 120 });
  });

  async function goToSecondPage() {
    await screen.findByText("Mostrando 1–50 de 120 reservas");
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 50, offset: 50 })),
    );
  }

  it("la segunda página pide las 50 siguientes y cuenta con el total del back", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByText("120 reservas")).toBeInTheDocument();
    await goToSecondPage();
    expect(await screen.findByText("Mostrando 51–100 de 120 reservas")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("con 100 por página (lo más que da el back) vuelve a la primera", async () => {
    wrap(<BookingsListPage />);
    await goToSecondPage();
    fireEvent.change(screen.getByRole("combobox", { name: "Filas por página" }), { target: { value: "100" } });
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, offset: 0 })),
    );
  });

  it("al cambiar de pestaña vuelve a la primera página", async () => {
    wrap(<BookingsListPage />);
    await goToSecondPage();
    fireEvent.click(screen.getByRole("button", { name: "Próximas" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ fromDate: "2026-10-28T22:59:59.999Z", offset: 0 }),
      ),
    );
  });

  it("mientras llega la página siguiente se siguen viendo las de antes", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("Mostrando 1–50 de 120 reservas");
    svc.bookings.list.mockReturnValue(new Promise(() => {}));
    await goToSecondPage();
    expect(screen.getByText(/AMT-XP9W/)).toBeInTheDocument();
    expect(screen.getByText("120 reservas")).toBeInTheDocument();
  });

  it("mientras llegan las de otra pestaña no se ven las de la anterior", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    svc.bookings.list.mockReturnValue(new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ toDate: "2026-10-27T23:00:00.000Z" }),
      ),
    );
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText(/AMT-XP9W/)).not.toBeInTheDocument();
  });

  it("tampoco si se cambia de pestaña mientras llega otra página", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("Mostrando 1–50 de 120 reservas");
    svc.bookings.list.mockReturnValue(new Promise(() => {}));
    await goToSecondPage();
    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ toDate: "2026-10-27T23:00:00.000Z" }),
      ),
    );
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    expect(screen.queryByText(/AMT-XP9W/)).not.toBeInTheDocument();
  });

  it("busca con q tras 300 ms sin teclear, sin los espacios de los lados, y vuelve a la primera página", async () => {
    // Con la búsqueda quedan 60: la segunda página seguiría existiendo
    svc.bookings.list.mockImplementation(async (filters: { q?: string }) =>
      filters.q ? { items: [BOOKING], total: 60 } : { items: [BOOKING], total: 120 },
    );
    wrap(<BookingsListPage />);
    await goToSecondPage();

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar reservas" }), {
      target: { value: "  ana@club.es " },
    });
    // Mientras se teclea (aquí, 150 ms después) no se pide nada
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(svc.bookings.list).not.toHaveBeenCalledWith(expect.objectContaining({ q: expect.anything() }));

    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "ana@club.es", limit: 50, offset: 0 }),
      ),
    );
    expect(await screen.findByText("Mostrando 1–50 de 60 reservas")).toBeInTheDocument();
  });

  it("si nadie coincide con la búsqueda, lo dice", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    svc.bookings.list.mockResolvedValue({ items: [], total: 0 });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar reservas" }), { target: { value: "Zoe" } });
    expect(await screen.findByText("Ninguna reserva coincide con la búsqueda")).toBeInTheDocument();
  });

  it("al abrir, la espera del buscador no devuelve a la primera página", async () => {
    wrap(<BookingsListPage />);
    await goToSecondPage();
    // Más de los 300 ms de la espera
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50 }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("explica que un club busca por el nombre o por el email completo", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByRole("searchbox", { name: "Buscar reservas" })).toHaveAccessibleDescription(
      "Busca por el nombre o por el email completo de quien juega.",
    );
  });

  it("si no llega el listado, lo dice (sin «0 reservas») y se puede reintentar", async () => {
    svc.bookings.list.mockRejectedValueOnce(new Error("500"));
    wrap(<BookingsListPage />);
    expect(await screen.findByText("No se pudieron cargar las reservas.")).toBeInTheDocument();
    expect(screen.queryByText("0 reservas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText(/AMT-XP9W/)).toBeInTheDocument();
  });
});

describe("Detalle de reserva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    meMock.data = { id: "club-admin", name: "Gestor" };
    svc.bookings.detail.mockResolvedValue(BOOKING);
  });

  it("el día y las horas son los de Madrid; solo la primera letra en mayúscula", async () => {
    await renderDetail();
    // Antes, con capitalize: «Lunes, 2 De Noviembre De 2026»
    expect(await screen.findByText("Lunes, 2 de noviembre de 2026")).toBeInTheDocument();
    expect(screen.getByText(/18:00 – 19:30 · 90 min/)).toBeInTheDocument();
  });

  it("el precio con coma, como el resto del panel", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING,
      priceCents: 3000,
      priceBreakdown: { slot: 2600, extras: [{ id: "luz", name: "Luz", cents: 400 }] },
    });
    await renderDetail();
    expect(await screen.findByText(/^30,00 €/)).toBeInTheDocument();
    expect(screen.getByText("Incluye: Luz (4,00 €)")).toBeInTheDocument();
  });

  it("al cancelar dice a cuántos jugadores avisa: los que siguen con cuenta, sin el club", async () => {
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));

    expect(screen.getByText("Se avisará por push y email a 2 jugadores.")).toBeInTheDocument();
  });

  it("sin saber aún quién cancela, no da número (contaría al propio club)", async () => {
    meMock.data = undefined;
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));

    expect(screen.getByText("Se avisará por push y email a los jugadores con cuenta.")).toBeInTheDocument();
    expect(screen.queryByText(/a 3 jugadores/)).not.toBeInTheDocument();
  });

  it("cobrada: con su método y ofrece marcarla como no pagada", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING,
      paymentMethod: "CASH_AT_VENUE",
      paidAt: "2026-10-27T10:00:00.000Z",
    });
    await renderDetail();
    expect(await screen.findByText("(En el club)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marcar como no pagada/ })).toBeInTheDocument();
  });

  it("sin datos de cobro (el back los borra a los 6 años): ni «()» ni botones de pago", async () => {
    svc.bookings.detail.mockResolvedValue({ ...BOOKING, paymentMethod: null, paidAt: null });
    await renderDetail();
    expect(await screen.findByText("(sin datos de cobro)")).toBeInTheDocument();
    expect(screen.queryByText("()")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como no pagada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar pagado/ })).not.toBeInTheDocument();
  });

  describe("bonos (B14)", () => {
    const WITH_CUSTOMER = { ...BOOKING, clubCustomerId: "cc1" };

    it("pendiente y con cliente: ofrece «Pagar con bono» y abre los bonos de ESA reserva", async () => {
      svc.bookings.detail.mockResolvedValue(WITH_CUSTOMER);
      voucherSvc.booking.usable.mockResolvedValue([]);
      await renderDetail();
      fireEvent.click(await screen.findByRole("button", { name: /Pagar con bono/ }));

      expect(await screen.findByRole("dialog", { name: "Pagar con bono" })).toBeInTheDocument();
      expect(voucherSvc.booking.usable).toHaveBeenCalledWith("c1", "b1");
    });

    it("sin cliente, no hay bono que elegir: no ofrece «Pagar con bono» (sí «Cobrar»)", async () => {
      await renderDetail();
      expect(await screen.findByRole("button", { name: /Cobrar/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Pagar con bono/ })).not.toBeInTheDocument();
    });

    it("pagada con bono: lo dice, ofrece quitar el bono (no «Marcar como no pagada») y al quitarlo lo manda al back", async () => {
      svc.bookings.detail.mockResolvedValue({
        ...WITH_CUSTOMER,
        paymentMethod: "VOUCHER",
        paidAt: "2026-10-27T10:00:00.000Z",
        paidAmountCents: 0,
      });
      voucherSvc.booking.remove.mockResolvedValue({});
      await renderDetail();
      expect(await screen.findByText("(Bono)")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Marcar como no pagada/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Quitar el bono/ }));
      await waitFor(() => expect(voucherSvc.booking.remove).toHaveBeenCalledWith("c1", "b1"));
      expect(svc.bookings.markPaid).not.toHaveBeenCalled();
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Bono quitado")));
    });

    it("un Entrenador (solo lee las reservas, sin caja): ni cobrar ni pagar con bono", async () => {
      meMock.data = {
        id: "coach", name: "Profe", activeClubId: "c1",
        clubs: [{ clubId: "c1", clubName: "Club Centro", roles: ["COACH"] }],
      } as unknown as typeof meMock.data;
      svc.bookings.detail.mockResolvedValue(WITH_CUSTOMER);
      await renderDetail();
      await screen.findByText("Lunes, 2 de noviembre de 2026");
      expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Pagar con bono/ })).not.toBeInTheDocument();
    });
  });
});

describe("Detalle de reserva — resultado (R2-7)", () => {
  const PLAYED = {
    ...BOOKING,
    status: "COMPLETED",
    isCompetitive: true,
    resultAdminDeadlineAt: "2099-01-01T00:00:00.000Z",
    resultEntryDeadlineAt: "2099-01-01T00:00:00.000Z",
    participants: [
      { id: "a", userId: "u1", guestName: null, isCreator: false, status: "ACCEPTED", team: 1, user: { id: "u1", name: "Ana" } },
      { id: "b", userId: "u2", guestName: null, isCreator: false, status: "ACCEPTED", team: 1, user: { id: "u2", name: "Bea" } },
      { id: "c", userId: "u3", guestName: null, isCreator: false, status: "ACCEPTED", team: 2, user: { id: "u3", name: "Carla" } },
      { id: "d", userId: "u4", guestName: null, isCreator: false, status: "ACCEPTED", team: 2, user: { id: "u4", name: "Dani" } },
    ],
    result: {
      set1Home: 6, set1Away: 4, set2Home: 6, set2Away: 3, set3Home: null, set3Away: null, winnerTeam: 1,
      enteredByUserId: "u1", enteredAt: "", finalizedAt: null, processedLspaAt: null,
    },
  };

  async function renderDetail(booking: object) {
    svc.bookings.detail.mockResolvedValue(booking);
    await act(async () => {
      wrap(<BookingDetailPage params={Promise.resolve({ id: "b1" })} />);
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    // Sin rol de equipo conocido (como el resto de describes): el test del Entrenador de arriba no se arrastra
    meMock.data = { id: "club-admin", name: "Gestor" };
    svc.bookings.setResult.mockResolvedValue({});
  });

  it("enseña los equipos, el marcador y quién gana", async () => {
    await renderDetail(PLAYED);
    expect(await screen.findByText("6-4 · 6-3")).toBeInTheDocument();
    expect(screen.getByText("Gana el equipo 1")).toBeInTheDocument();
    expect(screen.getByText("Ana y Bea")).toBeInTheDocument();
    expect(screen.getByText("Carla y Dani")).toBeInTheDocument();
  });

  it("el club corrige el resultado y se manda con PUT", async () => {
    await renderDetail(PLAYED);
    fireEvent.click(await screen.findByRole("button", { name: /Corregir resultado/ }));
    fireEvent.change(screen.getByLabelText("Set 2, juegos del equipo 1"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Set 2, juegos del equipo 2"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Set 3, juegos del equipo 1"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Set 3, juegos del equipo 2"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar resultado/ }));

    await waitFor(() =>
      expect(svc.bookings.setResult).toHaveBeenCalledWith("b1", {
        set1Home: 6, set1Away: 4, set2Home: 4, set2Away: 6, set3Home: 10, set3Away: 7,
      }),
    );
  });

  it("si el SPA ya se calculó, lo avisa antes de corregir", async () => {
    await renderDetail({ ...PLAYED, result: { ...PLAYED.result, finalizedAt: "x", processedLspaAt: "2026-10-27T10:00:00.000Z" } });
    fireEvent.click(await screen.findByRole("button", { name: /Corregir resultado/ }));
    expect(screen.getByRole("note")).toHaveTextContent("El SPA ya se calculó con el resultado anterior");
  });

  it("sin resultado ofrece ponerlo; pasado el plazo, ya no", async () => {
    await renderDetail({ ...PLAYED, result: null, status: "WITHOUT_RESULT" });
    expect(await screen.findByText("Sin resultado.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Poner resultado/ })).toBeInTheDocument();
  });

  it("en una no competitiva (p. ej. apuntada ya empezada) dice que el resultado no puntúa, y se puede poner", async () => {
    await renderDetail({ ...PLAYED, isCompetitive: false, result: null });
    expect(await screen.findByText(/el resultado se guarda, pero no puntúa/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Poner resultado/ })).toBeInTheDocument();
  });

  it("en una competitiva no sale esa nota", async () => {
    await renderDetail(PLAYED);
    await screen.findByText("6-4 · 6-3");
    expect(screen.queryByText(/no puntúa en el SPA/)).not.toBeInTheDocument();
  });

  it("pasado el plazo de 30 días no se puede tocar", async () => {
    await renderDetail({ ...PLAYED, resultAdminDeadlineAt: "2020-01-01T00:00:00.000Z" });
    expect(await screen.findByText("6-4 · 6-3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir resultado/ })).not.toBeInTheDocument();
  });
});

describe("Cancelar una reserva (UX-08): diálogo centrado, no en línea al final de la página", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    meMock.data = { id: "club-admin", name: "Gestor" };
    svc.bookings.detail.mockResolvedValue(BOOKING);
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 1 });
    svc.bookings.cancel.mockResolvedValue({});
  });

  const dialog = () => screen.getByRole("dialog", { name: "¿Cancelar esta reserva?" });

  it("ficha: «Cancelar reserva» abre un diálogo con el foco dentro, el aviso, qué reserva es y el motivo", async () => {
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));

    expect(dialog()).toHaveFocus();
    expect(within(dialog()).getByText("Se avisará por push y email a 2 jugadores.")).toBeInTheDocument();
    expect(within(dialog()).getByText("Pista 1 · lun, 2 nov · 18:00 - 19:30")).toBeInTheDocument();
    expect(within(dialog()).getByPlaceholderText("Motivo (opcional, visible al jugador)")).toBeInTheDocument();
  });

  it("ficha: Escape lo cierra sin cancelar y el foco vuelve al botón", async () => {
    await renderDetail();
    const trigger = await screen.findByRole("button", { name: /Cancelar reserva/ });
    trigger.focus();
    fireEvent.click(trigger);
    expect(dialog()).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(svc.bookings.cancel).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("ficha: «No, volver» cierra sin cancelar, y al abrirla otra vez el motivo está vacío", async () => {
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));
    fireEvent.change(within(dialog()).getByPlaceholderText(/Motivo/), { target: { value: "Lluvia" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "No, volver" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(svc.bookings.cancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar reserva/ }));
    expect(within(dialog()).getByPlaceholderText(/Motivo/)).toHaveValue("");
  });

  it("ficha: «Sí, cancelar reserva» manda el motivo, avisa y cierra", async () => {
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));
    fireEvent.change(within(dialog()).getByPlaceholderText(/Motivo/), { target: { value: "Pista en obras" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

    await waitFor(() => expect(svc.bookings.cancel).toHaveBeenCalledWith("b1", "Pista en obras"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Reserva cancelada — jugadores notificados");
  });

  it("ficha: sin motivo, no manda ninguno", async () => {
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

    await waitFor(() => expect(svc.bookings.cancel).toHaveBeenCalledWith("b1", undefined));
  });

  describe("reserva cobrada: devolución al cancelar", () => {
    const PAID = {
      ...BOOKING,
      paymentMethod: "CASH_AT_VENUE",
      paidAt: "2026-10-27T10:00:00.000Z",
      paidAmountCents: 1800,
      priceCents: 2000,
    };
    const openDialog = async (booking: object) => {
      svc.bookings.detail.mockResolvedValue(booking);
      await renderDetail();
      fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));
    };

    it("pide el importe a devolver (opcional) y dice lo cobrado, no el precio", async () => {
      await openDialog(PAID);
      expect(within(dialog()).getByLabelText("Importe a devolver")).toHaveValue("");
      expect(within(dialog()).getByText(/Cobrado: 18,00 €/)).toBeInTheDocument();
    });

    it("«Devolver lo cobrado» rellena el campo con lo cobrado y lo devuelto sale entero", async () => {
      await openDialog(PAID);
      fireEvent.click(within(dialog()).getByRole("button", { name: "Devolver lo cobrado (18,00 €)" }));
      expect(within(dialog()).getByLabelText("Importe a devolver")).toHaveValue("18,00");
      fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

      await waitFor(() => expect(svc.bookings.cancel).toHaveBeenCalledWith("b1", undefined, 1800));
    });

    it("lo devuelto va en céntimos junto al motivo", async () => {
      await openDialog(PAID);
      fireEvent.change(within(dialog()).getByPlaceholderText(/Motivo/), { target: { value: "Lluvia" } });
      fireEvent.change(within(dialog()).getByLabelText("Importe a devolver"), { target: { value: "12,50" } });
      fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

      await waitFor(() => expect(svc.bookings.cancel).toHaveBeenCalledWith("b1", "Lluvia", 1250));
    });

    it("sin escribir nada, cancela sin devolución (como siempre)", async () => {
      await openDialog(PAID);
      fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

      await waitFor(() => expect(svc.bookings.cancel).toHaveBeenCalledWith("b1", undefined));
    });

    it("más de lo cobrado: avisa y no cancela", async () => {
      await openDialog(PAID);
      fireEvent.change(within(dialog()).getByLabelText("Importe a devolver"), { target: { value: "18,01" } });

      expect(within(dialog()).getByRole("alert")).toHaveTextContent("No puedes devolver más de lo cobrado (18,00 €)");
      fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));
      expect(svc.bookings.cancel).not.toHaveBeenCalled();
    });

    it("un importe que no es un importe: avisa y no cancela", async () => {
      await openDialog(PAID);
      fireEvent.change(within(dialog()).getByLabelText("Importe a devolver"), { target: { value: "doce" } });

      expect(within(dialog()).getByRole("alert")).toHaveTextContent("Escribe un importe válido");
      fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));
      expect(svc.bookings.cancel).not.toHaveBeenCalled();
    });

    it.each([
      ["sin cobrar", BOOKING],
      ["pagada con una sesión de bono (no hay dinero que devolver)", { ...PAID, paymentMethod: "VOUCHER", paidAmountCents: 0 }],
    ])("%s: no pide devolución", async (_label, booking) => {
      await openDialog(booking);
      expect(within(dialog()).queryByLabelText("Importe a devolver")).not.toBeInTheDocument();
      expect(within(dialog()).queryByRole("button", { name: /Devolver lo cobrado/ })).not.toBeInTheDocument();
    });
  });

  it("si el back la rechaza, enseña su mensaje y el diálogo sigue abierto", async () => {
    svc.bookings.cancel.mockRejectedValue({ response: { data: { message: "La reserva ya estaba cancelada" } } });
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La reserva ya estaba cancelada"));
    expect(dialog()).toBeInTheDocument();
  });

  it("listado: «Cancelar» de una reserva abre el mismo diálogo y, al confirmar, vuelve a pedir el listado", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(dialog()).toHaveFocus();
    expect(within(dialog()).getByText("Se avisará por push y email a 2 jugadores.")).toBeInTheDocument();
    const loads = svc.bookings.list.mock.calls.length;
    fireEvent.change(within(dialog()).getByPlaceholderText(/Motivo/), { target: { value: "Torneo" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Sí, cancelar reserva" }));

    await waitFor(() => expect(svc.bookings.cancel).toHaveBeenCalledWith("b1", "Torneo"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(svc.bookings.list.mock.calls.length).toBeGreaterThan(loads));
  });

  it("listado: Escape cierra el diálogo sin cancelar", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(svc.bookings.cancel).not.toHaveBeenCalled();
  });
});

describe("Zona del club (B1): un club en Canarias", () => {
  // El navegador, en Madrid: ni la zona fija de antes ni la del navegador dan lo esperado
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TZ = "Europe/Madrid";
    clubsMock.findOne.mockResolvedValue(club("Atlantic/Canary"));
    meMock.data = { id: "club-admin", name: "Gestor" };
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 1 });
  });

  afterEach(() => {
    process.env.TZ = "Atlantic/Canary";
  });

  it("listado: «hoy» es el día de Canarias y cada reserva va a su hora", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByText("17:00 - 18:30")).toBeInTheDocument();
    expect(clubsMock.findOne).toHaveBeenCalledWith("c1");
    expect(svc.bookings.list).toHaveBeenCalledWith(
      expect.objectContaining({ fromDate: "2026-10-28T00:00:00.000Z", toDate: "2026-10-28T23:59:59.999Z" }),
    );
  });

  it("listado: sin saber aún la zona del club no se piden reservas ni se pinta ninguna hora", async () => {
    clubsMock.findOne.mockReturnValue(new Promise(() => {}));
    wrap(<BookingsListPage />);
    await waitFor(() => expect(clubsMock.findOne).toHaveBeenCalled());
    expect(svc.bookings.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Hoy" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear reserva/ })).not.toBeInTheDocument();
  });

  it("listado: si no llegan los datos del club, lo dice y se puede reintentar", async () => {
    clubsMock.findOne.mockRejectedValueOnce(new Error("500"));
    wrap(<BookingsListPage />);
    expect(await screen.findByText("No se pudieron cargar los datos del club.")).toBeInTheDocument();
    expect(svc.bookings.list).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("17:00 - 18:30")).toBeInTheDocument();
  });

  it("detalle: el día, las horas, el cobro, los plazos y las fechas de la reserva, en la hora de Canarias", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING,
      status: "COMPLETED",
      paymentMethod: "CASH_AT_VENUE",
      // 23:30 del 27 en Canarias; en Madrid ya es el 28
      paidAt: "2026-10-27T23:30:00.000Z",
      resultAdminDeadlineAt: "2099-01-01T00:30:00.000Z",
      resultEntryDeadlineAt: "2099-01-01T00:30:00.000Z",
      result: null,
    });
    await renderDetail();

    expect(await screen.findByText("Lunes, 2 de noviembre de 2026")).toBeInTheDocument();
    expect(screen.getByText(/17:00 – 18:30 · 90 min/)).toBeInTheDocument();
    expect(screen.getByText(/pagada 27\/10\/2026/)).toBeInTheDocument();
    // Creada y actualizada
    expect(screen.getAllByText("28/10/2026, 10:00")).toHaveLength(2);
    expect(screen.getByText("Hasta el 1/1/99, 0:30")).toBeInTheDocument();
  });

  it("detalle: sin saber aún la zona del club no se pinta ninguna fecha", async () => {
    clubsMock.findOne.mockReturnValue(new Promise(() => {}));
    svc.bookings.detail.mockResolvedValue(BOOKING);
    await renderDetail();
    await waitFor(() => expect(svc.bookings.detail).toHaveBeenCalled());
    expect(screen.queryByText(/2 de noviembre/)).not.toBeInTheDocument();
    expect(screen.queryByText(/18:30/)).not.toBeInTheDocument();
  });
});

// ── Quien solo lee las reservas (Entrenador) no ve los botones que escriben ─────

describe("Reservas con un rol de solo lectura", () => {
  const asRole = (role: string) =>
    ({
      id: "staff", name: "Equipo", activeClubId: "c1",
      clubs: [{ clubId: "c1", clubName: "Club Centro", roles: [role] }],
    }) as unknown as typeof meMock.data;

  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 1 });
    svc.bookings.detail.mockResolvedValue({ ...BOOKING, clubCustomerId: "cc1" });
  });

  it("listado, Entrenador: ni «Crear reserva», ni casillas, ni «Cancelar», ni su columna", async () => {
    meMock.data = asRole("COACH");
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    expect(screen.queryByRole("button", { name: /Crear reserva/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Seleccionar todas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Seleccionar la reserva/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cancelar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Acciones" })).not.toBeInTheDocument();
    // Lo que sí ve: la reserva
    expect(screen.getByText("18:00 - 19:30")).toBeInTheDocument();
  });

  it("listado, Recepción (escribe las reservas): «Crear reserva», casilla y «Cancelar»", async () => {
    meMock.data = asRole("RECEPTION");
    wrap(<BookingsListPage />);
    await screen.findByText(/AMT-XP9W/);
    expect(screen.getByRole("button", { name: /Crear reserva/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Seleccionar la reserva/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeInTheDocument();
  });

  it("ficha, Entrenador: ni cambiar hora, ni cancelar, ni cobrar, ni pagar con bono", async () => {
    meMock.data = asRole("COACH");
    await renderDetail();
    await screen.findByText("Lunes, 2 de noviembre de 2026");
    for (const name of [/Cambiar hora o pista/, /Cancelar reserva/, /Cobrar/, /Pagar con bono/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("ficha, Recepción: cambiar hora, cancelar, cobrar y pagar con bono", async () => {
    meMock.data = asRole("RECEPTION");
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING,
      clubCustomerId: "cc1",
      startsAt: "2099-01-01T17:00:00.000Z",
      endsAt: "2099-01-01T18:30:00.000Z",
    });
    await renderDetail();
    for (const name of [/Cambiar hora o pista/, /Cancelar reserva/, /Cobrar/, /Pagar con bono/]) {
      expect(await screen.findByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("ficha de una cobrada, Entrenador: sin «Marcar como no pagada»", async () => {
    meMock.data = asRole("COACH");
    svc.bookings.detail.mockResolvedValue({ ...BOOKING, paymentMethod: "CASH_AT_VENUE", paidAt: "2026-10-27T10:00:00.000Z" });
    await renderDetail();
    expect(await screen.findByText("(En el club)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como no pagada/ })).not.toBeInTheDocument();
  });

  it("ficha con resultado, Entrenador: lo ve, pero no «Corregir resultado»", async () => {
    meMock.data = asRole("COACH");
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING,
      status: "COMPLETED",
      isCompetitive: true,
      resultAdminDeadlineAt: "2099-01-01T00:00:00.000Z",
      resultEntryDeadlineAt: "2099-01-01T00:00:00.000Z",
      result: {
        set1Home: 6, set1Away: 4, set2Home: 6, set2Away: 3, set3Home: null, set3Away: null, winnerTeam: 1,
        enteredByUserId: "u1", enteredAt: "", finalizedAt: null, processedLspaAt: null,
      },
    });
    await renderDetail();
    expect(await screen.findByText(/6-4/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir resultado|Poner resultado/ })).not.toBeInTheDocument();
  });
});

describe("Detalle de reserva con el módulo Cuentas", () => {
  const ON = { ...club("Europe/Madrid"), accountsEnabled: true };
  const PARTS_VIEW = {
    bookingId: "b1", priceCents: 2000, courtType: "DOUBLES", defaultCount: 4, status: "CONFIRMED",
    startsAt: "2026-11-02T17:00:00.000Z", parts: [],
    totals: { partsCents: 0, discountCents: 0, collectedCents: 0, pendingCents: 0, debtCents: 0, invitedCents: 0, adjustmentCents: 0 },
    priceOptions: [], member: { discountPercent: 0, offered: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue(ON);
    meMock.data = { id: "club-admin", name: "Gestor" };
    svc.bookings.detail.mockResolvedValue({ ...BOOKING, clubCustomerId: "cc1", partsSummary: null });
    partsSvc.view.mockResolvedValue(PARTS_VIEW);
    accountsSvc.partners.list.mockResolvedValue([]);
  });

  it("sin cobrar, enseña la hoja de cobro («Cobrar todo» / «Por jugadores») y no el botón «Cobrar» de siempre", async () => {
    await renderDetail();
    expect(await screen.findByRole("tab", { name: "Cobrar todo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Por jugadores" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cobrar$/ })).not.toBeInTheDocument();
    // Una reserva entera sigue pudiéndose pagar con bono
    expect(screen.getByRole("button", { name: /Pagar con bono/ })).toBeInTheDocument();
  });

  it("con el módulo apagado, la ficha es la de siempre: «Cobrar» y ninguna hoja", async () => {
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    await renderDetail();
    expect(await screen.findByRole("button", { name: /Cobrar/ })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Por jugadores" })).not.toBeInTheDocument();
    expect(partsSvc.view).not.toHaveBeenCalled();
  });

  it("con el módulo apagado pero con partes, la ficha sigue enseñando su hoja y se puede operar con ella", async () => {
    clubsMock.findOne.mockResolvedValue(club("Europe/Madrid"));
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING, clubCustomerId: "cc1",
      partsSummary: { count: 1, paid: 0, pending: 1, debt: 0, invited: 0 },
    });
    partsSvc.view.mockResolvedValue({
      ...PARTS_VIEW,
      parts: [{
        id: "p1", position: 1, kind: "NORMAL", partPriceId: null, partPriceName: null, priceCents: 2000, reason: null,
        status: "PENDING", clubCustomerId: null, customerName: null, label: null, isStudent: false, isMember: false,
        paymentMethod: null, bizumPartnerId: null, bizumPartnerName: null, paidAt: null, paidByName: null,
        refundedAt: null, refundAmountCents: null, debtId: null, debtStatus: null,
      }],
    });
    await renderDetail();
    expect(await screen.findByRole("tab", { name: "Por jugadores" })).toBeInTheDocument();
    expect(partsSvc.view).toHaveBeenCalled();
    expect(accountsSvc.partners.list).not.toHaveBeenCalled();
  });

  it("cobrada por partes: se lee «Varios» con sus partes y no se ofrece ni cobrar entera, ni bono, ni «no pagada»", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING, clubCustomerId: "cc1", paymentMethod: "MIXED", paidAt: "2026-11-02T18:00:00.000Z", paidAmountCents: 1500,
      partsSummary: { count: 4, paid: 3, pending: 0, debt: 1, invited: 0 },
    });
    partsSvc.view.mockResolvedValue({ ...PARTS_VIEW, parts: [] });
    await renderDetail();
    expect(await screen.findByText("(Varios)")).toBeInTheDocument();
    expect(screen.getByText(/3 cobradas, 1 debe/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pagar con bono|Marcar como no pagada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Cobrar$/ })).not.toBeInTheDocument();
  });

  it("con algo a deber no pone «pagada»: dice «Cobrada · 5,50 € a deber»; sin deuda, sigue «pagada»", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING, clubCustomerId: "cc1", paymentMethod: "MIXED", paidAt: "2026-11-02T18:00:00.000Z", paidAmountCents: 1500,
      partsSummary: { count: 4, paid: 3, pending: 0, debt: 1, invited: 0, debtCents: 550 },
    });
    partsSvc.view.mockResolvedValue({ ...PARTS_VIEW, parts: [] });
    await renderDetail();
    expect(await screen.findByText(/Cobrada · 5,50 € a deber/)).toBeInTheDocument();
    expect(screen.queryByText(/· pagada/)).not.toBeInTheDocument();
  });

  it("una reserva cobrada entera por Bizum dice a qué móvil llegó", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING, paymentMethod: "BIZUM", paidAt: "2026-11-02T18:00:00.000Z", bizumPartnerName: "Socio B",
    });
    await renderDetail();
    expect(await screen.findByText("(Bizum · Socio B)")).toBeInTheDocument();
  });

  it("un rol sin caja (Recepción sí; Entrenador no) no ve la hoja", async () => {
    meMock.data = {
      id: "coach", name: "Profe", activeClubId: "c1",
      clubs: [{ clubId: "c1", clubName: "Club Centro", roles: ["COACH"] }],
    } as unknown as typeof meMock.data;
    await renderDetail();
    await screen.findByText("Lunes, 2 de noviembre de 2026");
    expect(screen.queryByRole("tab", { name: "Por jugadores" })).not.toBeInTheDocument();
  });

  it("cancelar una reserva cobrada por partes no ofrece devolver la reserva entera: avisa de que se devuelve parte a parte", async () => {
    svc.bookings.detail.mockResolvedValue({
      ...BOOKING, paymentMethod: "MIXED", paidAt: "2026-11-02T18:00:00.000Z", paidAmountCents: 1500,
      partsSummary: { count: 4, paid: 3, pending: 0, debt: 1, invited: 0 },
    });
    await renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Importe a devolver")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/se cobró por partes/)).toBeInTheDocument();
  });
});
