/**
 * Listado y detalle de reservas del club (R3-3):
 * - «Próximas» no trae las canceladas;
 * - quien rechazó o salió no cuenta como jugador;
 * - el aviso de cancelar dice a cuántos avisa de verdad el back (los que
 *   siguen y tienen cuenta, sin el propio club).
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
vi.mock("@/lib/use-me", () => ({ useMe: () => ({ data: { id: "club-admin", name: "Gestor" } }) }));

const svc = vi.hoisted(() => ({
  bookings: { list: vi.fn(), detail: vi.fn(), cancel: vi.fn(), markPaid: vi.fn(), setResult: vi.fn() },
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

describe("Listado de reservas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.bookings.list.mockResolvedValue({ items: [BOOKING], total: 1 });
  });

  it("«Próximas» pide solo las que siguen en pie, de la más cercana a la más lejana", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("AMT-XP9W");
    fireEvent.click(screen.getByRole("button", { name: "Próximas" }));

    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ statuses: ["PENDING_INVITES", "CONFIRMED", "IN_PROGRESS"], order: "asc" }),
      ),
    );
  });

  it("«Hoy» va por orden de hora; «Histórico», de la más reciente hacia atrás", async () => {
    wrap(<BookingsListPage />);
    await screen.findByText("AMT-XP9W");
    expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.objectContaining({ order: "asc" }));

    fireEvent.click(screen.getByRole("button", { name: "Histórico" }));
    await waitFor(() =>
      expect(svc.bookings.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ order: "asc" })),
    );
  });

  it("quien rechazó no cuenta como jugador", async () => {
    wrap(<BookingsListPage />);
    expect(await screen.findByText(/^4 jugadores/)).toBeInTheDocument();
  });
});

describe("Detalle de reserva", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.bookings.detail.mockResolvedValue(BOOKING);
  });

  it("al cancelar dice a cuántos jugadores avisa: los que siguen con cuenta, sin el club", async () => {
    // `use(params)` suspende hasta que se resuelve la promesa: dentro de act
    await act(async () => {
      wrap(<BookingDetailPage params={Promise.resolve({ id: "b1" })} />);
    });
    fireEvent.click(await screen.findByRole("button", { name: /Cancelar reserva/ }));

    expect(screen.getByText("Se avisará por push y email a 2 jugadores.")).toBeInTheDocument();
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

  it("pasado el plazo de 30 días no se puede tocar", async () => {
    await renderDetail({ ...PLAYED, resultAdminDeadlineAt: "2020-01-01T00:00:00.000Z" });
    expect(await screen.findByText("6-4 · 6-3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir resultado/ })).not.toBeInTheDocument();
  });
});
