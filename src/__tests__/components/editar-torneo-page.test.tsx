/**
 * Editar torneo con un torneo de Canarias (P8): el cierre se escribe y se
 * manda en la hora del torneo, no en la del navegador (los tests corren en
 * Europe/Madrid), y cambiar la zona con partidos con hora pide confirmación.
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
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "admin", clubId: null }),
  isClub: () => false,
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("@/components/admin/schedule-editor-dialog", () => ({ ScheduleEditorDialog: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CANARY_TOURNAMENT = {
  id: "t-1",
  name: "Open Gran Canaria",
  club: { id: "club-1", name: "Club Las Palmas", city: "Las Palmas", timezone: "Atlantic/Canary" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  // 20:00 de Canarias del 10-nov (+0)
  registrationDeadline: "2026-11-10T20:00:00.000Z",
  timezone: "Atlantic/Canary",
  status: "OPEN",
  tier: "BRONZE",
  categories: [],
  schedule: [],
};

const update = vi.fn().mockResolvedValue({ id: "t-1" });
let matches: unknown[] = [];
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      adminDetail: vi.fn(async () => CANARY_TOURNAMENT),
      update: (...args: unknown[]) => update(...args),
    },
    clubs: {
      list: vi.fn(async () => [CANARY_TOURNAMENT.club]),
      findOne: vi.fn(),
    },
    matches: { list: vi.fn(async () => matches) },
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

const deadlineInput = () => screen.getByDisplayValue("2026-11-10T20:00");
const saveButton = () => screen.getByRole("button", { name: /Guardar cambios/ });

describe("Editar torneo — zona del torneo", { timeout: 30_000 }, () => {
  beforeEach(() => {
    update.mockClear();
    matches = [];
  });

  it("el cierre se enseña en la hora de Canarias y se manda en ella: las 18:00 de noviembre son las 18:00 UTC", async () => {
    renderPage();
    fireEvent.change(await screen.findByDisplayValue("2026-11-10T20:00", {}, WAIT), {
      target: { value: "2026-11-10T18:00" },
    });
    fireEvent.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1), WAIT);
    expect(update.mock.calls[0][0]).toBe("t-1");
    expect(update.mock.calls[0][1]).toMatchObject({
      registrationDeadline: "2026-11-10T18:00:00.000Z",
      timezone: undefined,
    });
  });

  it("cambiar la zona con partidos con hora pide confirmación; el cierre no se manda (el back le conserva la hora del reloj)", async () => {
    matches = [{ id: "m-1", date: "2026-11-20T10:00:00.000Z", team1: [], team2: [] }];
    renderPage();
    await screen.findByDisplayValue("2026-11-10T20:00", {}, WAIT);

    fireEvent.click(screen.getByRole("button", { name: /^Canarias/ }));
    fireEvent.click(screen.getByRole("button", { name: /Península, Baleares/ }));
    // El cierre se queda como estaba: la misma hora del reloj
    expect(deadlineInput()).toBeInTheDocument();
    fireEvent.click(saveButton());

    expect(await screen.findByText("Cambio de zona horaria", {}, WAIT)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, cambiar la zona" }));

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1), WAIT);
    expect(update.mock.calls[0][1]).toMatchObject({
      timezone: "Europe/Madrid",
      registrationDeadline: undefined,
    });
  });

  it("sin partidos con hora, cambia la zona sin preguntar", async () => {
    renderPage();
    await screen.findByDisplayValue("2026-11-10T20:00", {}, WAIT);

    fireEvent.click(screen.getByRole("button", { name: /^Canarias/ }));
    fireEvent.click(screen.getByRole("button", { name: /Península, Baleares/ }));
    fireEvent.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1), WAIT);
    expect(screen.queryByText("Cambio de zona horaria")).not.toBeInTheDocument();
    expect(update.mock.calls[0][1]).toMatchObject({ timezone: "Europe/Madrid" });
  });
});

describe("Editar torneo — Avanzado: el estado", { timeout: 30_000 }, () => {
  it("dice qué cambios son los habituales desde el estado guardado y marca los que piden forzar", async () => {
    renderPage();
    // Abierto: lo habitual es Sorteo o Cancelado
    expect(
      await screen.findByText("Desde «Abierto», lo habitual es pasar a «Sorteo», «Cancelado». Los demás cambios piden confirmar al guardar.", {}, WAIT),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abierto \(Inscripciones\)/ }));
    expect(screen.getByRole("button", { name: /Sorteo \(Generando cuadro\)$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /En curso · pide forzar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Borrador · pide forzar/ })).toBeInTheDocument();
  });
});
