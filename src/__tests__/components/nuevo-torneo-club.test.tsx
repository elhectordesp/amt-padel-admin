/**
 * Crear torneo como admin de AMT sin elegir club: el mensaje es en español
 * (zod daba el suyo en inglés, «Invalid input: expected string…»). Al elegir
 * el club, el asistente empieza con sus opciones de torneo (B5-1).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "admin", clubId: null }),
  isClub: () => false,
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const getConfig = vi.fn(async (clubId: string) => ({
  id: "cfg-1",
  clubId,
  format: "eliminatoria",
  matchDuration: 60,
  hasShirts: false,
  useSeeding: false,
  requirePaymentToConfirm: false,
  categoryPrice: 25,
  categorySpots: 32,
  dayStartTime: "16:00",
  dayEndTime: "21:00",
  maxUnavailableTotalHours: 0,
  description: "Los torneos del Club Madrid",
  rules: null,
  participantsVisibility: "PUBLIC",
  showClubInsteadOfCourt: false,
  hideFromAppAfterDays: null,
}));
vi.mock("@/lib/services/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/admin")>("@/lib/services/admin");
  return {
    ...actual,
    adminService: {
      tournaments: { create: vi.fn() },
      clubs: {
        list: vi.fn(async () => [{ id: "club-1", name: "Club Madrid", city: "Madrid", timezone: "Europe/Madrid" }]),
        findOne: vi.fn(),
      },
      clubTournamentConfig: { get: (clubId: string) => getConfig(clubId) },
    },
  };
});

import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";

const WAIT = { timeout: 5000 };

function renderWizard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NuevoTorneoPage />
    </QueryClientProvider>,
  );
}

describe("Crear torneo — sin club elegido", () => {
  it("«Club requerido», sin el mensaje en inglés", async () => {
    renderWizard();
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="name"]')!, { target: { value: "Open de otoño" } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="startDate"]')!, { target: { value: "2099-11-20" } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="endDate"]')!, { target: { value: "2099-11-21" } });
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(await screen.findByText("Club requerido", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid input/)).not.toBeInTheDocument();
    // Sigue en el paso 1
    expect(screen.getByText("Información básica")).toBeInTheDocument();
    // Sin club no hay opciones que cargar
    expect(getConfig).not.toHaveBeenCalled();
  }, 30_000);
});

describe("Crear torneo — AMT elige el club (B5-1)", () => {
  it("al elegirlo en el paso 1, carga sus opciones y la descripción sale ya escrita", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Selecciona un club…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Club Madrid — Madrid" }, WAIT));

    expect(await screen.findByDisplayValue("Los torneos del Club Madrid", {}, WAIT)).toBeInTheDocument();
    expect(getConfig).toHaveBeenCalledWith("club-1");
  }, 30_000);
});
