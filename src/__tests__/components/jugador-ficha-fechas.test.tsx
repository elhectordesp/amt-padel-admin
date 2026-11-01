/**
 * Ficha del jugador: las fechas de sus partidos en la zona de cada torneo
 * (el back manda `timezone` en cada partido) y las de sus inscripciones como
 * fechas de calendario; antes, en la zona del navegador.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));

const playersMock = vi.hoisted(() => ({
  detail:           vi.fn(),
  categoryHistory:  vi.fn(),
  registrations:    vi.fn(),
  auditLog:         vi.fn(),
  update:           vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({ adminService: { players: playersMock } }));

import JugadorDetailPage from "../../../app/(admin)/jugadores/[id]/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <JugadorDetailPage />
    </QueryClientProvider>,
  );
}

describe("JugadorDetailPage — fechas en la zona de cada torneo", () => {
  const player = {
    id: "p-1", name: "Ana López", email: "ana@x.com", gender: "F", level: "3a",
    played: 1, wins: 1, points: 0, trend: "up",
    managedByAdmin: false, activationStatus: "active",
    matches: [
      // 23:30 UTC del 20-nov: en Canarias aún es el 20; en Madrid, ya el 21
      { id: "m-1", date: "2026-11-20T23:30:00.000Z", timezone: "Atlantic/Canary", tournament: "Open Gran Canaria", category: "3ª Femenina", isWinner: true, team1: ["Ana", "Bea"], team2: ["Eva", "Fe"], sets1: [6], sets2: [3] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.detail.mockResolvedValue(player);
    playersMock.categoryHistory.mockResolvedValue([]);
    playersMock.auditLog.mockResolvedValue([]);
    playersMock.registrations.mockResolvedValue([
      // Inicio guardado a la medianoche de España (antiguo): su día es el 20
      { id: "r-1", tournamentId: "t-1", tournament: "Open Gran Canaria", startDate: "2026-11-19T23:00:00.000Z", endDate: "2026-11-21T23:00:00.000Z", categoryId: "c-1", gender: "F", level: "3a", price: 20, status: "CONFIRMED", paid: true, createdAt: "2026-10-01T10:00:00.000Z" },
    ]);
  });

  it("el partido sale en el día de su torneo, la inscripción en su día de calendario y la categoría sin códigos", async () => {
    renderPage();
    expect(await screen.findByText("3ª Femenina")).toBeInTheDocument();
    // Partido (zona del torneo) e inscripción (fecha de calendario): los dos, el 20
    expect(screen.getAllByText("20/11/2026")).toHaveLength(2);
    expect(screen.queryByText("21/11/2026")).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Fem. 3ª" })).toBeInTheDocument();
  });
});
