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
// Cada paso valida y vuelve a pintar el asistente: con toda la suite a la
// vez puede tardar más del segundo por defecto de findBy
const WAIT = { timeout: 5000 };
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
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open Gran Canaria" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-21" } });
    next();
    // Paso 2: categorías (la de por defecto vale)
    await screen.findByLabelText("Plazas", {}, WAIT);
    next();
    // Paso 3: configuración, con la zona del club
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    expect(await screen.findByText("Hora del torneo (Canarias)", {}, WAIT)).toBeInTheDocument();
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    // Paso 4: jornadas (las genera de las fechas) y 5: confirmar
    await screen.findByText("Horarios por jornada", {}, WAIT);
    next();
    await screen.findByRole("button", { name: /Crear torneo/ }, WAIT);
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    expect(create.mock.calls[0][0]).toMatchObject({
      clubId: "club-1",
      timezone: "Atlantic/Canary",
      registrationDeadline: "2099-11-10T20:00:00.000Z",
    });
  }, 30_000);
});

describe("Crear torneo — tramos del paso 4 (P2-10)", () => {
  it("«Añadir tramo» no repite el de por defecto, y un solape se dice en el tramo", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
    await screen.findByDisplayValue("Club Las Palmas — Las Palmas", {}, WAIT);
    fireEvent.change(input("name"), { target: { value: "Open de un día" } });
    fireEvent.change(input("startDate"), { target: { value: "2099-11-20" } });
    fireEvent.change(input("endDate"), { target: { value: "2099-11-20" } });
    next();
    await screen.findByLabelText("Plazas", {}, WAIT);
    next();
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    fireEvent.change(input("registrationDeadline"), { target: { value: "2099-11-10T20:00" } });
    next();
    await screen.findByText("Horarios por jornada", {}, WAIT);

    // Antes añadía otro 16:00-21:00 y «Siguiente» no hacía nada sin decir por qué
    fireEvent.click(await screen.findByRole("button", { name: /Añadir tramo/ }, WAIT));
    const starts = () => screen.getAllByLabelText("Inicio del tramo") as HTMLInputElement[];
    const ends = () => screen.getAllByLabelText("Fin del tramo") as HTMLInputElement[];
    expect(starts().map((i) => i.value)).toEqual(["16:00", "09:00"]);
    expect(ends().map((i) => i.value)).toEqual(["21:00", "14:00"]);

    // Lo movemos encima del de la tarde: el error sale en ese tramo
    fireEvent.change(starts()[1], { target: { value: "17:00" } });
    fireEvent.change(ends()[1], { target: { value: "19:00" } });
    next();
    expect(await screen.findByText("Este bloque se solapa con otro de la misma jornada", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Hay tramos que corregir: revisa los marcados en rojo.")).toBeInTheDocument();

    // Al corregirlo, el error se va y se avanza
    fireEvent.change(starts()[1], { target: { value: "10:00" } });
    fireEvent.change(ends()[1], { target: { value: "13:00" } });
    await waitFor(() => expect(screen.queryByText("Este bloque se solapa con otro de la misma jornada")).not.toBeInTheDocument(), WAIT);
    next();
    expect(await screen.findByRole("button", { name: /Crear torneo/ }, WAIT)).toBeInTheDocument();
    expect(screen.getByText("16:00-21:00, 10:00-13:00")).toBeInTheDocument();
  }, 30_000);
});
