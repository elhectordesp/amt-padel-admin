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
      season: 2026,
    }),
    alerts: vi.fn().mockResolvedValue([]),
    activity: vi.fn().mockResolvedValue([]),
    tournaments: { list: vi.fn().mockResolvedValue([]) },
  },
}));

import DashboardPage from "../../../app/(admin)/dashboard/page";
import { adminService } from "@/lib/services/admin";

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

describe("DashboardPage — tarjetas y lista de torneos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoleMock.mockReturnValue({ role: "admin", clubId: null });
  });

  it("«Jugadores inscritos» dice que son los inscritos de la temporada", async () => {
    renderWithClient(<DashboardPage />);

    expect(
      await screen.findByText("Con inscripción en la temporada 2026"),
    ).toBeInTheDocument();
  });

  it("CLUB: únicos y de la temporada", async () => {
    useRoleMock.mockReturnValue({ role: "club", clubId: "club-1" });

    renderWithClient(<DashboardPage />);

    expect(await screen.findByText("Únicos · temporada 2026")).toBeInTheDocument();
  });

  it("«Torneos activos y próximos»: primero el en curso, sin borradores ni «próximos» ya pasados", async () => {
    // Solo la fecha: los temporizadores (react-query, findBy) siguen reales
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 21, 10, 0));
    const t = (id: string, status: string, startDate: string) => ({
      id,
      name: `Torneo ${id}`,
      status,
      startDate,
      endDate: startDate,
      club: { name: "Club" },
      categories: [],
    });
    vi.mocked(adminService.tournaments.list).mockResolvedValueOnce([
      ...["b1", "b2", "b3", "b4", "b5"].map((id) => t(id, "DRAFT", "2026-11-01")),
      t("abierto", "OPEN", "2026-12-01"),
      t("abierto-pasado", "OPEN", "2026-10-01"),
      t("en-curso", "ONGOING", "2026-10-20"),
    ] as never);

    try {
      renderWithClient(<DashboardPage />);

      await screen.findByText("Torneo en-curso");
      const names = screen
        .getAllByText(/^Torneo /)
        .map((el) => el.textContent);
      expect(names).toEqual(["Torneo en-curso", "Torneo abierto"]);
      expect(screen.getByText("En curso")).toBeInTheDocument();
      expect(screen.getByText("Abierto")).toBeInTheDocument();
      expect(screen.queryByText("Borrador")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
