/**
 * «Administradores» de un club (superadmin): quitar a alguien del equipo avisa de
 * qué pasa con sus clases y con lo que se le deba.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const clubsMock = vi.hoisted(() => ({ admins: vi.fn(), staff: vi.fn(), removeStaff: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));

import { ClubAdminsModal } from "@/components/admin/club-admins-modal";

describe("ClubAdminsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.admins.mockResolvedValue({ admins: [], invitations: [] });
    clubsMock.staff.mockResolvedValue({
      members: [{ userId: "u2", name: "Raúl Díaz", email: "raul@example.com", roles: ["COACH"], createdAt: "2026-02-01T00:00:00.000Z" }],
      invitations: [],
    });
  });

  it("quitar del equipo avisa de qué pasa con sus clases y lo que se le deba", async () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ClubAdminsModal club={{ id: "c1", name: "Helike", active: true, status: "active" }} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Quitar a Raúl Díaz del equipo" }));
    expect(await screen.findByText(
      /Si da clases, las futuras se quedan sin entrenador; lo ya dado y lo que se le deba se conserva\./,
    )).toBeInTheDocument();
  });
});
