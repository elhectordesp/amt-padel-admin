/**
 * Opciones de torneo del club (B5-1): se cargan las del club, se editan y se
 * guardan todas; lo que no vale lo dice en el campo y no se manda, y sin
 * poder cargarlas no se enseña un formulario con unas supuestas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
const roleMock = vi.hoisted(() => ({ value: { role: "club", clubId: "c1" } as { role: string | null; clubId: string | null } }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => roleMock.value,
  isClub: (r: string) => r === "club",
}));
const configMock = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/services/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/admin")>("@/lib/services/admin");
  return { ...actual, adminService: { clubTournamentConfig: configMock } };
});

import MiClubTorneosPage from "../../../app/(admin)/mi-club/torneos/page";

const CONFIG = {
  id: "cfg-1",
  clubId: "c1",
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
  description: null,
  rules: "Puntualidad",
  participantsVisibility: "PUBLIC",
  showClubInsteadOfCourt: false,
  hideFromAppAfterDays: null,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MiClubTorneosPage />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };
const save = () => fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

describe("Opciones de torneo del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleMock.value = { role: "club", clubId: "c1" };
    configMock.get.mockResolvedValue(CONFIG);
    configMock.update.mockImplementation(async (_clubId: string, data: object) => ({ ...CONFIG, ...data }));
  });

  it("carga las del club, y guardar manda todas con lo cambiado (textos sin espacios en los bordes, vacíos como null)", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("Puntualidad", {}, WAIT)).toBeInTheDocument();
    expect(configMock.get).toHaveBeenCalledWith("c1");

    fireEvent.change(screen.getByLabelText("Sobre el torneo"), { target: { value: "  Open de otoño\nCon cena  " } });
    fireEvent.change(screen.getByLabelText("Normas"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Plazas"), { target: { value: "16" } });
    fireEvent.change(screen.getByLabelText("Inicio de cada jornada"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("radio", { name: /Solo los inscritos/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Mostrar el club en vez de la pista/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Quitarlo del listado de la app/ }));
    fireEvent.change(screen.getByLabelText("Días después del último día del torneo"), { target: { value: "7" } });
    save();

    await waitFor(() => expect(configMock.update).toHaveBeenCalledTimes(1), WAIT);
    expect(configMock.update.mock.calls[0][0]).toBe("c1");
    expect(configMock.update.mock.calls[0][1]).toEqual({
      format: "eliminatoria",
      matchDuration: 60,
      hasShirts: false,
      useSeeding: false,
      requirePaymentToConfirm: false,
      categoryPrice: 25,
      categorySpots: 16,
      dayStartTime: "09:00",
      dayEndTime: "21:00",
      maxUnavailableTotalHours: 0,
      description: "Open de otoño\nCon cena",
      rules: null,
      participantsVisibility: "REGISTERED_ONLY",
      showClubInsteadOfCourt: true,
      hideFromAppAfterDays: 7,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Opciones de torneo guardadas"), WAIT);
  });

  it("lo que no vale se dice en su campo y no se manda", async () => {
    renderPage();
    await screen.findByDisplayValue("Puntualidad", {}, WAIT);

    fireEvent.change(screen.getByLabelText("Fin de cada jornada"), { target: { value: "15:00" } });
    fireEvent.change(screen.getByLabelText("Plazas"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Quitarlo del listado de la app/ }));
    fireEvent.change(screen.getByLabelText("Días después del último día del torneo"), { target: { value: "400" } });
    save();

    expect(screen.getByText("La hora de fin debe ser posterior a la de inicio")).toBeInTheDocument();
    expect(screen.getByText("Entre 4 y 128 plazas")).toBeInTheDocument();
    expect(screen.getByText("Entre 0 y 365 días")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Revisa los campos marcados en rojo");
    expect(configMock.update).not.toHaveBeenCalled();
  });

  it("si no se pueden cargar, lo dice con «Reintentar» (sin formulario con valores supuestos)", async () => {
    configMock.get.mockRejectedValueOnce(new Error("Network Error"));
    renderPage();
    expect(await screen.findByText("No se pudieron cargar las opciones de torneo del club.", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByDisplayValue("Puntualidad", {}, WAIT)).toBeInTheDocument();
  });

  it("un admin de AMT no la usa: no hay club que cargar", async () => {
    roleMock.value = { role: "admin", clubId: null };
    renderPage();
    expect(await screen.findByText("Requiere usuario CLUB con club asignado.", {}, WAIT)).toBeInTheDocument();
    expect(configMock.get).not.toHaveBeenCalled();
  });
});
