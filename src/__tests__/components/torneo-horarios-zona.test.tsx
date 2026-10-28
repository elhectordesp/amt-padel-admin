/**
 * Horarios de un torneo de Canarias (P8): editar la hora de un partido y
 * moverlo en la rejilla mandan la hora de Canarias, no la del navegador (los
 * tests corren en Europe/Madrid).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// La ficha es grande: con toda la suite a la vez puede tardar más del segundo
// por defecto de findBy
const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const MATCH = {
  id: "m-1",
  tournament: "t-1",
  categoryId: "c-1",
  phase: "QF",
  // 18:00 de Canarias del 20-nov (+0)
  date: "2026-11-20T18:00:00.000Z",
  court: "Pista 1",
  team1: ["Ana", "Bea"],
  team2: ["Eva", "Fe"],
  isResult: false,
  status: "SCHEDULED",
};

// La rejilla real se arrastra con dnd-kit: aquí, un botón que mueve el
// partido a las 10:00 (hora del torneo) de su día, como hace la de verdad
vi.mock("@/components/admin/schedule-grid", () => ({
  ScheduleGrid: ({ matches, onMove }: { matches: unknown[]; onMove: (m: unknown, t: { date: string; court: string }) => void }) => (
    <button onClick={() => onMove(matches[0], { date: "2026-11-20T10:00", court: "Pista 2" })}>Mover a las 10:00</button>
  ),
}));

const patchMatch = vi.fn().mockResolvedValue({ conflicts: [] });
const TOURNAMENT = {
  id: "t-1",
  name: "Open Gran Canaria",
  club: { id: "club-1", name: "Club Las Palmas", city: "Las Palmas" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Atlantic/Canary",
  status: "SCHEDULED",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "M", level: "4a", totalSpots: 8, occupiedCount: 0, waitlistCount: 0, currentPhase: "QF" },
  ],
  schedule: [],
  courts: ["Pista 1", "Pista 2"],
};
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: { adminDetail: async () => TOURNAMENT },
  matches: { list: async () => [MATCH] },
  schedule: { patchMatch: (...args: unknown[]) => patchMatch(...args) },
};
// El resto de llamadas de la ficha: listas vacías
vi.mock("@/lib/services/admin", () => ({
  adminService: new Proxy({}, {
    get: (_t, ns: string) =>
      new Proxy({}, { get: (_s, fn: string) => handlers[ns]?.[fn] ?? (async () => []) }),
  }),
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import TorneoDetailPage from "../../../app/(admin)/torneos/[id]/page";

async function openHorarios() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TorneoDetailPage />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Horarios" }, WAIT));
}

describe("Horarios — hora del partido en la zona del torneo", { timeout: 30_000 }, () => {
  beforeEach(() => patchMatch.mockClear());

  it("el editor enseña las 18:00 de Canarias y guarda las 10:00 escritas como las 10:00 UTC", async () => {
    await openHorarios();
    fireEvent.click(await screen.findByRole("button", { name: "Editar fecha y pista" }, WAIT));
    const input = await screen.findByDisplayValue("2026-11-20T18:00", {}, WAIT);
    fireEvent.change(input, { target: { value: "2026-11-20T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(patchMatch).toHaveBeenCalledTimes(1), WAIT);
    expect(patchMatch.mock.calls[0][0]).toBe("m-1");
    expect(patchMatch.mock.calls[0][1]).toMatchObject({ date: "2026-11-20T10:00:00.000Z" });
  });

  it("mover en la rejilla manda la hora de Canarias", async () => {
    await openHorarios();
    fireEvent.click(await screen.findByTitle("Vista grid (por pistas)", {}, WAIT));
    fireEvent.click(await screen.findByRole("button", { name: "Mover a las 10:00" }, WAIT));

    await waitFor(() => expect(patchMatch).toHaveBeenCalledTimes(1), WAIT);
    expect(patchMatch.mock.calls[0][1]).toMatchObject({
      date: "2026-11-20T10:00:00.000Z",
      court: "Pista 2",
    });
  });
});
