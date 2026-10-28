/**
 * Torneos eliminados con «Restaurar» (D12): se cargan al abrir la sección y
 * restaurar llama al back y refresca los listados de torneos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
const tournamentsMock = vi.hoisted(() => ({ deleted: vi.fn(), restore: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { tournaments: tournamentsMock } }));

import { DeletedTournaments } from "../../../components/admin/deleted-tournaments";

describe("DeletedTournaments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tournamentsMock.deleted.mockResolvedValue([
      {
        id: "t-9",
        name: "Open de primavera",
        status: "OPEN",
        startDate: "2026-04-10T00:00:00.000Z",
        endDate: "2026-04-12T00:00:00.000Z",
        deletedAt: "2026-10-27T09:30:00.000Z",
        club: { id: "club-1", name: "Club Norte" },
      },
    ]);
    tournamentsMock.restore.mockResolvedValue({ success: true });
  });

  it("no pide nada hasta abrirla; abierta, lista los borrados y restaura", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DeletedTournaments />
      </QueryClientProvider>,
    );
    expect(tournamentsMock.deleted).not.toHaveBeenCalled();

    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(await screen.findByText("Open de primavera")).toBeInTheDocument();
    expect(screen.getByText(/Club Norte · 10 abr – 12 abr 2026 · Abierto/)).toBeInTheDocument();
    // El instante del borrado, en hora de España (ya en invierno: 09:30Z son las 10:30)
    expect(screen.getByText(/Eliminado el 27 oct 2026, 10:30/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Restaurar/ }));
    await waitFor(() => expect(tournamentsMock.restore).toHaveBeenCalledWith("t-9"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Torneo restaurado"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tournaments"] });
  });

  it("sin borrados, lo dice", async () => {
    tournamentsMock.deleted.mockResolvedValue([]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DeletedTournaments />
      </QueryClientProvider>,
    );
    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(await screen.findByText("No hay torneos eliminados.")).toBeInTheDocument();
  });
});
