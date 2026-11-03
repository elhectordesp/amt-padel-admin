/**
 * Historial del torneo: cada acción con su etiqueta en español, no con el
 * código del back.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

const TOURNAMENT = {
  id: "t-1",
  name: "Open Castellón",
  club: { id: "club-1", name: "Club Castellón", city: "Castellón" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "OPEN",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "M", level: "4a", totalSpots: 8, occupiedCount: 0, waitlistCount: 0, currentPhase: "REGISTRATION" },
  ],
  schedule: [],
  courts: [],
};
// Una inscripción cancelada con pagos que se reutiliza: queda quién pagó
const REUSED_WITH_PAYMENTS = {
  id: "log-1",
  adminName: "Ana Jugadora",
  action: "INSCRIPCION_REUTILIZADA_CON_PAGOS",
  resource: "registration",
  resourceId: "reg-1",
  details: {
    tournamentId: "t-1",
    categoryId: "c-1",
    payments: [{ player: "titular", playerId: "u-1", method: "Efectivo", paidAt: null }],
  },
  createdAt: "2026-11-03T10:00:00.000Z",
};
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: { adminDetail: async () => TOURNAMENT, auditLog: async () => [REUSED_WITH_PAYMENTS] },
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

describe("Historial del torneo", { timeout: 30_000 }, () => {
  it("los pagos de una inscripción cancelada que se reutiliza salen con su etiqueta, no con el código", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TorneoDetailPage />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Más" }, WAIT));
    fireEvent.click(await screen.findByRole("button", { name: "Historial" }, WAIT));

    expect(await screen.findByText("Pagos de una cancelada", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(/INSCRIPCION_REUTILIZADA_CON_PAGOS/)).not.toBeInTheDocument();
  });
});
