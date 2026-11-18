/**
 * Recuperaciones de la escuela (pestaña del gestor): los ajustes de las dos
 * ventanas del club, los créditos con sus filtros, conceder uno a mano y
 * anularlo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/booking-customer-picker", () => ({
  BookingCustomerPicker: ({ onChange }: { onChange: (c: unknown) => void }) => (
    <button onClick={() => onChange({ id: "cc-9", name: "Nuria Nueva" })}>Elegir cliente</button>
  ),
}));

const recovery = vi.hoisted(() => ({
  config: { get: vi.fn(), update: vi.fn() },
  credits: { list: vi.fn(), grant: vi.fn(), void: vi.fn() },
}));
vi.mock("@/lib/services/school-recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/school-recovery")>("@/lib/services/school-recovery");
  return { ...actual, schoolRecoveryService: { ...actual.schoolRecoveryService, ...recovery } };
});

import { SchoolRecoveriesSection } from "@/components/admin/school-recoveries-section";

const WAIT = { timeout: 5000 };

const credit = (id: string, customerName: string, over: Record<string, unknown> = {}) => ({
  id, clubCustomerId: `cc-${id}`, customerName, origin: "ABSENCE", status: "available",
  expiresAt: "2027-01-22T22:59:59.999Z",
  sourceSession: { id: "ses0", startsAt: "2026-11-23T17:00:00.000Z", groupName: "Iniciación" },
  usedSession: null, usedAt: null, voidedAt: null, note: null, createdAt: "2026-11-20T10:00:00.000Z",
  ...over,
});

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SchoolRecoveriesSection clubId="c1" timeZone="Europe/Madrid" />
    </QueryClientProvider>,
  );
}

describe("Escuela: recuperaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recovery.config.get.mockResolvedValue({ recoveryNoticeHours: 24, recoveryValidDays: 60 });
    recovery.credits.list.mockResolvedValue([
      credit("a", "Ana Prueba"),
      credit("b", "Beto Prueba", {
        origin: "CLUB_CANCELLED", status: "used",
        usedSession: { id: "ses5", startsAt: "2026-12-01T17:00:00.000Z", groupName: "Avanzado" }, usedAt: "2026-11-25T10:00:00.000Z",
      }),
      credit("m", "Carla Prueba", { origin: "MANUAL", sourceSession: null, note: "Lesión" }),
    ]);
  });

  it("enseña los créditos con su estado, de dónde vienen, hasta cuándo valen y dónde se gastaron", async () => {
    renderSection();
    const list = await screen.findByRole("list", { name: "Recuperaciones" }, { timeout: 5000 });
    const [ana, beto, carla] = within(list).getAllByRole("listitem");
    expect(ana).toHaveTextContent("Ana Prueba");
    expect(ana).toHaveTextContent("Disponible");
    expect(ana).toHaveTextContent("Ausencia avisada · Iniciación, lun, 23 nov · vale hasta el 22 ene 2027");
    expect(beto).toHaveTextContent("Usada");
    expect(beto).toHaveTextContent("Clase cancelada por el club");
    expect(beto).toHaveTextContent("Gastada en Avanzado, mar, 1 dic");
    expect(carla).toHaveTextContent("Concedida a mano");
    expect(carla).toHaveTextContent("Motivo: Lesión");
    // Solo las disponibles se pueden anular
    expect(within(ana).getByRole("button", { name: "Anular la recuperación de Ana Prueba" })).toBeInTheDocument();
    expect(within(beto).queryByRole("button")).not.toBeInTheDocument();
    // Por defecto, las disponibles
    expect(recovery.credits.list).toHaveBeenCalledWith("c1", { status: "available" });
  });

  it("filtra por estado y por cliente, y «Todas» no manda estado", async () => {
    renderSection();
    await screen.findByRole("list", { name: "Recuperaciones" }, WAIT);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "used" } });
    await waitFor(() => expect(recovery.credits.list).toHaveBeenCalledWith("c1", { status: "used" }), WAIT);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "all" } });
    await waitFor(() => expect(recovery.credits.list).toHaveBeenCalledWith("c1", {}), WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Elegir cliente" }));
    await waitFor(() => expect(recovery.credits.list).toHaveBeenCalledWith("c1", { clubCustomerId: "cc-9" }), WAIT);
  });

  it("sin créditos con esos filtros, lo dice", async () => {
    recovery.credits.list.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText("No hay recuperaciones con estos filtros.", {}, WAIT)).toBeInTheDocument();
  });

  it("los ajustes: solo se guardan si cambian y con las mismas reglas que el back", async () => {
    recovery.config.update.mockResolvedValue({ recoveryNoticeHours: 48, recoveryValidDays: 60 });
    renderSection();
    const form = await screen.findByRole("form", { name: "Ajustes de las recuperaciones" }, WAIT);
    const save = within(form).getByRole("button", { name: "Guardar ajustes" });
    expect(save).toBeDisabled();
    const hours = within(form).getByLabelText(/Antelación del aviso/);
    const days = within(form).getByLabelText(/Validez del crédito/);
    expect(hours).toHaveValue(24);
    expect(days).toHaveValue(60);

    fireEvent.change(days, { target: { value: "0" } });
    fireEvent.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("entre 1 y 730")), WAIT);
    expect(recovery.config.update).not.toHaveBeenCalled();

    fireEvent.change(days, { target: { value: "60" } });
    fireEvent.change(hours, { target: { value: "48" } });
    fireEvent.click(save);
    await waitFor(
      () => expect(recovery.config.update).toHaveBeenCalledWith("c1", { recoveryNoticeHours: 48, recoveryValidDays: 60 }),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Ajustes guardados")), WAIT);
    // Lo guardado pasa a ser lo de servidor (el formulario se rehace con ello): ya no hay nada pendiente
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar ajustes" })).toBeDisabled(), WAIT);
    expect(screen.getByLabelText(/Antelación del aviso/)).toHaveValue(48);
  });

  it("conceder a mano pide cliente y motivo, y lo manda", async () => {
    recovery.credits.grant.mockResolvedValue(credit("n", "Nuria Nueva", { origin: "MANUAL", sourceSession: null }));
    renderSection();
    await screen.findByRole("list", { name: "Recuperaciones" }, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Conceder a mano/ }));
    const dialog = await screen.findByRole("dialog", { name: "Conceder una recuperación" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Conceder" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Elige al cliente"), WAIT);
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir cliente" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Conceder" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Escribe por qué se le concede"), WAIT);
    expect(recovery.credits.grant).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByPlaceholderText(/Lesión/), { target: { value: " Clase que no se dio " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Conceder" }));
    await waitFor(() => expect(recovery.credits.grant).toHaveBeenCalledWith("c1", "cc-9", "Clase que no se dio"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Recuperación concedida a Nuria Nueva"), WAIT);
  });

  it("anular pide confirmación y, si ya se gastó a la vez, enseña el motivo", async () => {
    recovery.credits.void.mockRejectedValue({ response: { data: { message: "El crédito acaba de gastarse en una clase" } } });
    renderSection();
    await screen.findByRole("list", { name: "Recuperaciones" }, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Anular la recuperación de Ana Prueba" }));
    const dialog = await screen.findByRole("dialog", { name: "Anular la recuperación" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Anular recuperación" }));
    await waitFor(() => expect(recovery.credits.void).toHaveBeenCalledWith("c1", "a"), WAIT);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El crédito acaba de gastarse en una clase"), WAIT);
  });

  it("anular una disponible la anula", async () => {
    recovery.credits.void.mockResolvedValue(credit("a", "Ana Prueba", { status: "voided" }));
    renderSection();
    await screen.findByRole("list", { name: "Recuperaciones" }, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Anular la recuperación de Ana Prueba" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Anular la recuperación" })).getByRole("button", { name: "Anular recuperación" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Recuperación anulada"), WAIT);
  });
});
