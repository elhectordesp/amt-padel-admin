/**
 * Portada de Reservas del club (B1): la fecha de apertura al público va en
 * la zona del club, no en la del navegador; mientras no se sabe, no se pinta,
 * y si no llega, lo dice.
 *
 * El navegador está en Madrid (vitest.config) y el club, en Canarias.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const clubsMock = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));

const svc = vi.hoisted(() => ({ activation: { state: vi.fn() } }));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import MiClubReservasPage from "../../../app/(admin)/mi-club/reservas/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MiClubReservasPage />
    </QueryClientProvider>,
  );
}

describe("Portada de Reservas — zona del club (B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 23:30 del 1/10 en Canarias; en Madrid ya es el 2
    svc.activation.state.mockResolvedValue({
      bookingEnabled: true, bookingPublicAt: "2026-10-01T22:30:00.000Z", status: "PUBLIC", activeTesterCount: 0,
    });
  });

  it("abierto al público desde el día de Canarias", async () => {
    clubsMock.findOne.mockResolvedValue({ id: "c1", name: "Club Atlántico", timezone: "Atlantic/Canary" });
    renderPage();
    expect(await screen.findByText(/Desde 1\/10\/2026\./)).toBeInTheDocument();
  });

  it("sin saber aún la zona del club no se pinta la fecha", async () => {
    clubsMock.findOne.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => expect(svc.activation.state).toHaveBeenCalled());
    expect(screen.queryByText(/Visible públicamente/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\/10\/2026/)).not.toBeInTheDocument();
  });

  it("si no llegan los datos del club, lo dice (sin «Desde —») y se puede reintentar", async () => {
    clubsMock.findOne
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValue({ id: "c1", name: "Club Atlántico", timezone: "Atlantic/Canary" });
    renderPage();
    expect(await screen.findByText("No se pudieron cargar los datos del club.")).toBeInTheDocument();
    expect(screen.queryByText(/Desde/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText(/Desde 1\/10\/2026\./)).toBeInTheDocument();
    expect(screen.queryByText("No se pudieron cargar los datos del club.")).not.toBeInTheDocument();
  });
});
