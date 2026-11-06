/**
 * Activación + testers (R3-4): al añadir o quitar un tester, el estado del
 * módulo («Solo los N tester(s)…») se vuelve a pedir; antes seguía en 0
 * hasta recargar.
 *
 * Zona del club (B1): las fechas (apertura, fin de un tester) se enseñan y
 * se mandan en la zona del club, no en la de Madrid ni en la del navegador.
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
const clubsMock = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    clubs: clubsMock,
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
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Centro", timezone: "Europe/Madrid" });
  });

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

describe("Activación — zona del club (B1): un club en Canarias", () => {
  // El navegador, en Madrid (vitest.config): ni la zona fija de antes ni la del navegador dan lo esperado
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Atlántico", timezone: "Atlantic/Canary" });
  });

  it("el fin de un tester se enseña en la hora de Canarias y el que se escribe se manda en ella", async () => {
    svc.activation.state.mockResolvedValue(state(1));
    // 23:30 del 30/11 en Canarias; en Madrid, las 00:30 del 1/12
    svc.testers.list.mockResolvedValue([{ ...TESTER, validUntil: "2026-11-30T23:30:00.000Z" }]);
    svc.testers.add.mockResolvedValue(TESTER);
    renderPage();
    expect(await screen.findByText(/Hasta 30\/11\/26, 23:30/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Añadir" }));
    fireEvent.change(screen.getByPlaceholderText(/Buscar jugador AMT/), { target: { value: "Ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ana Tester/ }, { timeout: 2000 }));
    fireEvent.change(document.querySelector('input[type="datetime-local"]')!, { target: { value: "2026-12-01T10:00" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Añadir" }).at(-1)!);

    // Las 10:00 de Canarias en diciembre son las 10:00 UTC (en Madrid serían las 09:00)
    await waitFor(() =>
      expect(svc.testers.add).toHaveBeenCalledWith("c1", { userId: "u9", validUntil: "2026-12-01T10:00:00.000Z" }),
    );
  });

  it("la fecha de apertura al público, en el día de Canarias", async () => {
    // 23:30 del 1/10 en Canarias; en Madrid ya es el 2
    svc.activation.state.mockResolvedValue({
      bookingEnabled: true, bookingPublicAt: "2026-10-01T22:30:00.000Z", status: "PUBLIC", activeTesterCount: 0,
    });
    svc.testers.list.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/Activo desde 1\/10\/2026/)).toBeInTheDocument();
  });

  it("sin saber aún la zona del club no se pinta ninguna fecha", async () => {
    clubsMock.findOne.mockReturnValue(new Promise(() => {}));
    svc.activation.state.mockResolvedValue(state(1));
    svc.testers.list.mockResolvedValue([TESTER]);
    renderPage();
    await waitFor(() => expect(clubsMock.findOne).toHaveBeenCalled());
    expect(screen.queryByText(/Hasta/)).not.toBeInTheDocument();
    expect(svc.testers.list).not.toHaveBeenCalled();
  });
});
