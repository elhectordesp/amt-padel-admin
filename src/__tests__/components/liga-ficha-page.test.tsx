/**
 * Ficha de una liga: «Jornadas» (los partidos por grupo y jornada, con el
 * resultado por el flujo de siempre) y «Clasificación» (la del back). Una
 * liga no tiene fecha ni pista por partido, así que no hay Horarios de fechas.
 * Un torneo sigue con sus pestañas de siempre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

const nav = vi.hoisted(() => ({ pathname: "/ligas/l-1" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "l-1" }),
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const state = vi.hoisted(() => ({ kind: "LEAGUE" as "LEAGUE" | "TOURNAMENT" }));
const setResult = vi.hoisted(() => vi.fn());

const tournament = () => ({
  id: "l-1",
  name: "Liga de invierno",
  kind: state.kind,
  groupsEndDate: "2027-02-01T00:00:00.000Z",
  club: { id: "club-1", name: "Club Madrid", city: "Madrid" },
  startDate: "2026-12-07T00:00:00.000Z",
  endDate: "2027-03-01T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "ONGOING",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "M", level: "3a", totalSpots: 8, occupiedCount: 3, confirmedCount: 3, waitlistCount: 0, currentPhase: "GROUPS" },
  ],
  schedule: [{ id: "d1", label: "Lunes", date: null, weekday: 1, slots: ["18:00"], maxUnavailableHours: 1 }],
  courts: [],
});

// Como los deja adminService.matches.list: con los nombres de cada equipo y el grupo por su nombre
const matchRow = (id: string, round: number, t1: [string, string], t2: [string, string], extra = {}) => ({
  id,
  categoryId: "c-1",
  phase: "GROUPS",
  status: "SCHEDULED",
  date: null,
  court: null,
  round,
  group: "Grupo A",
  team1: [t1[1]],
  team2: [t2[1]],
  sets1: [],
  sets2: [],
  isResult: false,
  players: [
    { userId: t1[0], team: 1 },
    { userId: t2[0], team: 2 },
  ],
  ...extra,
});

const standingsRow = (pos: number, userId: string, name: string) => ({
  pos, userId, partnerId: null, name, played: 0, wins: 0, points: 0,
  setsWon: 0, setsLost: 0, setDiff: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0,
});

const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: {
    adminDetail: async () => tournament(),
    groups: async () => [
      { id: "g1", label: "Grupo A", qualifyCount: 2, rows: [standingsRow(1, "u1", "Ana"), standingsRow(2, "u2", "Beto"), standingsRow(3, "u3", "Carla")] },
    ],
  },
  matches: {
    list: async () => [
      matchRow("m1", 1, ["u1", "Ana"], ["u2", "Beto"]),
      matchRow("m2", 2, ["u1", "Ana"], ["u3", "Carla"]),
      matchRow("m3", 3, ["u2", "Beto"], ["u3", "Carla"]),
    ],
    setResult: (...args: unknown[]) => setResult(...args),
  },
};
vi.mock("@/lib/services/admin", () => ({
  adminService: new Proxy({}, {
    get: (_t, ns: string) =>
      new Proxy({}, { get: (_s, fn: string) => handlers[ns]?.[fn] ?? (async () => []) }),
  }),
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import TorneoDetailPage from "../../../app/(admin)/torneos/[id]/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TorneoDetailPage />
    </QueryClientProvider>,
  );
}

describe("Ficha de una liga", { timeout: 30_000 }, () => {
  beforeEach(() => {
    state.kind = "LEAGUE";
    nav.pathname = "/ligas/l-1";
    setResult.mockReset();
    setResult.mockResolvedValue({});
  });

  it("tiene Grupos, Jornadas y Clasificación; no Cuadro ni Horarios de fechas", async () => {
    renderPage();
    for (const name of ["Grupos", "Jornadas", "Clasificación", "Disponibilidad"])
      expect(await screen.findByRole("button", { name }, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cuadro" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Horarios" })).not.toBeInTheDocument();
  });

  it("Jornadas: los partidos por grupo y jornada, y meter el resultado abre el modal de siempre", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Jornadas" }, WAIT));

    const grupo = await screen.findByRole("region", { name: "Grupo A" }, WAIT);
    const jornadas = within(grupo).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(jornadas).toEqual(["Jornada 1", "Jornada 2", "Jornada 3"]);
    // La semana de la jornada 2 es la del inicio más 7 días
    expect(within(grupo).getByText(/Semana del 14 dic/)).toBeInTheDocument();
    // En la jornada 1 descansa Carla
    expect(within(grupo).getByText("Carla", { selector: "span.text-foreground" })).toBeInTheDocument();

    fireEvent.click(within(grupo).getAllByRole("button", { name: /Meter resultado/ })[0]);
    expect(await screen.findByText("Introducir resultado", {}, WAIT)).toBeInTheDocument();
  });

  it("Clasificación: la tabla de cada grupo", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Clasificación" }, WAIT));
    const table = await screen.findByRole("table", { name: "Clasificación Grupo A" }, WAIT);
    expect(within(table).getByText("Ana")).toBeInTheDocument();
    expect(within(table).getByText("Carla")).toBeInTheDocument();
  });

  it("Disponibilidad: sin la rejilla de fechas ni sus vistas (Lista, Tablero por pista)", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Disponibilidad" }, WAIT));
    expect(screen.queryByRole("button", { name: "Lista / Calendario" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tablero por pista" })).not.toBeInTheDocument();
  });

  it("un torneo conserva sus pestañas de siempre, sin Jornadas ni Clasificación", async () => {
    state.kind = "TOURNAMENT";
    nav.pathname = "/torneos/l-1";
    renderPage();
    expect(await screen.findByRole("button", { name: "Cuadro" }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Horarios" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jornadas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clasificación" })).not.toBeInTheDocument();
  });
});
