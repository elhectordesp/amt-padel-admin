/**
 * Test del DashboardPage para verificar el role-gating:
 *  - CLUB ve etiquetas "Mis ..." (su club) y subtítulo de club
 *  - ADMIN ve etiquetas neutras (plataforma global)
 *
 * Mockea useRole, las queries de adminService y el Header para aislar
 * la lógica condicional bajo prueba.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const useRoleMock = vi.fn();
vi.mock("@/lib/use-role", async () => {
  const actual = await vi.importActual<typeof import("@/lib/use-role")>(
    "@/lib/use-role",
  );
  return {
    ...actual,
    useRole: (...args: unknown[]) => useRoleMock(...args),
  };
});

// El Header tira de adminService.me + useQuery y mete su propio layout;
// para aislar el dashboard lo reemplazamos por un stub mínimo.
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    me: vi.fn().mockResolvedValue({ id: "u", name: "Tester Uno", email: "t@x" }),
    stats: vi.fn().mockResolvedValue({
      activeTournaments: 2,
      registeredPlayers: 12,
      scheduledMatches: 1,
    }),
    alerts: vi.fn().mockResolvedValue([]),
    activity: vi.fn().mockResolvedValue([]),
    tournaments: { list: vi.fn().mockResolvedValue([]) },
  },
}));

import DashboardPage from "../../../app/(admin)/dashboard/page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("DashboardPage — role gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CLUB: muestra subtítulo "tu club" y labels prefijadas con "Mis"', async () => {
    useRoleMock.mockReturnValue({ role: "club", clubId: "club-1" });

    renderWithClient(<DashboardPage />);

    expect(
      await screen.findByText("Aquí tienes el resumen de tu club."),
    ).toBeInTheDocument();
    expect(screen.getByText("Mis torneos activos")).toBeInTheDocument();
    expect(screen.getByText("Jugadores en mis torneos")).toBeInTheDocument();
    expect(
      screen.getByText("Mis torneos activos y próximos"),
    ).toBeInTheDocument();
    // No debe colarse la etiqueta global del ADMIN
    expect(screen.queryByText("Torneos activos")).not.toBeInTheDocument();
  });

  it("ADMIN: muestra subtítulo neutro y labels sin prefijo", async () => {
    useRoleMock.mockReturnValue({ role: "admin", clubId: null });

    renderWithClient(<DashboardPage />);

    expect(
      await screen.findByText("Aquí tienes el resumen de la plataforma."),
    ).toBeInTheDocument();
    expect(screen.getByText("Torneos activos")).toBeInTheDocument();
    expect(screen.getByText("Jugadores inscritos")).toBeInTheDocument();
    expect(
      screen.getByText("Torneos activos y próximos"),
    ).toBeInTheDocument();
    // No debe colarse la etiqueta CLUB
    expect(screen.queryByText("Mis torneos activos")).not.toBeInTheDocument();
  });
});
