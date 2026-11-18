/**
 * Configuración de las reservas (Mi club): quien escribe la configuración
 * («settings») la edita; quien solo la lee (Recepción) la ve entera, sin
 * botones de guardar, crear, editar ni borrar. Un test por página: ajustes,
 * normas, extras, pistas y activación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const accessMock = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: accessMock.can }) }));
const courtsMock = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { courts: courtsMock, players: { search: vi.fn() } } }));
const svc = vi.hoisted(() => ({
  config: { get: vi.fn(), update: vi.fn() },
  rules: { get: vi.fn(), update: vi.fn() },
  extras: { list: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn() },
  courtDurations: { list: vi.fn(), replace: vi.fn() },
  activation: { state: vi.fn(), request: vi.fn(), publish: vi.fn() },
  testers: { list: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import ConfiguracionPage from "../../../app/(admin)/mi-club/reservas/configuracion/page";
import NormasPage from "../../../app/(admin)/mi-club/reservas/normas/page";
import ExtrasPage from "../../../app/(admin)/mi-club/reservas/extras/page";
import PistasPage from "../../../app/(admin)/mi-club/reservas/pistas/page";
import ActivacionPage from "../../../app/(admin)/mi-club/reservas/activacion/page";

const CONFIG = {
  cancellationWindowHours: 12, minBookingAheadMinutes: 60, maxBookingAheadDays: 14,
  strictModeEnabled: false, strictFrom: null, strictTo: null,
  advanceRuleEnabled: false, advanceRuleFrom: null, advanceRuleTo: null, advanceRuleMinutes: null,
  openMatchEnabled: true, openMatchMinPlayers: 4, openMatchAdminWarnHoursBefore: 24, openMatchAutoCancelHoursBefore: 4,
  resultEntryWindowDays: 3, resultMaxExtensions: 1, autoAcceptThreshold: 3, allowGuestPlayers: true,
  welcomeMessageMarkdown: null, notifyAdminViaPush: true, notifyAdminViaEmail: true, memberDiscountPercent: 0,
};

const EXTRA = {
  id: "x1", clubId: "c1", name: "Luz", description: "Iluminación", priceCents: 300,
  mandatory: false, autoApplyAfterSunset: true, active: true, displayOrder: 0,
};

const COURT = { id: "p1", clubId: "c1", name: "Pista 1", isIndoor: false, isCentral: false, active: true, type: "DOUBLES" };

function renderPage(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const READ_ONLY = (_area: string, level = "read") => level === "read";

describe("Configuración de reservas con un rol de solo lectura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.can.mockReturnValue(true);
    svc.config.get.mockResolvedValue(CONFIG);
    svc.rules.get.mockResolvedValue({ rulesMarkdown: "# Normas\n\n- Calzado de pista", version: "v1" });
    svc.extras.list.mockResolvedValue([EXTRA]);
    svc.courtDurations.list.mockResolvedValue([{ id: "d1", courtId: "p1", minutes: 90, isDefault: true }]);
    courtsMock.list.mockResolvedValue([COURT]);
    svc.activation.state.mockResolvedValue({
      status: "INACTIVE", activeTesterCount: 0, bookingPublicAt: null, bookingActivationRequestedAt: null,
      readiness: { ready: true, checks: [] },
    });
    svc.testers.list.mockResolvedValue([
      { id: "t1", userId: "u1", validUntil: "2026-12-01T10:00:00.000Z", user: { name: "Ana Tester", email: "ana@example.com" } },
    ]);
  });

  describe("ajustes", () => {
    it("con escritura: «Guardar» y los campos se pueden cambiar", async () => {
      renderPage(<ConfiguracionPage />);
      expect(await screen.findByRole("button", { name: /Guardar/ })).toBeInTheDocument();
      expect(screen.getAllByRole("spinbutton")[0]).toBeEnabled();
    });

    it("solo lectura: se ven los valores, sin «Guardar» y con los campos fijos", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      renderPage(<ConfiguracionPage />);
      const first = (await screen.findAllByRole("spinbutton"))[0];
      expect(first).toHaveValue(12);
      expect(first).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Guardar/ })).not.toBeInTheDocument();
    });
  });

  describe("normas", () => {
    it("con escritura: editor, pestañas y «Guardar»", async () => {
      renderPage(<NormasPage />);
      expect(await screen.findByRole("button", { name: /Guardar/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Editar/ })).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("solo lectura: se lee el reglamento, sin editor, sin pestañas y sin «Guardar»", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      renderPage(<NormasPage />);
      expect(await screen.findByText("Calzado de pista")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      for (const name of [/Guardar/, /Editar/, /Vista previa/]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
    });
  });

  describe("extras", () => {
    it("con escritura: «Nuevo extra», «Editar» y desactivar", async () => {
      renderPage(<ExtrasPage />);
      expect(await screen.findByText("Luz")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Nuevo extra/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(screen.getByTitle("Desactivar")).toBeInTheDocument();
    });

    it("solo lectura: se ven los extras, sin crear, editar ni desactivar", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      renderPage(<ExtrasPage />);
      expect(await screen.findByText("Luz")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Nuevo extra/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
      expect(screen.queryByTitle("Desactivar")).not.toBeInTheDocument();
    });
  });

  describe("pistas y duraciones", () => {
    it("con escritura: guardar atributos y duraciones, y editar la lista", async () => {
      renderPage(<PistasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Expandir" }));
      expect(await screen.findByRole("button", { name: /Guardar atributos/ })).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /Guardar duraciones/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "60 min" })).toBeInTheDocument();
    });

    it("solo lectura: atributos fijos y duraciones guardadas en una lista, sin botones", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      renderPage(<PistasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Expandir" }));
      expect(await screen.findByText("90 min")).toBeInTheDocument();
      expect(screen.getByText("Sí")).toBeInTheDocument(); // la de por defecto
      const selects = screen.getAllByRole("combobox");
      expect(selects.length).toBeGreaterThan(0);
      for (const select of selects) expect(select).toBeDisabled();
      for (const name of [/Guardar atributos/, /Guardar duraciones/, /Guardar ahora/, /^Añadir$/, "60 min"]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    });

    it("solo lectura y sin duraciones guardadas: lo avisa, sin la sugerencia ni «Guardar ahora»", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      svc.courtDurations.list.mockResolvedValue([]);
      renderPage(<PistasPage />);
      fireEvent.click(await screen.findByRole("button", { name: "Expandir" }));
      expect(await screen.findByText("Esta pista no tiene duraciones guardadas")).toBeInTheDocument();
      expect(screen.queryByText(/solo una sugerencia/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Guardar ahora/ })).not.toBeInTheDocument();
    });
  });

  describe("activación", () => {
    it("con escritura: «Solicitar activación» y añadir/quitar testers", async () => {
      renderPage(<ActivacionPage />);
      expect(await screen.findByRole("button", { name: /Solicitar activación/ })).toBeInTheDocument();
      expect(await screen.findByText("Ana Tester")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Añadir/ })).toBeInTheDocument();
      expect(screen.getByTitle("Eliminar")).toBeInTheDocument();
    });

    it("solo lectura: ve el estado y los testers, sin solicitar, añadir ni quitar", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      renderPage(<ActivacionPage />);
      expect(await screen.findByText("Módulo INACTIVO")).toBeInTheDocument();
      expect(await screen.findByText("Ana Tester")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Solicitar activación/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Añadir/ })).not.toBeInTheDocument();
      expect(screen.queryByTitle("Eliminar")).not.toBeInTheDocument();
    });

    it("solo lectura en modo prueba: sin «Publicar al público»", async () => {
      accessMock.can.mockImplementation(READ_ONLY);
      svc.activation.state.mockResolvedValue({
        status: "TESTER_MODE", activeTesterCount: 1, bookingPublicAt: null, bookingActivationRequestedAt: null,
      });
      renderPage(<ActivacionPage />);
      expect(await screen.findByText("Modo TESTER")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Publicar al público/ })).not.toBeInTheDocument();
    });
  });
});
