/**
 * Clubes (D5): la tarjeta distingue «Desactivado» (con fecha) de «Por
 * configurar», ofrece desactivar también al club por configurar y reactivar
 * al desactivado, siempre con confirmación. Con un back anterior (sin
 * deactivatedAt) se comporta como antes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/components/admin/quick-invite-modal", () => ({ QuickInviteClubModal: () => null }));
vi.mock("@/components/admin/courts-manager", () => ({ CourtsManager: () => null }));

const clubsMock = vi.hoisted(() => ({
  list:         vi.fn(),
  update:       vi.fn(),
  deactivate:   vi.fn(),
  geocodeBatch: vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));

import ClubesPage from "../../../app/(admin)/clubes/page";

const base = { city: "Madrid", lat: 40.4, lng: -3.7, isAmtPartner: false, tournamentCount: 0 };
const CLUBS = [
  { ...base, id: "c-activo",  name: "Club Activo",  active: true,  deactivatedAt: null },
  { ...base, id: "c-off",     name: "Club Apagado", active: false, deactivatedAt: "2026-10-01T10:00:00.000Z" },
  { ...base, id: "c-stub",    name: "Club por configurar", city: "—", active: false, deactivatedAt: null },
];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClubesPage />
    </QueryClientProvider>,
  );
}

/** La tarjeta de un club (con «Ver inactivos» ya pulsado si hace falta). */
async function cardOf(name: string) {
  const title = await screen.findByText(name);
  return title.closest("div.bg-card") as HTMLElement;
}

async function showInactive() {
  fireEvent.click(await screen.findByRole("button", { name: "Ver inactivos" }));
}

describe("ClubesPage — estado de los clubes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.list.mockResolvedValue(CLUBS);
  });

  it("distingue «Desactivado» de «Por configurar»", async () => {
    renderPage();
    await showInactive();

    expect(within(await cardOf("Club Apagado")).getByText("Desactivado")).toBeInTheDocument();
    expect(within(await cardOf("Club por configurar")).getByText("Por configurar")).toBeInTheDocument();
    const active = await cardOf("Club Activo");
    expect(within(active).queryByText("Desactivado")).not.toBeInTheDocument();
    expect(within(active).queryByText("Por configurar")).not.toBeInTheDocument();
  });

  it("un club por configurar también se desactiva, con confirmación", async () => {
    clubsMock.deactivate.mockResolvedValue({ ...CLUBS[2], deactivatedAt: "2026-10-25T10:00:00.000Z" });
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club por configurar")).getByRole("button", { name: "Desactivar club" }));
    expect(clubsMock.deactivate).not.toHaveBeenCalled();
    expect(screen.getByText("¿Desactivar el club?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(clubsMock.deactivate).toHaveBeenCalledWith("c-stub"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Club desactivado"));
  });

  it("al desactivado se le ofrece reactivar; si sigue por configurar, el aviso lo dice", async () => {
    clubsMock.update.mockResolvedValue({ ...CLUBS[1], active: false, deactivatedAt: null });
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club Apagado")).getByRole("button", { name: "Reactivar club" }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(clubsMock.update).toHaveBeenCalledWith("c-off", { active: true }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("Sigue por configurar")));
  });

  it("con un back anterior (sin deactivatedAt), un club inactivo se activa como antes", async () => {
    clubsMock.list.mockResolvedValue([{ ...base, id: "c-viejo", name: "Club Viejo", active: false }]);
    clubsMock.update.mockResolvedValue({ ...base, id: "c-viejo", name: "Club Viejo", active: true });
    renderPage();
    await showInactive();

    const card = await cardOf("Club Viejo");
    expect(within(card).queryByText("Desactivado")).not.toBeInTheDocument();
    expect(within(card).queryByText("Por configurar")).not.toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Activar club" }));
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    await waitFor(() => expect(clubsMock.update).toHaveBeenCalledWith("c-viejo", { active: true }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Club activado"));
  });
});
