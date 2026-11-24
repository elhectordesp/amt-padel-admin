/**
 * Equipo del club: quien escribe el área «staff» (propietario) invita, cambia
 * roles, quita y gestiona invitaciones; quien solo la lee (Gestor) ve a la
 * gente y las invitaciones, sin ningún botón ni columna de acciones.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const accessMock = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: accessMock.can }) }));
const clubsMock = vi.hoisted(() => ({
  staff: vi.fn(), inviteStaff: vi.fn(), updateStaffRoles: vi.fn(), removeStaff: vi.fn(),
  resendStaffInvitation: vi.fn(), revokeStaffInvitation: vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));
const accountsState = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/use-accounts-enabled", () => ({
  useClubAccounts: () => ({ on: accountsState.on, known: true, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const coachesMock = vi.hoisted(() => ({ overview: vi.fn() }));
vi.mock("@/lib/services/coaches", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/coaches")>()),
  coachesService: coachesMock,
}));

import EquipoPage from "../../../app/(admin)/mi-club/equipo/page";

const STAFF = {
  members: [
    { userId: "u1", name: "Marta Gómez", email: "marta@example.com", roles: ["OWNER"], createdAt: "2026-01-01T00:00:00.000Z" },
    { userId: "u2", name: "Raúl Díaz", email: "raul@example.com", roles: ["RECEPTION"], createdAt: "2026-02-01T00:00:00.000Z" },
  ],
  invitations: [
    { id: "i1", email: "nuevo@example.com", roles: ["COACH"], expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-11-01T00:00:00.000Z" },
  ],
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EquipoPage />
    </QueryClientProvider>,
  );
}

describe("Equipo del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.can.mockReturnValue(true);
    clubsMock.staff.mockResolvedValue(STAFF);
    accountsState.on = false;
    coachesMock.overview.mockResolvedValue({ month: "2026-11", coaches: [], totals: {} });
  });

  it("con escritura (propietario): «Invitar» y, en cada miembro e invitación, sus acciones", async () => {
    renderPage();
    expect(await screen.findByText("Raúl Díaz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Invitar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar los roles de Raúl Díaz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar a Raúl Díaz del equipo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar la invitación a nuevo@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anular la invitación a nuevo@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
  });

  it("solo lectura (gestor): ve el equipo y las invitaciones, sin botones ni columna de acciones", async () => {
    accessMock.can.mockImplementation((_area: string, level = "read") => level === "read");
    renderPage();
    expect(await screen.findByText("Raúl Díaz")).toBeInTheDocument();
    expect(screen.getByText("nuevo@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Acciones" })).not.toBeInTheDocument();
    expect(screen.getByText(/Solo el propietario puede cambiar el equipo/)).toBeInTheDocument();
  });

  describe("quitar a un entrenador con horas sin pagar", () => {
    const coachRow = (extra: Record<string, unknown> = {}) => ({
      coachStaffId: "sc2", userId: "u2", name: "Raúl Díaz", owedCents: 4500, previousOwedCents: 1000, ...extra,
    });
    const openRemove = async () => {
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Quitar a Raúl Díaz del equipo" }));
      return screen.findByRole("dialog");
    };

    it("con el módulo encendido y lo que se le debe, avisa con la suma de lo del mes y lo anterior", async () => {
      accountsState.on = true;
      coachesMock.overview.mockResolvedValue({ month: "2026-11", coaches: [coachRow()], totals: {} });
      const dialog = await openRemove();
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Se le deben 55,00 € de horas: págale antes de quitarlo, o su devengado dejará de verse.",
      );
    });

    it("sin deuda no avisa", async () => {
      accountsState.on = true;
      coachesMock.overview.mockResolvedValue({
        month: "2026-11", coaches: [coachRow({ owedCents: 0, previousOwedCents: 0 })], totals: {},
      });
      const dialog = await openRemove();
      await vi.waitFor(() => expect(coachesMock.overview).toHaveBeenCalled());
      expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("con el módulo apagado, ni lo consulta", async () => {
      await openRemove();
      expect(coachesMock.overview).not.toHaveBeenCalled();
    });

    it("sin permiso de cuentas, ni lo consulta", async () => {
      accountsState.on = true;
      accessMock.can.mockImplementation((area: string) => area !== "accounts");
      await openRemove();
      expect(coachesMock.overview).not.toHaveBeenCalled();
    });
  });
});
