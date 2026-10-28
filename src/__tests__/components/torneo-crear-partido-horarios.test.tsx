/**
 * Crear un partido desde un hueco de la rejilla de Horarios (P2-4), entrando
 * directamente en Horarios: el diálogo ofrece las parejas de la categoría y,
 * al crear, la ficha se queda en Horarios (antes saltaba al Cuadro).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// La rejilla real: aquí, un botón que crea en el hueco de las 10:00 de la Pista 2
vi.mock("@/components/admin/schedule-grid", () => ({
  ScheduleGrid: ({ onCreateAt }: { onCreateAt?: (t: { date: string; court: string }) => void }) => (
    <button onClick={() => onCreateAt?.({ date: "2026-11-20T10:00", court: "Pista 2" })}>Hueco 10:00</button>
  ),
}));

const TOURNAMENT = {
  id: "t-1",
  name: "Open de otoño",
  club: { id: "club-1", name: "Club Madrid", city: "Madrid" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "SCHEDULED",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "M", level: "4a", totalSpots: 8, occupiedCount: 2, waitlistCount: 0, currentPhase: "QF" },
  ],
  schedule: [],
  courts: ["Pista 1", "Pista 2"],
};
const MATCH = {
  id: "m-1",
  tournament: "t-1",
  categoryId: "c-1",
  phase: "QF",
  date: "2026-11-20T17:00:00.000Z",
  court: "Pista 1",
  team1: ["Ana", "Bea"],
  team2: ["Eva", "Fe"],
  isResult: false,
  status: "SCHEDULED",
};
const registration = (id: string, userId: string, user: string, partnerId: string, partner: string) => ({
  id,
  tournamentId: "t-1",
  categoryId: "c-1",
  userId,
  partnerId,
  user: { id: userId, name: user },
  partner: { id: partnerId, name: partner },
  status: "CONFIRMED",
});
const registrationsList = vi.fn(async () => [
  registration("r-1", "u-ana", "Ana López", "u-bea", "Bea Ruiz"),
  registration("r-2", "u-eva", "Eva Gil", "u-fe", "Fe Mora"),
]);
const createManualMatch = vi.fn(async () => ({ success: true, matchId: "m-2" }));
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: {
    adminDetail: async () => TOURNAMENT,
    createManualMatch: (...args: unknown[]) => createManualMatch(...(args as [])),
  },
  matches: { list: async () => [MATCH] },
  registrations: { list: () => registrationsList() },
};
vi.mock("@/lib/services/admin", () => ({
  adminService: new Proxy({}, {
    get: (_t, ns: string) =>
      new Proxy({}, { get: (_s, fn: string) => handlers[ns]?.[fn] ?? (async () => []) }),
  }),
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import TorneoDetailPage from "../../../app/(admin)/torneos/[id]/page";

describe("Horarios — crear partido desde un hueco (P2-4)", () => {
  it("ofrece las parejas sin pasar por Inscripciones y no salta al Cuadro", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TorneoDetailPage />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Horarios" }, WAIT));
    fireEvent.click(await screen.findByTitle("Vista grid (por pistas)", {}, WAIT));
    fireEvent.click(await screen.findByRole("button", { name: "Hueco 10:00" }, WAIT));

    const dialog = (await screen.findByText("Crear partido a mano", {}, WAIT)).closest("div.relative") as HTMLElement;
    const pair1 = within(dialog).getByLabelText("Pareja 1 (opcional)");
    await waitFor(() => expect(within(pair1).getByRole("option", { name: "Ana López / Bea Ruiz" })).toBeInTheDocument(), WAIT);
    fireEvent.change(pair1, { target: { value: "u-ana" } });
    fireEvent.change(within(dialog).getByLabelText("Pareja 2 (opcional)"), { target: { value: "u-eva" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Crear partido/ }));

    await waitFor(() => expect(createManualMatch).toHaveBeenCalledTimes(1), WAIT);
    const [tournamentId, body] = createManualMatch.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(tournamentId).toBe("t-1");
    expect(body).toMatchObject({
      categoryId: "c-1",
      team1: { userId: "u-ana", partnerId: "u-bea" },
      team2: { userId: "u-eva", partnerId: "u-fe" },
      court: "Pista 2",
    });
    // Sigue en Horarios, con la rejilla
    await waitFor(() => expect(screen.queryByText("Crear partido a mano")).not.toBeInTheDocument(), WAIT);
    expect(screen.getByRole("button", { name: "Hueco 10:00" })).toBeInTheDocument();
  }, 30_000);
});
