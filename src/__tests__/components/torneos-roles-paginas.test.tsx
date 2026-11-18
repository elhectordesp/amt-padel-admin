/**
 * Lista, nuevo y editar de torneos, y las opciones de torneo del club, según el
 * rol del equipo. Crear, clonar y editar un torneo piden «tournaments»; guardar
 * las opciones de torneo del club, «settings» (el back las lee con
 * «tournaments» pero las escribe con «settings»). Sin el permiso: sin botón de
 * crear ni de clonar, el asistente no se abre y los formularios salen con los
 * campos deshabilitados y sin guardar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/torneos",
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "club-1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("@/components/admin/schedule-editor-dialog", () => ({ ScheduleEditorDialog: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Qué áreas puede escribir quien tiene la sesión (leer, todas)
const writable = vi.hoisted(() => ({ tournaments: true, settings: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({
    roles: null,
    can: (area: "tournaments" | "settings", level: "read" | "write" = "read") =>
      level === "read" || writable[area],
  }),
}));

const CLUB = { id: "club-1", name: "Club Madrid", city: "Madrid", timezone: "Europe/Madrid" };
const TOURNAMENT = {
  id: "t-1", name: "Open de otoño", kind: "TOURNAMENT", status: "DRAFT", tier: "BRONZE",
  club: CLUB, timezone: "Europe/Madrid",
  startDate: "2099-12-01T00:00:00.000Z", endDate: "2099-12-03T00:00:00.000Z",
  categories: [], schedule: [],
};
const CONFIG = {
  id: "cfg-1", clubId: "club-1", format: "eliminatoria", matchDuration: 60, scoringFormat: "BEST_OF_3",
  hasShirts: false, useSeeding: false, requirePaymentToConfirm: false, categoryPrice: 25, categorySpots: 32,
  dayStartTime: "16:00", dayEndTime: "21:00", maxUnavailableTotalHours: 0, description: null, rules: "Puntualidad",
  participantsVisibility: "PUBLIC", showClubInsteadOfCourt: false, hideFromAppAfterDays: null,
};

vi.mock("@/lib/services/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/admin")>("@/lib/services/admin");
  return {
    ...actual,
    adminService: {
      tournaments: {
        list: vi.fn(async () => [TOURNAMENT]),
        listLeagues: vi.fn(async () => []),
        adminDetail: vi.fn(async () => TOURNAMENT),
        update: vi.fn(),
        duplicate: vi.fn(),
      },
      clubs: { list: vi.fn(async () => [CLUB]), findOne: vi.fn(async () => CLUB) },
      matches: { list: vi.fn(async () => []) },
      clubTournamentConfig: { get: vi.fn(async () => CONFIG), update: vi.fn() },
    },
  };
});

import TorneosPage from "../../../app/(admin)/torneos/page";
import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";
import EditarTorneoPage from "../../../app/(admin)/torneos/[id]/editar/page";
import MiClubTorneosPage from "../../../app/(admin)/mi-club/torneos/page";

function renderPage(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Torneos según el rol", { timeout: 30_000 }, () => {
  beforeEach(() => {
    writable.tournaments = true;
    writable.settings = true;
  });

  describe("lista", () => {
    it("con permiso: «Nuevo torneo» y clonar", async () => {
      renderPage(<TorneosPage />);
      expect((await screen.findAllByText("Open de otoño", {}, WAIT)).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /Nuevo torneo/ })[0]).toHaveAttribute("href", "/torneos/nuevo");
      expect(screen.getAllByTitle("Clonar torneo").length).toBeGreaterThan(0);
    });

    it("solo lectura: ve los torneos y entra a su ficha, sin crear ni clonar", async () => {
      writable.tournaments = false;
      renderPage(<TorneosPage />);
      expect((await screen.findAllByText("Open de otoño", {}, WAIT)).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("link", { name: /Ver/ })[0]).toHaveAttribute("href", "/torneos/t-1");
      expect(screen.queryByRole("link", { name: /Nuevo/ })).not.toBeInTheDocument();
      expect(screen.queryAllByTitle("Clonar torneo")).toHaveLength(0);
    });
  });

  describe("nuevo", () => {
    it("con permiso: el asistente", async () => {
      renderPage(<NuevoTorneoPage />);
      expect(await screen.findByRole("button", { name: /Siguiente/ }, WAIT)).toBeInTheDocument();
    });

    it("solo lectura: el asistente no se abre y dice que el rol no permite la acción", async () => {
      writable.tournaments = false;
      renderPage(<NuevoTorneoPage />);
      expect(await screen.findByText("Tu rol en este club no permite esta acción", {}, WAIT)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Siguiente/ })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Volver a Torneos" })).toHaveAttribute("href", "/torneos");
    });
  });

  describe("editar", () => {
    it("con permiso: campos editables y «Guardar cambios»", async () => {
      renderPage(<EditarTorneoPage />);
      expect(await screen.findByDisplayValue("Open de otoño", {}, WAIT)).toBeEnabled();
      expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeInTheDocument();
    });

    it("solo lectura: el formulario se ve entero, con los campos deshabilitados y sin guardar", async () => {
      writable.tournaments = false;
      renderPage(<EditarTorneoPage />);
      expect(await screen.findByDisplayValue("Open de otoño", {}, WAIT)).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Guardar cambios/ })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Editar jornadas" })).toBeDisabled();
      expect(screen.getByRole("link", { name: "Volver" })).toBeInTheDocument();
    });
  });

  describe("opciones de torneo del club", () => {
    it("con permiso en la configuración del club: edita y guarda", async () => {
      renderPage(<MiClubTorneosPage />);
      expect(await screen.findByRole("button", { name: /Guardar/ }, WAIT)).toBeInTheDocument();
      expect(screen.getByLabelText("Inicio de cada jornada")).toBeEnabled();
    });

    it("sin escribir la configuración (aunque escriba torneos): se ven los valores, sin guardar", async () => {
      writable.settings = false;
      renderPage(<MiClubTorneosPage />);
      expect(await screen.findByLabelText("Inicio de cada jornada", {}, WAIT)).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    });
  });
});
