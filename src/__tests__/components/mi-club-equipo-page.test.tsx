/**
 * Equipo del club: quien escribe el área «staff» (propietario) invita, cambia
 * roles, quita y gestiona invitaciones; quien solo la lee (Gestor) ve a la
 * gente y las invitaciones, sin ningún botón ni columna de acciones.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
