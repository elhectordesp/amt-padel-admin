/**
 * Jugadores: un doble clic en «Crear jugador» creaba dos jugadores (P2-11).
 * El botón se desactiva con isPending, que llega tarde para el segundo clic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

const playersMock = vi.hoisted(() => ({
  list:       vi.fn(),
  create:     vi.fn(),
  bulkInvite: vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({ adminService: { players: playersMock } }));

import JugadoresPage from "../../../app/(admin)/jugadores/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <JugadoresPage />
    </QueryClientProvider>,
  );
}

describe("JugadoresPage — crear jugador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.list.mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50 });
  });

  it("un doble clic en «Crear jugador» crea uno solo", async () => {
    // El alta no termina mientras se hace el doble clic
    playersMock.create.mockReturnValue(new Promise(() => {}));
    renderPage();

    fireEvent.click(await screen.findByTitle("Nuevo jugador"));
    fireEvent.change(screen.getByPlaceholderText("Ej: Carlos"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("Ej: García López"), { target: { value: "López" } });

    const crear = screen.getByRole("button", { name: /crear jugador/i });
    fireEvent.click(crear);
    fireEvent.click(crear);

    await waitFor(() => expect(playersMock.create).toHaveBeenCalled());
    expect(playersMock.create).toHaveBeenCalledTimes(1);
  });
});
