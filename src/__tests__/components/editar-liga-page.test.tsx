/**
 * Editar una liga: sus días de juego son de la semana, así que «Editar jornadas»
 * (una jornada por fecha) se sustituye por «Editar días de juego».
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

const state = vi.hoisted(() => ({ kind: "LEAGUE" as "LEAGUE" | "TOURNAMENT" }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "l-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "admin", clubId: null }),
  isClub: () => false,
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const tournament = () => ({
  id: "l-1",
  name: "Liga de invierno",
  kind: state.kind,
  groupsEndDate: "2027-02-01T00:00:00.000Z",
  club: { id: "club-1", name: "Club Madrid", city: "Madrid", timezone: "Europe/Madrid" },
  startDate: "2026-12-07T00:00:00.000Z",
  endDate: "2027-03-01T00:00:00.000Z",
  registrationDeadline: "2026-11-30T20:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "DRAFT",
  tier: "BRONZE",
  categories: [],
  schedule:
    state.kind === "LEAGUE"
      ? [{ id: "d1", label: "Lunes", date: null, weekday: 1, slots: ["18:00", "18:30"], maxUnavailableHours: 1 }]
      : [{ id: "d1", label: "Dic 7", date: "2026-12-07T00:00:00.000Z", slots: ["18:00", "18:30"], maxUnavailableHours: 1 }],
});

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { adminDetail: vi.fn(async () => tournament()), update: vi.fn(), updateSchedule: vi.fn() },
    clubs: { list: vi.fn(async () => [tournament().club]), findOne: vi.fn() },
    matches: { list: vi.fn(async () => []) },
  },
}));

import EditarTorneoPage from "../../../app/(admin)/torneos/[id]/editar/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <EditarTorneoPage />
    </QueryClientProvider>,
  );
}

describe("Editar liga — días de juego", { timeout: 30_000 }, () => {
  it("una liga edita sus días de la semana, no jornadas por fecha", async () => {
    state.kind = "LEAGUE";
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Editar días de juego" }, WAIT));

    expect(await screen.findByText("Días de juego de la liga", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lunes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Inicio de la franja del lunes")).toHaveValue("18:00");
    expect(screen.queryByRole("button", { name: "Editar jornadas" })).not.toBeInTheDocument();
  });

  it("un torneo sigue con «Editar jornadas»", async () => {
    state.kind = "TOURNAMENT";
    renderPage();
    expect(await screen.findByRole("button", { name: "Editar jornadas" }, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar días de juego" })).not.toBeInTheDocument();
  });
});
