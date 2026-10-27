/**
 * Crear torneo de un club de Canarias (P8): la zona por defecto es la del
 * club, y el cierre escrito se manda en ella, no en la del navegador (los
 * tests corren en Europe/Madrid).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "club-1" }),
  isClub: () => true,
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const create = vi.fn().mockResolvedValue({ id: "t-new" });
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { create: (...args: unknown[]) => create(...args) },
    clubs: {
      list: vi.fn(async () => []),
      findOne: vi.fn(async () => ({
        id: "club-1",
        name: "Club Las Palmas",
        city: "Las Palmas",
        timezone: "Atlantic/Canary",
      })),
    },
  },
}));

import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";

const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
const next = () => fireEvent.click(screen.getByRole("button", { name: /Siguiente|Crear torneo/ }));

describe("Crear torneo — zona del club y cierre en ella", () => {
  it("club de Canarias: zona Canarias por defecto y las 20:00 del cierre en noviembre son las 20:00 UTC", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );

    // Paso 1: información (el club es el del usuario)
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas");
    fireEvent.change(input("name"), { target: { value: "Open Gran Canaria" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-21" } });
    next();
    // Paso 2: categorías (la de por defecto vale)
    await screen.findByLabelText("Plazas");
    next();
    // Paso 3: configuración, con la zona del club
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy());
    expect(await screen.findByText("Hora del torneo (Canarias)")).toBeInTheDocument();
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    // Paso 4: jornadas (las genera de las fechas) y 5: confirmar
    await screen.findByText("Horarios por jornada");
    next();
    await screen.findByRole("button", { name: /Crear torneo/ });
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create.mock.calls[0][0]).toMatchObject({
      clubId: "club-1",
      timezone: "Atlantic/Canary",
      registrationDeadline: "2099-11-10T20:00:00.000Z",
    });
  });
});
