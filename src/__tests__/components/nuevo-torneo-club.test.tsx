/**
 * Crear torneo como admin de AMT sin elegir club: el mensaje es en español
 * (zod daba el suyo en inglés, «Invalid input: expected string…»).
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
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { create: vi.fn() },
    clubs: {
      list: vi.fn(async () => [{ id: "club-1", name: "Club Madrid", city: "Madrid", timezone: "Europe/Madrid" }]),
      findOne: vi.fn(),
    },
  },
}));

import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";

const WAIT = { timeout: 5000 };

describe("Crear torneo — sin club elegido", () => {
  it("«Club requerido», sin el mensaje en inglés", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="name"]')!, { target: { value: "Open de otoño" } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="startDate"]')!, { target: { value: "2099-11-20" } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[name="endDate"]')!, { target: { value: "2099-11-21" } });
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(await screen.findByText("Club requerido", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid input/)).not.toBeInTheDocument();
    // Sigue en el paso 1
    expect(screen.getByText("Información básica")).toBeInTheDocument();
  }, 30_000);
});
