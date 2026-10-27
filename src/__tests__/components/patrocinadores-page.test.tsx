/**
 * Tests del PatrocinadoresPage para verificar gating por rol:
 *  - CLUB: solo ve tabs "Todos" y "Por torneo", header "Mis patrocinadores".
 *  - ADMIN: ve las 4 tabs (Todos, Circuito, Por torneo, Regional).
 *
 * Mockea useRole, adminService y Header para aislar la lógica condicional.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IMAGE_URL_MESSAGE, WEB_URL_MESSAGE } from "@/lib/utils/web-url";
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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    sponsors: {
      list: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
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

// P2-25: una URL guardada antes con otro esquema no se pinta como enlace
describe("PatrocinadoresPage — URL destino", () => {
  const sponsor = (id: string, websiteUrl: string) => ({
    id,
    name: `Patrocinador ${id}`,
    websiteUrl,
    scope: "CIRCUIT" as const,
    displayOrder: 0,
    active: true,
    clickCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
  });

  it("solo http(s) es un enlace", async () => {
    useRoleMock.mockReturnValue({ role: "admin", clubId: null });
    const { adminService } = await import("@/lib/services/admin");
    vi.mocked(adminService.sponsors.list).mockResolvedValueOnce([
      sponsor("bueno", "https://raquetas.example"),
      sponsor("malo", "javascript:alert(document.cookie)"),
    ]);

    renderWithClient(<PatrocinadoresPage />);

    const good = await screen.findByText("raquetas.example");
    expect(good.closest("a")).toHaveAttribute("href", "https://raquetas.example");
    const bad = screen.getByText("javascript:alert(document.cookie)");
    expect(bad.closest("a")).toBeNull();
  });

  // Lo que el back rechazaría (http(s) y dominio con punto) se dice antes,
  // también para la imagen
  it.each([
    ["https://raquetas.example", "javascript:alert(1)", IMAGE_URL_MESSAGE],
    ["https://raquetas.example", "https://localhost/banner.png", IMAGE_URL_MESSAGE],
    ["https://raquetas", "", WEB_URL_MESSAGE],
  ])("web %s e imagen «%s»: no lo manda y lo dice", async (websiteUrl, imageUrl, message) => {
    useRoleMock.mockReturnValue({ role: "admin", clubId: null });
    const { adminService } = await import("@/lib/services/admin");
    const { toast } = await import("sonner");

    renderWithClient(<PatrocinadoresPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo patrocinador/ }));
    fireEvent.change(screen.getByPlaceholderText("Raquetas García"), { target: { value: "Raquetas" } });
    fireEvent.change(screen.getByPlaceholderText("https://raquetasgarcia.com"), { target: { value: websiteUrl } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: imageUrl } });
    fireEvent.click(screen.getByRole("button", { name: /Crear patrocinador/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(adminService.sponsors.create).not.toHaveBeenCalled();
  });
});
