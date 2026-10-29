/**
 * Activación + testers (R3-4): al añadir o quitar un tester, el estado del
 * módulo («Solo los N tester(s)…») se vuelve a pedir; antes seguía en 0
 * hasta recargar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    players: { search: vi.fn().mockResolvedValue([{ id: "u9", name: "Ana Tester", email: null }]) },
  },
}));

const svc = vi.hoisted(() => ({
  activation: { state: vi.fn(), request: vi.fn(), publish: vi.fn() },
  testers: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import ActivacionPage from "../../../app/(admin)/mi-club/reservas/activacion/page";

const state = (activeTesterCount: number) => ({
  bookingEnabled: true, bookingPublicAt: null, status: "TESTER_MODE", activeTesterCount,
});
const TESTER = {
  id: "t1", clubId: "c1", userId: "u1", validUntil: "2026-11-30T10:00:00.000Z", addedAt: "", addedByUserId: null,
  user: { id: "u1", name: "Luis", email: null },
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ActivacionPage />
    </QueryClientProvider>,
  );
}

describe("Activación + testers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("añadir un tester actualiza el contador del estado", async () => {
    svc.activation.state.mockResolvedValueOnce(state(0)).mockResolvedValue(state(1));
    svc.testers.list.mockResolvedValueOnce([]).mockResolvedValue([TESTER]);
    svc.testers.add.mockResolvedValue(TESTER);
    renderPage();
    expect(await screen.findByText(/Solo los 0 tester\(s\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    fireEvent.change(screen.getByPlaceholderText(/Buscar jugador AMT/), { target: { value: "Ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ana Tester/ }, { timeout: 2000 }));
    // El de abajo: el que añade (el de arriba abre y cierra el formulario)
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" }).at(-1)!);

    expect(await screen.findByText(/Solo los 1 tester\(s\)/)).toBeInTheDocument();
    expect(svc.testers.add).toHaveBeenCalledWith("c1", expect.objectContaining({ userId: "u9" }));
  });

  it("quitar un tester también lo actualiza", async () => {
    svc.activation.state.mockResolvedValueOnce(state(1)).mockResolvedValue(state(0));
    svc.testers.list.mockResolvedValueOnce([TESTER]).mockResolvedValue([]);
    svc.testers.remove.mockResolvedValue(undefined);
    renderPage();
    expect(await screen.findByText(/Solo los 1 tester\(s\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Eliminar"));

    await waitFor(() => expect(screen.getByText(/Solo los 0 tester\(s\)/)).toBeInTheDocument());
  });
});
