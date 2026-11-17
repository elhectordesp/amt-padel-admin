/**
 * Modo soporte de AMT: la acción «Entrar como soporte» de la tarjeta del club
 * y la franja fija «Soporte AMT · club · Salir».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const authMock = vi.hoisted(() => ({ activateClub: vi.fn() }));
vi.mock("@/lib/auth", () => authMock);

const findOne = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: { findOne } } }));

const meMock = vi.hoisted(() => ({ data: undefined as unknown }));
vi.mock("@/lib/use-me", () => ({
  ME_QUERY_KEY: ["admin-me"],
  useMe: () => ({ data: meMock.data }),
}));

import { EnterSupportButton, SupportBanner } from "@/components/admin/support-mode";

function renderWithClient(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  meMock.data = undefined;
  Object.defineProperty(window, "location", { value: { href: "" }, writable: true });
});

describe("EnterSupportButton", () => {
  it("entra con el club de la tarjeta y va a la portada", async () => {
    authMock.activateClub.mockResolvedValueOnce({});
    renderWithClient(<EnterSupportButton clubId="club-1" clubName="Club Uno" />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar como soporte en Club Uno" }));

    await waitFor(() => expect(window.location.href).toBe("/"));
    expect(authMock.activateClub).toHaveBeenCalledWith("club-1");
  });

  it("si el back lo rechaza, avisa y no navega", async () => {
    authMock.activateClub.mockRejectedValueOnce(new Error("Club no encontrado"));
    renderWithClient(<EnterSupportButton clubId="club-9" clubName="Club Nueve" />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Club no encontrado"));
    expect(window.location.href).toBe("");
  });
});

describe("SupportBanner", () => {
  it("sin modo soporte no pinta nada ni pide el club", () => {
    meMock.data = { id: "u1", supportClubId: null };
    const { container } = renderWithClient(<SupportBanner />);

    expect(container).toBeEmptyDOMElement();
    expect(findOne).not.toHaveBeenCalled();
  });

  it("en soporte enseña el nombre del club y Salir vuelve a /clubes", async () => {
    meMock.data = { id: "u1", supportClubId: "club-1" };
    findOne.mockResolvedValueOnce({ id: "club-1", name: "Club Uno" });
    authMock.activateClub.mockResolvedValueOnce({});
    renderWithClient(<SupportBanner />);

    expect(await screen.findByText(/Soporte AMT · Club Uno/)).toBeInTheDocument();
    expect(findOne).toHaveBeenCalledWith("club-1");

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));

    await waitFor(() => expect(window.location.href).toBe("/clubes"));
    expect(authMock.activateClub).toHaveBeenCalledWith(null);
  });
});
