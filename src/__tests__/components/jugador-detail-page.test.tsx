/**
 * Ficha del jugador: un jugador borrado o inexistente (404) dejaba la
 * pantalla en blanco (P3-7). Ahora dice «Jugador no encontrado», sin
 * reintentar; otro error se reintenta una vez, como el resto del panel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "p-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

const playersMock = vi.hoisted(() => ({
  detail:           vi.fn(),
  categoryHistory:  vi.fn(),
  registrations:    vi.fn(),
  auditLog:         vi.fn(),
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
