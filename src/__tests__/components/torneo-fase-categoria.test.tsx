/**
 * La fase de una categoría por su nombre en la ficha del torneo (P3-11): en
 * «Fase actual por categoría» (Resumen) y en la cabecera de cada categoría de
 * la pestaña Cuadro salía «REGISTRATION». El endpoint del admin no manda
 * currentPhaseLabel.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const TOURNAMENT = {
  id: "t-1",
  name: "Open de otoño",
  club: { id: "club-1", name: "Club Madrid", city: "Madrid" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "OPEN",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "M", level: "4a", totalSpots: 8, occupiedCount: 2, confirmedCount: 0, waitlistCount: 0, currentPhase: "REGISTRATION", price: 20 },
  ],
  schedule: [],
  courts: [],
};
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: { adminDetail: async () => TOURNAMENT },
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

describe("Ficha del torneo — fase de la categoría por su nombre", { timeout: 30_000 }, () => {
  it("«Inscripciones» en el Resumen y en la cabecera del Cuadro, nunca «REGISTRATION»", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TorneoDetailPage />
      </QueryClientProvider>,
    );

    const summary = (await screen.findByText("Fase actual por categoría", {}, WAIT)).parentElement!;
    expect(within(summary).getByText("Inscripciones")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cuadro" }));
    const header = (await screen.findByRole("heading", { level: 4, name: /Masc\. 4ª/ }, WAIT)).parentElement!;
    expect(within(header).getByText("Inscripciones")).toBeInTheDocument();
    expect(screen.queryByText("REGISTRATION")).not.toBeInTheDocument();
  });
});
