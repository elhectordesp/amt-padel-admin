/**
 * Listado y detalle de reservas del club (R3-3):
 * - «Próximas» no trae las canceladas;
 * - quien rechazó o salió no cuenta como jugador;
 * - el aviso de cancelar dice a cuántos avisa de verdad el back (los que
 *   siguen y tienen cuenta, sin el propio club), y no da número hasta saber
 *   quién cancela;
 * - días y horas en hora del club (Madrid), como el calendario.
 *
 * Hoy es el 28/10/2026 a las 11:00 de Madrid y el navegador está en
 * Canarias: lo esperado va en literales, así que volver a la hora del
 * navegador haría fallar los tests.
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/components/admin/booking-create-dialog", () => ({ BookingCreateDialog: () => null }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const meMock = vi.hoisted(() => ({
  data: { id: "club-admin", name: "Gestor" } as { id: string; name: string } | undefined,
}));
vi.mock("@/lib/use-me", () => ({ useMe: () => meMock }));

const svc = vi.hoisted(() => ({
  bookings: { list: vi.fn(), detail: vi.fn(), cancel: vi.fn(), markPaid: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
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
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 1 });
  });

  it("«Hoy» es el día del club: de las 00:00 a las 23:59:59.999 de Madrid", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("AMT-XP9W");
    expect(svc.bookings.list).toHaveBeenCalledWith({
      clubId: "c1",
      limit: 50,
      fromDate: "2026-10-27T23:00:00.000Z",
      toDate: "2026-10-28T22:59:59.999Z",
    });
  });

  it("«Próximas» empieza al acabar el día del club e «Histórico» acaba al empezar", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("AMT-XP9W");
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
    expect(await screen.findByText(/lun, 2 nov · 18:00 - 19:30/)).toBeInTheDocument();
  });

  it("«Próximas» pide solo las que siguen en pie (sin canceladas)", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("AMT-XP9W");
    fireEvent.click(screen.getByRole("button", { name: "Próximas" }));

    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ statuses: ["PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"] }),
      ),
    );
  });

  it("quien rechazó no cuenta como jugador; el precio, con coma", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByText("4 jugadores · 20,00 €")).toBeInTheDocument();
  });

  it("con uno solo, «1 jugador» (antes «1 jugadores»)", async () => {
    svc.bookings.list.mockResolvedValue({
      items: [{ ...BOOKING, participants: [BOOKING.participants[1]] }],
      total: 1,
    });
    wrap(<BookingsListPage />);
    expect(await screen.findByText("1 jugador · 20,00 €")).toBeInTheDocument();
  });
});

describe("Detalle de reserva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
