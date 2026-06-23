/**
 * Tests del PatrocinadoresPage para verificar gating por rol:
 *  - CLUB: solo ve tabs "Todos" y "Por torneo", header "Mis patrocinadores".
 *  - ADMIN: ve las 4 tabs (Todos, Circuito, Por torneo, Regional).
 *
 * Mockea useRole, adminService y Header para aislar la lógica condicional.
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

vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => (
    <div data-testid="header">{title}</div>
  ),
}));

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    sponsors: {
      list: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
    },
    tournaments: { list: vi.fn().mockResolvedValue([]) },
  },
}));

import PatrocinadoresPage from "../../../app/(admin)/patrocinadores/page";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("PatrocinadoresPage — role gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CLUB: header "Mis patrocinadores" y solo tabs "Todos" + "Por torneo"', async () => {
    useRoleMock.mockReturnValue({ role: "club", clubId: "club-1" });

    renderWithClient(<PatrocinadoresPage />);

    expect(
      await screen.findByText("Mis patrocinadores"),
    ).toBeInTheDocument();
    // Tabs visibles
    expect(screen.getByRole("button", { name: /Todos/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Por torneo/ }),
    ).toBeInTheDocument();
    // Tabs ocultos para CLUB
    expect(
      screen.queryByRole("button", { name: /Circuito/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Regional/ }),
    ).not.toBeInTheDocument();
  });

  it('ADMIN: header "Patrocinadores" y las 4 tabs disponibles', async () => {
    useRoleMock.mockReturnValue({ role: "admin", clubId: null });

    renderWithClient(<PatrocinadoresPage />);

    expect(await screen.findByText("Patrocinadores")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Todos/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Circuito/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Por torneo/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Regional/ }),
    ).toBeInTheDocument();
  });
});
