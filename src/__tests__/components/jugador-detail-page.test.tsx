/**
 * Ficha del jugador: un jugador borrado o inexistente (404) dejaba la
 * pantalla en blanco (P3-7). Ahora dice «Jugador no encontrado», sin
 * reintentar; otro error se reintenta una vez, como el resto del panel.
 * Y «Editar datos» ante el 409 ACTIVE_PLAYER_EMAIL_REQUIRED del back, con
 * quien no tiene el género en su ficha y al cambiárselo (genderConflicts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

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
  // Más reintentos que el panel (retry: 1) y sin espera: si la ficha no fija
  // los suyos, se notaría en el número de llamadas
  const qc = new QueryClient({ defaultOptions: { queries: { retry: 3, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <JugadorDetailPage />
    </QueryClientProvider>,
  );
}

describe("JugadorDetailPage — jugador que no está", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.categoryHistory.mockResolvedValue([]);
    playersMock.registrations.mockResolvedValue([]);
    playersMock.auditLog.mockResolvedValue([]);
  });

  it("con un 404 dice «Jugador no encontrado», con enlace de vuelta, y no reintenta", async () => {
    playersMock.detail.mockRejectedValue(new ApiError("Jugador no encontrado", 404));
    renderPage();

    expect(await screen.findByText("Jugador no encontrado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver a jugadores/i })).toHaveAttribute("href", "/jugadores");
    expect(playersMock.detail).toHaveBeenCalledTimes(1);
  });

  it("con otro error dice que no se pudo cargar y reintenta una sola vez", async () => {
    playersMock.detail.mockRejectedValue(new ApiError("Error interno", 500));
    renderPage();

    expect(await screen.findByText("No se pudo cargar el jugador")).toBeInTheDocument();
    expect(playersMock.detail).toHaveBeenCalledTimes(2);
  });
});

describe("JugadorDetailPage — «Editar datos» y el email de quien ya usa la app", () => {
  const player = {
    id: "p-1", name: "Ana López", email: "ana@x.com", gender: "F", level: "3a",
    played: 0, wins: 0, points: 0, trend: "stable",
    managedByAdmin: true, activationStatus: "invited",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.categoryHistory.mockResolvedValue([]);
    playersMock.registrations.mockResolvedValue([]);
    playersMock.auditLog.mockResolvedValue([]);
  });

  it("si activó la cuenta mientras se editaba, dice el error del back y el formulario pasa a no dejar vaciarlo", async () => {
    const message = "Este jugador ya usa la app y entra con su email: no se le puede dejar sin él";
    playersMock.detail
      .mockResolvedValueOnce(player)
      // Al recargar: ya la ha activado
      .mockResolvedValue({ ...player, activationStatus: "active" });
    playersMock.update.mockRejectedValueOnce(new ApiError(message, 409, "ACTIVE_PLAYER_EMAIL_REQUIRED"));
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /editar datos/i }));
    fireEvent.change(screen.getByDisplayValue("ana@x.com"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(message));
    expect(playersMock.update).toHaveBeenCalledWith("p-1", expect.objectContaining({ email: null }));
    // Con sus datos al día, el formulario ya lo avisa y no deja guardar
    expect(await screen.findByText(/no se le puede dejar sin email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();
    expect(playersMock.detail).toHaveBeenCalledTimes(2);
  });
});

describe("JugadorDetailPage — el género de quien no lo tiene en su ficha", () => {
  // El back lo manda con gender 'M' y hasGender false
  const noGender = {
    id: "p-1", name: "Leo Martín", email: "leo@x.com", gender: "M", hasGender: false, level: "3a",
    played: 0, wins: 0, points: 0, trend: "stable", globalRank: 12,
    managedByAdmin: true, activationStatus: "invited",
  };
  const genderButton = (name: "Masculino" | "Femenino") => screen.getByRole("button", { name });

  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.categoryHistory.mockResolvedValue([]);
    playersMock.registrations.mockResolvedValue([]);
    playersMock.auditLog.mockResolvedValue([]);
    playersMock.update.mockResolvedValue({ genderConflicts: [] });
  });

  it("la ficha dice «Sin género», no «Masc.», también al cambiarle la categoría", async () => {
    playersMock.detail.mockResolvedValue(noGender);
    renderPage();

    expect(await screen.findByText("Sin género 3ª")).toBeInTheDocument();
    // Debajo del ranking global
    expect(screen.getByText("Sin género")).toBeInTheDocument();
    expect(screen.queryByText(/Masc\./)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cambiar categoría" }));
    expect(screen.getAllByText("Sin género 3ª")).toHaveLength(2);
  });

  it("«Editar datos» no marca ninguno, dice «Sin género» y guardar otro dato no le pone Masculino", async () => {
    playersMock.detail.mockResolvedValue(noGender);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /editar datos/i }));
    expect(genderButton("Masculino")).toHaveAttribute("aria-pressed", "false");
    expect(genderButton("Femenino")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/^Sin género: no juega masculina, femenina ni mixta/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("leo@x.com"), { target: { value: "leo.martin@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(playersMock.update).toHaveBeenCalledTimes(1));
    expect(playersMock.update.mock.calls[0][1]).toMatchObject({ email: "leo.martin@x.com" });
    expect(playersMock.update.mock.calls[0][1].gender).toBeUndefined();
  });

  it("si el organizador le elige uno, lo manda", async () => {
    playersMock.detail.mockResolvedValue(noGender);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /editar datos/i }));
    fireEvent.click(genderButton("Masculino"));
    expect(genderButton("Masculino")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/^Sin género:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => expect(playersMock.update).toHaveBeenCalledWith("p-1", expect.objectContaining({ gender: "M" })));
  });

  it("a quien lo tiene, marcado el suyo; sin cambiarlo no se manda y, cambiado, sí", async () => {
    playersMock.detail.mockResolvedValue({ ...noGender, gender: "F", hasGender: true });
    renderPage();

    expect(await screen.findByText("Fem. 3ª")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /editar datos/i }));
    expect(genderButton("Femenino")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/^Sin género:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(playersMock.update).toHaveBeenCalledTimes(1));
    expect(playersMock.update.mock.calls[0][1].gender).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: /editar datos/i }));
    fireEvent.click(genderButton("Masculino"));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(playersMock.update).toHaveBeenCalledTimes(2));
    expect(playersMock.update.mock.calls[1][1].gender).toBe("M");
  });
});

describe("JugadorDetailPage — al cambiarle el género, lo que ya no encaja", () => {
  const player = {
    id: "p-1", name: "Leo Martín", email: "leo@x.com", gender: "F", hasGender: true, level: "3a",
    played: 0, wins: 0, points: 0, trend: "stable",
    managedByAdmin: true, activationStatus: "invited",
  };
  const conflicts = [
    { registrationId: "r-1", tournamentId: "t-1", tournamentName: "Open de otoño", categoryLabel: "3ª Femenina", invitation: false },
    { registrationId: "r-2", tournamentId: "t-2", tournamentName: "Liga de invierno", categoryLabel: "2ª Mixta", invitation: true },
  ];

  async function saveAsMale() {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /editar datos/i }));
    fireEvent.click(screen.getByRole("button", { name: "Masculino" }));
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Datos del jugador actualizados."));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.detail.mockResolvedValue(player);
    playersMock.categoryHistory.mockResolvedValue([]);
    playersMock.registrations.mockResolvedValue([]);
    playersMock.auditLog.mockResolvedValue([]);
  });

  it("avisa con cada torneo y categoría, marca la invitación y dice qué hacer, hasta que se cierra", async () => {
    playersMock.update.mockResolvedValue({ gender: "M", genderConflicts: conflicts });
    await saveAsMale();

    expect(playersMock.update).toHaveBeenCalledWith("p-1", expect.objectContaining({ gender: "M" }));
    expect(toastMock.warning).toHaveBeenCalledTimes(1);
    const [title, options] = toastMock.warning.mock.calls[0];
    expect(title).toBe("Con su género nuevo ya no encaja en 2 inscripciones:");
    expect(options).toMatchObject({ duration: Infinity, closeButton: true });
    render(<div data-testid="aviso">{options.description}</div>);
    const aviso = within(screen.getByTestId("aviso"));
    expect(aviso.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Open de otoño · 3ª Femenina",
      "Liga de invierno · 2ª Mixta (invitación pendiente: ya no se podrá aceptar)",
    ]);
    expect(aviso.getByText("Muévelas a otra categoría o cámbiales la pareja en las inscripciones de cada torneo.")).toBeInTheDocument();
  });

  it("si todo encaja, solo dice que se ha guardado", async () => {
    playersMock.update.mockResolvedValue({ gender: "M", genderConflicts: [] });
    await saveAsMale();

    expect(toastMock.warning).not.toHaveBeenCalled();
  });
});

describe("JugadorDetailPage — textos sin códigos internos (P3-11)", () => {
  const player = {
    id: "p-1", name: "Ana López", email: "ana@x.com", gender: "F", level: "3a",
    played: 0, wins: 0, points: 0, trend: "stable",
    managedByAdmin: true, activationStatus: "invited",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.detail.mockResolvedValue(player);
    playersMock.categoryHistory.mockResolvedValue([]);
    playersMock.registrations.mockResolvedValue([]);
  });

  it("la actividad admin es una frase en español y la tendencia dice «Estable»", async () => {
    playersMock.auditLog.mockResolvedValue([
      { id: "l-1", adminName: "Admin AMT", action: "INVITE_REENVIADO", actionLabel: "reenvió la invitación a", resource: "player", createdAt: "2026-10-20T10:00:00.000Z" },
      // Un back anterior, sin etiqueta: el código legible
      { id: "l-2", adminName: "Admin AMT", action: "ACCION_NUEVA", resource: "player", createdAt: "2026-10-20T09:00:00.000Z" },
    ]);
    renderPage();

    expect(await screen.findByText("Reenvió la invitación a Ana López")).toBeInTheDocument();
    expect(screen.getByText("ACCION NUEVA")).toBeInTheDocument();
    expect(screen.getAllByText("Jugador")).toHaveLength(2);
    expect(screen.queryByText("INVITE REENVIADO")).not.toBeInTheDocument();
    expect(screen.getByText("Estable")).toBeInTheDocument();
    expect(screen.queryByText(/^stable$/i)).not.toBeInTheDocument();
  });
});
