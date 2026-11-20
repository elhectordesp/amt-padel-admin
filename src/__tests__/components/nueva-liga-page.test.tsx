/**
 * Nueva liga: el asistente de torneo en modo liga (`/ligas/nuevo`). Pide el
 * fin de la fase de grupos, con la regla del back, y manda el tipo LEAGUE.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const nav = vi.hoisted(() => ({ pathname: "/ligas/nuevo", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => nav.pathname,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "club-1" }),
  isClub: () => true,
}));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const create = vi.fn().mockResolvedValue({ id: "l-new" });
const CONFIG = {
  id: "__pending__",
  clubId: "club-1",
  format: "eliminatoria",
  matchDuration: 60,
  scoringFormat: "BEST_OF_3",
  hasShirts: false,
  useSeeding: false,
  requirePaymentToConfirm: false,
  categoryPrice: 25,
  categorySpots: 32,
  dayStartTime: "16:00",
  dayEndTime: "21:00",
  maxUnavailableTotalHours: 0,
  description: null as string | null,
  rules: null as string | null,
  participantsVisibility: "PUBLIC",
  showClubInsteadOfCourt: false,
  hideFromAppAfterDays: null as number | null,
};
vi.mock("@/lib/services/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/admin")>("@/lib/services/admin");
  return {
    ...actual,
    adminService: {
      tournaments: { create: (...args: unknown[]) => create(...args) },
      clubs: {
        list: vi.fn(async () => []),
        findOne: vi.fn(async () => ({ id: "club-1", name: "Club Madrid", city: "Madrid", timezone: "Europe/Madrid" })),
      },
      clubTournamentConfig: { get: vi.fn(async (clubId: string) => ({ ...CONFIG, clubId })) },
    },
  };
});

import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";

const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
const WAIT = { timeout: 15000 };
vi.setConfig({ testTimeout: 60_000 });
const next = () => fireEvent.click(screen.getByRole("button", { name: /Siguiente|Crear liga|Crear torneo/ }));

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NuevoTorneoPage />
    </QueryClientProvider>,
  );
};

describe("Nueva liga", () => {
  beforeEach(() => {
    create.mockClear();
    nav.push.mockClear();
    nav.pathname = "/ligas/nuevo";
  });

  it("pide el fin de la fase de grupos y no deja pasar sin él ni fuera de rango", async () => {
    renderPage();
    expect(await screen.findByText("Nueva liga")).toBeInTheDocument();
    await screen.findByDisplayValue("Club Madrid — Madrid", {}, WAIT);
    fireEvent.change(input("name")!, { target: { value: "Liga de invierno" } });
    fireEvent.change(input("startDate")!, { target: { value: "2099-12-01" } });
    fireEvent.change(input("endDate")!, { target: { value: "2100-03-01" } });

    next();
    expect(await screen.findByText("Indica el fin de la fase de grupos", {}, WAIT)).toBeInTheDocument();

    fireEvent.change(input("groupsEndDate")!, { target: { value: "2100-03-02" } });
    next();
    expect(await screen.findByText(/posterior al inicio y no posterior al fin de la liga/, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByLabelText("Plazas (parejas)")).not.toBeInTheDocument();
  }, 30_000);

  it("crea la liga con su tipo y el fin de grupos, y va a su ficha en /ligas", async () => {
    renderPage();
    await screen.findByDisplayValue("Club Madrid — Madrid", {}, WAIT);
    fireEvent.change(input("name")!, { target: { value: "Liga de invierno" } });
    fireEvent.change(input("startDate")!, { target: { value: "2099-12-01" } });
    fireEvent.change(input("groupsEndDate")!, { target: { value: "2100-02-01" } });
    fireEvent.change(input("endDate")!, { target: { value: "2100-03-01" } });
    next();
    await screen.findByLabelText("Plazas (parejas)", {}, WAIT);
    next();
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    fireEvent.change(input("registrationDeadline")!, { target: { value: "2099-11-20T20:00" } });
    next();
    await screen.findByRole("group", { name: "Días de la semana" }, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Lunes" }));
    next();
    await screen.findByRole("button", { name: /Crear liga/ }, WAIT);
    next();

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    expect(create.mock.calls[0][0]).toMatchObject({
      kind: "LEAGUE",
      groupsEndDate: "2100-02-01",
      startDate: "2099-12-01",
      endDate: "2100-03-01",
      // El formato del club (aquí, eliminatoria) no es el de una liga: grupos + fase final
      format: "grupos+eliminatoria",
    });
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/ligas/l-new"), WAIT);
  }, 60_000);

  it("el paso «Días de juego» pide días de la semana y franjas, no un día por fecha", async () => {
    renderPage();
    await screen.findByDisplayValue("Club Madrid — Madrid", {}, WAIT);
    fireEvent.change(input("name")!, { target: { value: "Liga de invierno" } });
    fireEvent.change(input("startDate")!, { target: { value: "2099-12-01" } });
    fireEvent.change(input("groupsEndDate")!, { target: { value: "2100-02-01" } });
    fireEvent.change(input("endDate")!, { target: { value: "2100-03-01" } });
    next();
    await screen.findByLabelText("Plazas (parejas)", {}, WAIT);
    next();
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    fireEvent.change(input("registrationDeadline")!, { target: { value: "2099-11-20T20:00" } });
    next();

    // Ni «Horarios por jornada» ni una jornada por cada fecha de la liga
    await screen.findByRole("group", { name: "Días de la semana" }, WAIT);
    expect(screen.queryByText("Horarios por jornada")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Inicio de la franja/)).not.toBeInTheDocument();

    // Sin ningún día no se avanza
    next();
    expect(await screen.findByText("Elige al menos un día de juego.", {}, WAIT)).toBeInTheDocument();

    // Lunes y jueves, con la franja del club por defecto; el jueves, otra franja
    fireEvent.click(screen.getByRole("button", { name: "Lunes" }));
    fireEvent.click(screen.getByRole("button", { name: "Jueves" }));
    expect(screen.getByLabelText("Inicio de la franja del lunes")).toHaveValue("16:00");
    expect(screen.getByLabelText("Fin de la franja del lunes")).toHaveValue("21:00");
    fireEvent.change(screen.getByLabelText("Inicio de la franja del jueves"), { target: { value: "18:00" } });
    next();

    await screen.findByRole("button", { name: /Crear liga/ }, WAIT);
    next();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1), WAIT);
    const payload = create.mock.calls[0][0];
    expect(payload.schedule).toEqual([
      { weekday: 1, maxUnavailableSlots: 0, blocks: [{ start: "16:00", end: "21:00" }] },
      { weekday: 4, maxUnavailableSlots: 0, blocks: [{ start: "18:00", end: "21:00" }] },
    ]);
    expect(payload.schedule.every((d: { date?: string }) => !("date" in d))).toBe(true);
  }, 60_000);

  it("una franja con la hora de fin antes que la de inicio no deja pasar", async () => {
    renderPage();
    await screen.findByDisplayValue("Club Madrid — Madrid", {}, WAIT);
    fireEvent.change(input("name")!, { target: { value: "Liga de invierno" } });
    fireEvent.change(input("startDate")!, { target: { value: "2099-12-01" } });
    fireEvent.change(input("groupsEndDate")!, { target: { value: "2100-02-01" } });
    fireEvent.change(input("endDate")!, { target: { value: "2100-03-01" } });
    next();
    await screen.findByLabelText("Plazas (parejas)", {}, WAIT);
    next();
    await waitFor(() => expect(input("registrationDeadline")).toBeTruthy(), WAIT);
    fireEvent.change(input("registrationDeadline")!, { target: { value: "2099-11-20T20:00" } });
    next();
    await screen.findByRole("group", { name: "Días de la semana" }, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Martes" }));
    fireEvent.change(screen.getByLabelText("Fin de la franja del martes"), { target: { value: "15:00" } });
    next();
    expect(
      await screen.findByText("El martes: en cada franja, la hora de inicio debe ser anterior a la de fin.", {}, WAIT),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear liga/ })).not.toBeInTheDocument();
  }, 60_000);

  it("en /torneos/nuevo no pide fin de grupos ni manda tipo", async () => {
    nav.pathname = "/torneos/nuevo";
    renderPage();
    expect(await screen.findByText("Nuevo torneo")).toBeInTheDocument();
    await screen.findByDisplayValue("Club Madrid — Madrid", {}, WAIT);
    expect(input("groupsEndDate")).toBeNull();
  }, 30_000);
});
