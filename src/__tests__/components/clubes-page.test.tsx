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
  list:             vi.fn(),
  update:           vi.fn(),
  deactivate:       vi.fn(),
  geocodeBatch:     vi.fn(),
  admins:           vi.fn(),
  inviteAdmin:      vi.fn(),
  resendInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({ adminService: { clubs: clubsMock } }));

const activationMock = vi.hoisted(() => ({ state: vi.fn(), approve: vi.fn() }));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: { activation: activationMock } };
});

import ClubesPage from "../../../app/(admin)/clubes/page";
import { ApiError } from "@/lib/api";

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

describe("ClubesPage — reservas del club (R1-7)", () => {
  const state = (status: string, extra = {}) => ({
    bookingEnabled: status !== "INACTIVE", bookingPublicAt: null, status, activeTesterCount: 0, ...extra,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.list.mockResolvedValue([ACTIVE]);
  });

  it("AMT aprueba la activación desde la tarjeta y el estado pasa a modo prueba", async () => {
    activationMock.state.mockResolvedValueOnce(state("INACTIVE")).mockResolvedValue(state("TESTER_MODE"));
    activationMock.approve.mockResolvedValue({});
    renderPage();

    fireEvent.click(within(await cardOf("Club Activo")).getByRole("button", { name: "Reservas del club" }));
    const dialog = await screen.findByRole("dialog", { name: "Reservas — Club Activo" });
    fireEvent.click(await within(dialog).findByRole("button", { name: "Aprobar activación" }));

    await waitFor(() => expect(activationMock.approve).toHaveBeenCalledWith("c-activo"));
    expect(await within(dialog).findByText(/Aprobado, en modo prueba/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Aprobar activación" })).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining("Activación aprobada"));
  });

  it("si ya es público no ofrece aprobar", async () => {
    activationMock.state.mockResolvedValue(state("PUBLIC", { bookingPublicAt: "2026-10-01T10:00:00.000Z" }));
    renderPage();

    fireEvent.click(within(await cardOf("Club Activo")).getByRole("button", { name: "Reservas del club" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Abierto al público desde el 1\/10\/26/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Aprobar activación" })).not.toBeInTheDocument();
  });
});

describe("ClubesPage — administradores del club (L25)", () => {
  const ADMIN = { id: "u-1", name: "Admin Club", email: "admin@club.com", createdAt: "2026-09-01T10:00:00.000Z" };
  const PENDING = {
    id: "inv-1", email: "viva@club.com", status: "pending",
    createdAt: "2026-10-30T09:00:00.000Z", expiresAt: "2026-11-06T09:00:00.000Z",
    invitedBy: { id: "amt-1", name: "Ana AMT" },
  };
  const EXPIRED = {
    id: "inv-2", email: "caducada@club.com", status: "expired",
    createdAt: "2026-10-01T09:00:00.000Z", expiresAt: "2026-10-08T09:00:00.000Z",
    invitedBy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clubsMock.list.mockResolvedValue([ACTIVE]);
    clubsMock.admins.mockResolvedValue({ admins: [ADMIN], invitations: [PENDING, EXPIRED] });
  });

  async function openAdmins(name = "Club Activo") {
    fireEvent.click(within(await cardOf(name)).getByRole("button", { name: "Administradores del club" }));
    return screen.findByRole("dialog", { name: `Administradores — ${name}` });
  }

  it("desde la tarjeta: sus admins y sus invitaciones pendientes y caducadas, con sus fechas", async () => {
    renderPage();
    const dialog = await openAdmins();

    expect(await within(dialog).findByText("Admin Club")).toBeInTheDocument();
    expect(within(dialog).getByText("admin@club.com · Desde el 1/9/26")).toBeInTheDocument();
    expect(within(dialog).getByText("viva@club.com")).toBeInTheDocument();
    expect(within(dialog).getByText("Pendiente")).toBeInTheDocument();
    expect(within(dialog).getByText("Enviada el 30/10/26 por Ana AMT · caduca el 6/11/26")).toBeInTheDocument();
    expect(within(dialog).getByText("caducada@club.com")).toBeInTheDocument();
    expect(within(dialog).getByText("Caducada")).toBeInTheDocument();
    expect(within(dialog).getByText("Enviada el 1/10/26 · caducó el 8/10/26")).toBeInTheDocument();
    expect(clubsMock.admins).toHaveBeenCalledWith("c-activo");
  });

  it("sin admins ni invitaciones lo dice", async () => {
    clubsMock.admins.mockResolvedValue({ admins: [], invitations: [] });
    renderPage();
    const dialog = await openAdmins();

    expect(await within(dialog).findByText("Aún no tiene ningún administrador.")).toBeInTheDocument();
    expect(within(dialog).getByText("No hay invitaciones pendientes.")).toBeInTheDocument();
  });

  it("Reenviar pide confirmación, reenvía y vuelve a pedir la lista", async () => {
    clubsMock.resendInvitation.mockResolvedValue({ id: "inv-3", expiresAt: "2026-11-07T09:00:00.000Z" });
    renderPage();
    const dialog = await openAdmins();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Reenviar la invitación a caducada@club.com" }));
    expect(screen.getByText("¿Reenviar la invitación a caducada@club.com?")).toBeInTheDocument();
    expect(screen.getByText(/El que tenga ahora dejará de valer/)).toBeInTheDocument();
    expect(clubsMock.resendInvitation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));

    await waitFor(() => expect(clubsMock.resendInvitation).toHaveBeenCalledWith("c-activo", "inv-2"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Invitación reenviada a caducada@club.com"));
    expect(clubsMock.admins).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("¿Reenviar la invitación a caducada@club.com?")).not.toBeInTheDocument();
  });

  it("Anular pide confirmación, la anula y deja de salir", async () => {
    clubsMock.admins
      .mockResolvedValueOnce({ admins: [ADMIN], invitations: [PENDING, EXPIRED] })
      .mockResolvedValue({ admins: [ADMIN], invitations: [EXPIRED] });
    clubsMock.revokeInvitation.mockResolvedValue("");
    renderPage();
    const dialog = await openAdmins();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Anular la invitación a viva@club.com" }));
    expect(screen.getByText("¿Anular la invitación a viva@club.com?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anular invitación" }));

    await waitFor(() => expect(clubsMock.revokeInvitation).toHaveBeenCalledWith("c-activo", "inv-1"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Invitación a viva@club.com anulada"));
    await waitFor(() => expect(within(dialog).queryByText("viva@club.com")).not.toBeInTheDocument());
  });

  it("Cancelar no anula nada", async () => {
    renderPage();
    const dialog = await openAdmins();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Anular la invitación a viva@club.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("¿Anular la invitación a viva@club.com?")).not.toBeInTheDocument();
    expect(clubsMock.revokeInvitation).not.toHaveBeenCalled();
  });

  it("si la invitación cambió mientras tanto: el error del back y la lista se recarga", async () => {
    clubsMock.resendInvitation.mockRejectedValue(
      new ApiError("Esta invitación ya se aceptó: su admin ya tiene cuenta", 409, "CLUB_INVITATION_ALREADY_ACCEPTED"),
    );
    renderPage();
    const dialog = await openAdmins();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Reenviar la invitación a viva@club.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Esta invitación ya se aceptó: su admin ya tiene cuenta"),
    );
    await waitFor(() => expect(clubsMock.admins).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("¿Reenviar la invitación a viva@club.com?")).not.toBeInTheDocument();
  });

  it("otro error (el email ya tiene cuenta): lo dice, sin recargar la lista", async () => {
    clubsMock.resendInvitation.mockRejectedValue(
      new ApiError("Ese email ya está registrado en la plataforma", 409, "CLUB_INVITATION_EMAIL_TAKEN"),
    );
    renderPage();
    const dialog = await openAdmins();

    fireEvent.click(await within(dialog).findByRole("button", { name: "Reenviar la invitación a viva@club.com" }));
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Ese email ya está registrado en la plataforma"),
    );
    expect(clubsMock.admins).toHaveBeenCalledTimes(1);
  });

  it("Invitar admin a este club: comprueba el email, invita y vacía el campo", async () => {
    clubsMock.inviteAdmin.mockResolvedValue({ id: "inv-9", expiresAt: "2026-11-06T09:00:00.000Z" });
    renderPage();
    const dialog = await openAdmins();
    const input = await within(dialog).findByLabelText("Invitar admin");

    // Sin dominio con punto: el navegador lo da por bueno, el panel no
    fireEvent.change(input, { target: { value: "admin@club" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Invitar" }));
    expect(toastMock.error).toHaveBeenCalledWith("Introduce un email válido");
    expect(clubsMock.inviteAdmin).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  nuevo@club.com " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Invitar" }));

    await waitFor(() => expect(clubsMock.inviteAdmin).toHaveBeenCalledWith("c-activo", "nuevo@club.com"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Invitación enviada a nuevo@club.com"));
    expect(input).toHaveValue("");
    expect(clubsMock.admins).toHaveBeenCalledTimes(2);
  });

  it("club desactivado: no deja invitar ni reenviar (el back lo rechazaría), sí anular", async () => {
    clubsMock.list.mockResolvedValue([ACTIVE, OFF]);
    renderPage();
    await showInactive();
    const dialog = await openAdmins("Club Apagado");

    expect(await within(dialog).findByRole("button", { name: "Reenviar la invitación a viva@club.com" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Anular la invitación a viva@club.com" })).toBeEnabled();
    expect(within(dialog).getByLabelText("Invitar admin")).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Invitar" })).toBeDisabled();
    expect(within(dialog).getByText(/El club está desactivado: reactívalo/)).toBeInTheDocument();
  });

  it("si no carga, lo dice", async () => {
    clubsMock.admins.mockRejectedValue(new ApiError("Error de conexión"));
    renderPage();
    const dialog = await openAdmins();

    expect(await within(dialog).findByText("No se pudieron cargar los administradores del club.")).toBeInTheDocument();
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
