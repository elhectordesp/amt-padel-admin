/**
 * Ficha de un torneo según el rol del equipo del club: cada acción pide el área
 * que le pide su endpoint en el back. Cambiar el torneo (editar, duplicar,
 * eliminar, inscripciones, horarios) es «tournaments»; meter, corregir y
 * reabrir resultados, «results»; cobrar, «cash». Sin el permiso, el botón no sale.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  usePathname: () => "/torneos/t-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

// Qué áreas puede escribir quien tiene la sesión (leer, todas)
const writable = vi.hoisted(() => ({ tournaments: true, results: true, cash: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({
    roles: null,
    can: (area: "tournaments" | "results" | "cash", level: "read" | "write" = "read") =>
      level === "read" || writable[area],
  }),
}));

const TOURNAMENT = {
  id: "t-1",
  name: "Open Castellón",
  kind: "TOURNAMENT",
  club: { id: "club-1", name: "Club Castellón", city: "Castellón" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "OPEN",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "F", level: "4a", totalSpots: 8, occupiedCount: 1, confirmedCount: 1, waitlistCount: 0, currentPhase: "REGISTRATION" },
  ],
  schedule: [],
  courts: [],
};

const REGISTRATIONS = [
  {
    id: "reg-ana",
    tournamentId: "t-1",
    categoryId: "c-1",
    userId: "u-ana",
    user: { name: "Ana López", categoryLevel: "4a", spaPoints: null },
    partnerId: "u-bea",
    partner: { name: "Bea Ruiz", categoryLevel: "4a", spaPoints: null },
    partnerPayment: { paid: false },
    category: { gender: "F", level: "4a", price: 30 },
    status: "PENDING",
    paid: false,
    createdAt: "2026-11-01T10:00:00.000Z",
  },
];

const MATCHES = [
  {
    id: "m-1", categoryId: "c-1", phase: "GROUPS", status: "SCHEDULED", date: "2026-11-20T10:00:00.000Z", court: "Pista 1",
    team1: ["Ana López"], team2: ["Carla Gil"], sets1: [], sets2: [], isResult: false,
    players: [{ userId: "u-ana", team: 1 }, { userId: "u-carla", team: 2 }],
  },
  {
    id: "m-2", categoryId: "c-1", phase: "GROUPS", status: "FINISHED", date: "2026-11-20T11:00:00.000Z", court: "Pista 2",
    team1: ["Dora Sanz"], team2: ["Elena Pons"], sets1: [6, 6], sets2: [3, 4], isResult: true,
    players: [{ userId: "u-dora", team: 1 }, { userId: "u-elena", team: 2 }],
  },
];

const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments:   { adminDetail: async () => TOURNAMENT },
  registrations: { list: async () => REGISTRATIONS },
  matches:       { list: async () => MATCHES },
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

async function openTab(name: RegExp | string) {
  fireEvent.click(await screen.findByRole("button", { name }, WAIT));
}

/** Los botones de una pestaña por su título o nombre; «hay» o «no hay». */
const hasTitle = (title: string) => screen.queryAllByTitle(title).length > 0;

describe("Ficha de un torneo según el rol", { timeout: 30_000 }, () => {
  beforeEach(() => {
    writable.tournaments = true;
    writable.results = true;
    writable.cash = true;
  });

  it("con todos los permisos salen el duplicar, el eliminar y el editar", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "Duplicar torneo" }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar torneo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Editar torneo" })).toBeInTheDocument();
  });

  describe("Resultados: torneos en lectura, resultados escribe, sin caja", () => {
    beforeEach(() => {
      writable.tournaments = false;
      writable.cash = false;
    });

    it("ve el torneo sin poder duplicarlo, eliminarlo ni editarlo", async () => {
      renderPage();
      expect(await screen.findByRole("button", { name: /^Inscripciones/ }, WAIT)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Duplicar torneo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Eliminar torneo" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Editar torneo" })).not.toBeInTheDocument();
    });

    it("Inscripciones: ve las parejas y su pago, sin inscribir, confirmar, cobrar ni abrir el pago", async () => {
      renderPage();
      await openTab(/^Inscripciones/);
      expect(await screen.findByText("Ana López", {}, WAIT)).toBeInTheDocument();

      expect(screen.queryByRole("button", { name: "Inscribir pareja" })).not.toBeInTheDocument();
      expect(hasTitle("Confirmar pareja")).toBe(false);
      expect(hasTitle("Cancelar pareja")).toBe(false);
      expect(hasTitle("Cambiar categoría")).toBe(false);
      expect(screen.queryByRole("button", { name: /Cobrar pareja/ })).not.toBeInTheDocument();
      // El estado del pago se ve, pero no se abre
      expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
      expect(screen.queryAllByTitle(/^Pago de /)).toHaveLength(0);
    });

    it("Horarios: ve los partidos y corrige resultados, sin programar, publicar ni borrar", async () => {
      renderPage();
      await openTab("Horarios");
      expect(await screen.findByText("Dora Sanz", {}, WAIT)).toBeInTheDocument();

      expect(hasTitle("Asignar horarios automáticos")).toBe(false);
      expect(hasTitle("Publicar el horario de todas las categorías")).toBe(false);
      expect(screen.queryByRole("button", { name: /Publicar horario/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Borrar partido" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar fecha y pista" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cambiar parejas" })).not.toBeInTheDocument();
      // El resultado sí es suyo
      expect(hasTitle("Corregir resultado")).toBe(true);
      expect(hasTitle("Reabrir partido (deshacer resultado)")).toBe(true);
    });
  });

  describe("Recepción: torneos en lectura, caja escribe, sin resultados", () => {
    beforeEach(() => {
      writable.tournaments = false;
      writable.results = false;
    });

    it("Inscripciones: cobra, pero no confirma ni cambia nada de la inscripción", async () => {
      renderPage();
      await openTab(/^Inscripciones/);
      expect(await screen.findByText("Ana López", {}, WAIT)).toBeInTheDocument();

      expect(screen.getByRole("button", { name: /Cobrar pareja/ })).toBeInTheDocument();
      expect(screen.getAllByTitle(/^Pago de /).length).toBeGreaterThan(0);
      expect(hasTitle("Confirmar pareja")).toBe(false);
      expect(screen.queryByRole("button", { name: "Inscribir pareja" })).not.toBeInTheDocument();
    });

    it("Horarios: ve los partidos, sin meter, corregir ni reabrir resultados", async () => {
      renderPage();
      await openTab("Horarios");
      expect(await screen.findByText("Dora Sanz", {}, WAIT)).toBeInTheDocument();

      expect(hasTitle("Corregir resultado")).toBe(false);
      expect(hasTitle("Reabrir partido (deshacer resultado)")).toBe(false);
      expect(screen.queryByRole("button", { name: "Borrar partido" })).not.toBeInTheDocument();
    });
  });

  it("con todos los permisos, Inscripciones y Horarios enseñan sus botones", async () => {
    renderPage();
    await openTab(/^Inscripciones/);
    expect(await screen.findByText("Ana López", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inscribir pareja" })).toBeInTheDocument();
    expect(hasTitle("Confirmar pareja")).toBe(true);
    expect(screen.getByRole("button", { name: /Cobrar pareja/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Horarios" }));
    expect(await screen.findByText("Dora Sanz", {}, WAIT)).toBeInTheDocument();
    expect(hasTitle("Asignar horarios automáticos")).toBe(true);
    expect(screen.getAllByRole("button", { name: "Borrar partido" }).length).toBeGreaterThan(0);
    expect(hasTitle("Corregir resultado")).toBe(true);
  });
});
