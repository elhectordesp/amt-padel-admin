/**
 * Inscripciones y Resultados según el rol del equipo del club. Inscripciones
 * cambia con «tournaments» (altas, estados, categoría, pareja, disponibilidad)
 * y se cobra con «cash» o «tournaments»; Resultados se mete con «results». Quien solo lee lo ve
 * todo, sin los botones que cambian algo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("torneo=t1"),
}));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
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
  id: "t1", name: "Open Valencia", kind: "TOURNAMENT", status: "ONGOING",
  club: { id: "c1", name: "Club Valencia" },
  startDate: "2026-12-07T00:00:00.000Z", endDate: "2026-12-09T00:00:00.000Z",
  schedule: [], categories: [],
};
const REGISTRATIONS = [
  {
    id: "reg-ana", tournamentId: "t1", categoryId: "c-1", userId: "u-ana",
    user: { name: "Ana López", categoryLevel: "4a", spaPoints: null },
    partnerId: "u-bea", partner: { name: "Bea Ruiz", categoryLevel: "4a", spaPoints: null },
    partnerPayment: { paid: false },
    category: { gender: "F", level: "4a", price: 30 },
    status: "PENDING", paid: false, createdAt: "2026-11-01T10:00:00.000Z",
  },
];
const MATCHES = [
  { id: "m1", phase: "GROUPS", round: 1, date: null, court: null, team1: ["Ana"], team2: ["Beto"], isResult: false, status: "SCHEDULED", sets1: [], sets2: [] },
  { id: "m2", phase: "GROUPS", round: 1, date: null, court: null, team1: ["Carla"], team2: ["Dora"], isResult: true, status: "FINISHED", sets1: [6, 6], sets2: [3, 2] },
];

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      listAll: vi.fn(async () => [TOURNAMENT]),
      adminDetail: vi.fn(async () => TOURNAMENT),
    },
    registrations: { list: vi.fn(async () => REGISTRATIONS), bulkStatus: vi.fn() },
    matches: { list: vi.fn(async () => MATCHES), setResult: vi.fn() },
  },
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import InscripcionesPage from "../../../app/(admin)/inscripciones/page";
import ResultadosPage from "../../../app/(admin)/resultados/page";

function renderPage(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Inscripciones según el rol", () => {
  beforeEach(() => {
    writable.tournaments = true;
    writable.results = true;
    writable.cash = true;
  });

  // La página pinta la lista dos veces (tarjetas del móvil y tabla): se mira la tabla
  const desktopRow = async () => {
    const name = (await screen.findAllByText("Ana López"))[1];
    return within(name.closest("tr") as HTMLElement);
  };

  it("con permiso en torneos y caja: inscribe, selecciona, confirma, cambia y abre el pago", async () => {
    renderPage(<InscripcionesPage />);
    const row = await desktopRow();
    expect(screen.getByRole("button", { name: "Inscribir pareja" })).toBeInTheDocument();
    expect(row.getByTitle("Confirmar")).toBeInTheDocument();
    expect(row.getByTitle("Mover a espera")).toBeInTheDocument();
    expect(row.getByTitle("Cambiar categoría")).toBeInTheDocument();
    expect(row.getByTitle("Cancelar pareja")).toBeInTheDocument();
    expect(row.getAllByRole("checkbox")).toHaveLength(1);
    expect(row.getAllByTitle(/^Pago de /).length).toBeGreaterThan(0);
  });

  it("con torneos solo en lectura: ve las parejas y su pago, sin ninguna acción que cambie la inscripción", async () => {
    writable.tournaments = false;
    renderPage(<InscripcionesPage />);
    const row = await desktopRow();

    expect(screen.queryByRole("button", { name: "Inscribir pareja" })).not.toBeInTheDocument();
    for (const title of ["Confirmar", "Mover a espera", "Cambiar categoría", "Cancelar pareja", "Poner pareja", "Cambiar pareja"])
      expect(row.queryByTitle(title)).not.toBeInTheDocument();
    expect(row.queryAllByRole("checkbox")).toHaveLength(0);
    // La disponibilidad se mira, no se edita
    expect(row.getByTitle("Ver disponibilidad")).toBeInTheDocument();
    // El cobro es de caja, que aquí sí puede
    expect(row.getAllByTitle(/^Pago de /).length).toBeGreaterThan(0);
  });

  it("sin caja pero con torneos (la mesa del torneo): cobra, que el cobro lo abre cualquiera de las dos", async () => {
    writable.cash = false;
    renderPage(<InscripcionesPage />);
    const row = await desktopRow();

    expect(row.getAllByTitle(/^Pago de /).length).toBeGreaterThan(0);
    expect(row.getByTitle("Confirmar")).toBeInTheDocument();
  });

  it("sin escribir ni en caja ni en torneos: el estado del pago se ve, pero no se abre", async () => {
    writable.cash = false;
    writable.tournaments = false;
    renderPage(<InscripcionesPage />);
    const row = await desktopRow();

    expect(row.getAllByText("Pendiente").length).toBeGreaterThan(0);
    expect(row.queryAllByTitle(/^Pago de /)).toHaveLength(0);
  });
});

describe("Resultados según el rol", () => {
  beforeEach(() => {
    writable.tournaments = true;
    writable.results = true;
    writable.cash = true;
  });

  it("con permiso de resultados: introduce y edita", async () => {
    renderPage(<ResultadosPage />);
    expect((await screen.findAllByRole("button", { name: "Introducir" })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Editar" }).length).toBeGreaterThan(0);
  });

  it("sin permiso de resultados: ve los partidos y el marcador, sin introducir ni editar", async () => {
    writable.results = false;
    renderPage(<ResultadosPage />);
    expect((await screen.findAllByText("Pendiente")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("6-3, 6-2").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Introducir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});
