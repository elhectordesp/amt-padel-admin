/**
 * Clubes (D5): la tarjeta y la ficha distinguen «Desactivado» de «Por
 * configurar» con el estado que calcula el back (`status`), ofrecen
 * desactivar también al club por configurar y reactivar al desactivado,
 * siempre con confirmación. Con un back anterior (sin `status`) se comporta
 * como antes.
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
const ACTIVE = { ...base, id: "c-activo", name: "Club Activo", active: true, deactivatedAt: null, status: "active", pendingSetup: false };
const OFF = {
  ...base, id: "c-off", name: "Club Apagado", active: false,
  deactivatedAt: "2026-10-01T10:00:00.000Z", status: "deactivated", pendingSetup: false,
};
const STUB = {
  ...base, id: "c-stub", name: "Club por configurar", city: "—", active: false,
  deactivatedAt: null, status: "pending", pendingSetup: true,
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClubesPage />
    </QueryClientProvider>,
  );
}

/** La tarjeta de un club. */
async function cardOf(name: string) {
  const title = await screen.findByText(name, { selector: "p" });
  return title.closest("div.bg-card") as HTMLElement;
}

async function showInactive() {
  fireEvent.click(await screen.findByRole("button", { name: "Ver inactivos" }));
}

describe("ClubesPage — estado de los clubes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.list.mockResolvedValue([ACTIVE, OFF, STUB]);
  });

  it("distingue «Desactivado» de «Por configurar», debajo del nombre", async () => {
    renderPage();
    await showInactive();

    const off = await cardOf("Club Apagado");
    const badge = within(off).getByText("Desactivado");
    // La etiqueta va en el bloque del nombre (que puede encogerse), no en el de
    // los botones, y el nombre ocupa hasta dos líneas en vez de cortarse en una
    // (captura a 375 px y con 3 columnas en el PR)
    expect(badge.closest(".min-w-0")).toContainElement(within(off).getByText("Club Apagado"));
    expect(within(off).getByText("Club Apagado")).toHaveClass("line-clamp-2");
    expect(within(await cardOf("Club por configurar")).getByText("Por configurar")).toBeInTheDocument();
    const active = await cardOf("Club Activo");
    expect(within(active).queryByText("Desactivado")).not.toBeInTheDocument();
    expect(within(active).queryByText("Por configurar")).not.toBeInTheDocument();
  });

  it("el icono dice cómo está el club, no lo que hará el botón", async () => {
    renderPage();
    await showInactive();

    const iconOf = async (name: string) =>
      within(await cardOf(name))
        .getByRole("button", { name: /^(Desactivar|Reactivar|Activar) club$/ })
        .querySelector("svg")!
        .getAttribute("class");
    expect(await iconOf("Club Activo")).toContain("text-green-400");
    // Por configurar se ofrece «Desactivar», pero no está encendido
    expect(await iconOf("Club por configurar")).toContain("text-destructive");
    expect(await iconOf("Club Apagado")).toContain("text-destructive");
  });

  it("un club por configurar también se desactiva, con su texto y confirmación", async () => {
    clubsMock.deactivate.mockResolvedValue({ ...STUB, deactivatedAt: "2026-10-25T10:00:00.000Z", status: "deactivated" });
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club por configurar")).getByRole("button", { name: "Desactivar club" }));
    expect(clubsMock.deactivate).not.toHaveBeenCalled();
    expect(screen.getByText(/Su admin perderá el acceso/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(clubsMock.deactivate).toHaveBeenCalledWith("c-stub"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Club desactivado"));
  });

  it("Cancelar no desactiva nada", async () => {
    renderPage();

    fireEvent.click(within(await cardOf("Club Activo")).getByRole("button", { name: "Desactivar club" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("¿Desactivar el club?")).not.toBeInTheDocument();
    expect(clubsMock.deactivate).not.toHaveBeenCalled();
    expect(clubsMock.update).not.toHaveBeenCalled();
  });

  it("reactivar uno configurado: vuelve activo y el aviso dice «Club reactivado»", async () => {
    clubsMock.update.mockResolvedValue({ ...OFF, active: true, deactivatedAt: null, status: "active" });
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club Apagado")).getByRole("button", { name: "Reactivar club" }));
    expect(screen.getByText("Volverá a salir en la app y su admin podrá entrar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(clubsMock.update).toHaveBeenCalledWith("c-off", { active: true }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Club reactivado"));
  });

  it("reactivar uno que sigue por configurar: el aviso dice que aún no sale en la app", async () => {
    const offStub = { ...STUB, id: "c-off-stub", name: "Club Apagado Stub", deactivatedAt: OFF.deactivatedAt, status: "deactivated" };
    clubsMock.list.mockResolvedValue([offStub]);
    clubsMock.update.mockResolvedValue({ ...offStub, deactivatedAt: null, status: "pending" });
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club Apagado Stub")).getByRole("button", { name: "Reactivar club" }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("Sigue por configurar")));
  });

  it("la confirmación no cambia si la lista se refresca mientras está abierta", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={qc}><ClubesPage /></QueryClientProvider>);
    await showInactive();
    fireEvent.click(within(await cardOf("Club Apagado")).getByRole("button", { name: "Reactivar club" }));
    expect(screen.getByText("¿Reactivar el club?")).toBeInTheDocument();

    // Otro admin lo reactiva y llega el refresco: la tarjeta cambia, el modal no
    clubsMock.list.mockResolvedValue([ACTIVE, { ...OFF, active: true, deactivatedAt: null, status: "active" }, STUB]);
    await qc.invalidateQueries();
    await waitFor(async () =>
      expect(within(await cardOf("Club Apagado")).queryByText("Desactivado")).not.toBeInTheDocument(),
    );

    expect(screen.getByText("¿Reactivar el club?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
    expect(screen.queryByText("¿Desactivar el club?")).not.toBeInTheDocument();
  });

  it("con un back anterior (sin status), un club inactivo se activa como antes", async () => {
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

describe("ClubesPage — ficha del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.list.mockResolvedValue([ACTIVE, OFF, STUB]);
  });

  it("de un club desactivado: la fecha en que lo desactivó AMT", async () => {
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club Apagado")).getByRole("button", { name: "Editar club" }));

    expect(screen.getByText(/AMT lo desactivó el 1\/10\/2026/)).toBeInTheDocument();
  });

  it("de uno por configurar: se activará al guardar sus datos reales, y si pasa a activo el aviso lo dice", async () => {
    clubsMock.update.mockResolvedValue({ ...STUB, name: "Club Real", city: "Getafe", active: true, status: "active", pendingSetup: false });
    renderPage();
    await showInactive();

    fireEvent.click(within(await cardOf("Club por configurar")).getByRole("button", { name: "Editar club" }));
    expect(screen.getByText(/Se activará y saldrá en la app en cuanto se guarden su nombre y su ciudad reales \(también si lo haces tú aquí\)/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Club Padel Pozuelo"), { target: { value: "Club Real" } });
    fireEvent.change(screen.getByPlaceholderText("Madrid"), { target: { value: "Getafe" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Club actualizado y publicado en la app"));
  });
});
