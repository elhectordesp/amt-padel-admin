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

const state = vi.hoisted(() => ({ kind: "LEAGUE" as "LEAGUE" | "TOURNAMENT", status: "ONGOING" }));
const setResult = vi.hoisted(() => vi.fn());
// Qué áreas del club puede escribir quien tiene la sesión (por defecto, todas)
const writable = vi.hoisted(() => ({ tournaments: true, results: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({
    roles: null,
    can: (area: "tournaments" | "results", level: "read" | "write" = "read") =>
      level === "read" || (area === "tournaments" && writable.tournaments) || (area === "results" && writable.results),
  }),
}));

const tournament = () => ({
  id: "l-1",
  name: "Liga de invierno",
  kind: state.kind,
  groupsEndDate: "2027-02-01T00:00:00.000Z",
  club: { id: "club-1", name: "Club Madrid", city: "Madrid" },
  startDate: "2026-12-07T00:00:00.000Z",
  endDate: "2027-03-01T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: state.status,
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
  tournamentCourts: {
    list: async () => [{ id: "tc1", tournamentId: "l-1", courtId: "k1", court: { id: "k1", name: "Pista 1" } }],
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
    state.status = "ONGOING";
    nav.pathname = "/ligas/l-1";
    writable.tournaments = true;
    writable.results = true;
    setResult.mockReset();
    setResult.mockResolvedValue({});
  });

  it("tiene Grupos, Jornadas, Calendario y Clasificación; no Cuadro ni Horarios de fechas", async () => {
    renderPage();
    for (const name of ["Grupos", "Jornadas", "Calendario", "Clasificación", "Disponibilidad"])
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

  it("Calendario: los partidos sin fecha aparte, para programarlos uno a uno", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Calendario" }, WAIT));
    const sinFecha = await screen.findByRole("region", { name: "Sin fecha" }, WAIT);
    expect(within(sinFecha).getByText(/Sin fecha · 3 partidos/)).toBeInTheDocument();
    fireEvent.click(within(sinFecha).getAllByRole("button", { name: /Programar/ })[0]);
    expect(await screen.findByRole("dialog", { name: "Programar partido" }, WAIT)).toBeInTheDocument();
  });

  it("Clasificación: el cuadro final, desactivado y con el motivo a la vista mientras queden partidos de grupos", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Clasificación" }, WAIT));
    const panel = await screen.findByRole("region", { name: "Cuadro final" }, WAIT);
    expect(within(panel).getByRole("button", { name: "Generar cuadro final" })).toBeDisabled();
    expect(within(panel).getByText("Quedan 3 partidos de grupos sin resultado.")).toBeInTheDocument();
  });

  it("Crear partido en una liga pide la jornada, no la hora ni la pista", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Grupos" }, WAIT));
    fireEvent.click(await screen.findByRole("button", { name: "Crear partido" }, WAIT));
    expect(await screen.findByLabelText("Jornada", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByLabelText("Hora (opcional)")).not.toBeInTheDocument();
  });

  describe("sin permiso de escritura (rol del club en solo lectura)", () => {
    const GROUP_ACTIONS = ["Generar cuadro…", "Crear partido", "Regenerar todo", "Cruce manual"];

    it("torneos solo en lectura: se ve todo, pero no salen duplicar, eliminar, editar ni programar", async () => {
      state.status = "DRAW"; // con el sorteo a mano, para que «Generar cuadro…» exista
      writable.tournaments = false;
      renderPage();
      expect(await screen.findByRole("button", { name: "Calendario" }, WAIT)).toBeInTheDocument();
      for (const name of ["Duplicar liga", "Eliminar liga", "Editar liga"])
        expect(screen.queryByRole("button", { name }) ?? screen.queryByRole("link", { name })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Calendario" }));
      const sinFecha = await screen.findByRole("region", { name: "Sin fecha" }, WAIT);
      expect(within(sinFecha).queryByRole("button", { name: /Programar/ })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Clasificación" }));
      const panel = await screen.findByRole("region", { name: "Cuadro final" }, WAIT);
      expect(within(panel).queryByRole("button")).not.toBeInTheDocument();

      // En «Grupos», sin el sorteo ni las acciones del cuadro
      fireEvent.click(screen.getByRole("button", { name: "Grupos" }));
      expect(await screen.findByText("Editor de grupos", {}, WAIT)).toBeInTheDocument();
      for (const name of GROUP_ACTIONS) expect(screen.queryByRole("button", { name })).toBeNull();
    });

    it("resultados solo en lectura: las jornadas no ofrecen meter ni corregir resultados", async () => {
      writable.results = false;
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Jornadas" }, WAIT));
      const grupo = await screen.findByRole("region", { name: "Grupo A" }, WAIT);
      expect(within(grupo).queryByRole("button", { name: /Meter resultado/ })).not.toBeInTheDocument();
      // Pero programar partidos (torneos) sigue siendo suyo
      fireEvent.click(screen.getByRole("button", { name: "Calendario" }));
      const sinFecha = await screen.findByRole("region", { name: "Sin fecha" }, WAIT);
      expect(within(sinFecha).getAllByRole("button", { name: /Programar/ }).length).toBeGreaterThan(0);
    });

    it("con permiso de escritura sí salen todos esos botones", async () => {
      state.status = "DRAW";
      renderPage();
      expect(await screen.findByRole("button", { name: "Duplicar liga" }, WAIT)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Eliminar liga" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Editar liga" })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Grupos" }));
      expect(await screen.findByText("Editor de grupos", {}, WAIT)).toBeInTheDocument();
      for (const name of GROUP_ACTIONS) expect(await screen.findByRole("button", { name }, WAIT)).toBeInTheDocument();
    });

    it("un torneo con el rol en solo lectura conserva sus botones: el recorte es de la ficha de liga", async () => {
      state.kind = "TOURNAMENT";
      nav.pathname = "/torneos/l-1";
      writable.tournaments = false;
      renderPage();
      expect(await screen.findByRole("button", { name: "Duplicar torneo" }, WAIT)).toBeInTheDocument();
    });
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
