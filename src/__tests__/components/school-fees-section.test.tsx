/**
 * Cuotas de la escuela (F8-C3): las del mes por alumno con lo pagado y lo que
 * falta, generarlas (con avisos), cobrarlas enteras o por partes, cobrar a un
 * alumno todo lo que debe con el reparto a la vista, mirar y deshacer los
 * pagos, recalcular, editar y anular. Sin acceso de escritura, solo se leen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => false }));
const access = vi.hoisted(() => ({ accounts: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: null, can: (area: string) => (area === "accounts" ? access.accounts : true) }),
}));

const school = vi.hoisted(() => ({ groups: { list: vi.fn() } }));
vi.mock("@/lib/services/school", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school")>();
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});
const billing = vi.hoisted(() => ({
  fees: {
    list: vi.fn(), generate: vi.fn(), update: vi.fn(), collect: vi.fn(), unpay: vi.fn(), undoCollection: vi.fn(),
    recalculate: vi.fn(), cancel: vi.fn(), payPending: vi.fn(), pay: vi.fn(),
  },
}));
vi.mock("@/lib/services/school-billing", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school-billing")>();
  return { ...actual, schoolBillingService: { ...actual.schoolBillingService, ...billing } };
});
const recovery = vi.hoisted(() => ({ config: { get: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/services/school-recovery", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school-recovery")>();
  return { ...actual, schoolRecoveryService: { ...actual.schoolRecoveryService, ...recovery } };
});

import { SchoolFeesSection } from "@/components/admin/school-fees-section";

const fee = (over: Record<string, unknown> = {}) => ({
  id: "f1", groupId: "g1", groupName: "Iniciación", clubCustomerId: "cc1", customerName: "Marta",
  month: "2026-11", amountCents: 4500, listCents: 4500, discountCents: null, prorationNote: null,
  paidCents: 0, pendingCents: 4500, status: "OVERDUE", dueDate: "2026-11-10", paymentMethod: null, paidAt: null,
  cancelledAt: null, cancelReason: null, note: null, createdAt: "2026-11-01T10:00:00Z", createdByName: "Gestor", payments: [], ...over,
});
const payment = (over: Record<string, unknown> = {}) => ({
  id: "p1", collectionId: "col-1", amountCents: 4500, paymentMethod: "CARD", bizumPartnerName: null,
  paidAt: "2026-11-10T10:00:00Z", paidByName: "Recepción", ...over,
});
// Entró a mitad de mes, con descuento, y la generó el cron
const MARTA = fee({
  amountCents: 4375, listCents: 8000, discountCents: 625, prorationNote: "5 de 8 clases", pendingCents: 4375,
  createdByName: null,
});
const PABLO = fee({
  id: "f2", customerName: "Pablo", clubCustomerId: "cc2", status: "PAID", paidCents: 4500, pendingCents: 0,
  paymentMethod: "CARD", paidAt: "2026-11-10T10:00:00Z", payments: [payment()],
});
const ANA = fee({
  id: "f3", customerName: "Ana", clubCustomerId: "cc3", status: "CANCELLED", cancelledAt: "2026-11-12T10:00:00Z",
  cancelReason: "PAUSED", note: "Se lo dijo su madre", pendingCents: 4500,
});
const LUIS = fee({
  id: "f4", customerName: "Luis", clubCustomerId: "cc4", status: "PARTIAL", paidCents: 2000, pendingCents: 2500,
  dueDate: "2026-11-30", payments: [payment({ id: "p2", amountCents: 2000, paymentMethod: "BIZUM", bizumPartnerName: "Rodri" })],
});
// Cobrada antes de los pagos por partes: sin lista de pagos
const OLD = fee({
  id: "f5", customerName: "Vieja", clubCustomerId: "cc5", status: "PAID", paidCents: 4500, pendingCents: 0,
  paymentMethod: "CASH", paidAt: "2026-11-02T10:00:00Z",
});

const GROUPS = [
  { id: "g1", name: "Iniciación", monthlyFeeCents: 8000 },
  { id: "g2", name: "Avanzado", monthlyFeeCents: null },
];

function renderSection(canWrite = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SchoolFeesSection clubId="c1" canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };

/** La fila de la tabla de un alumno. */
const row = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

describe("SchoolFeesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.accounts = true;
    // «Hoy» es el 18 de noviembre de 2026: el mes que se abre es noviembre
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    school.groups.list.mockResolvedValue(GROUPS);
    billing.fees.list.mockImplementation((_club: string, filters: { clubCustomerId?: string }) =>
      Promise.resolve(filters.clubCustomerId ? [MARTA, fee({ id: "f9", month: "2026-12", amountCents: 8000, pendingCents: 8000, status: "PENDING", dueDate: "2026-12-10" })] : [MARTA, PABLO, ANA, LUIS, OLD]),
    );
    billing.fees.generate.mockResolvedValue({ month: "2026-11", groups: 1, due: 3, created: 3, existing: 0, warnings: [] });
    billing.fees.collect.mockResolvedValue([MARTA]);
    billing.fees.payPending.mockResolvedValue({ paid: 1, totalCents: 4375 });
    billing.fees.unpay.mockResolvedValue(MARTA);
    billing.fees.undoCollection.mockResolvedValue([PABLO]);
    billing.fees.recalculate.mockResolvedValue(MARTA);
    billing.fees.cancel.mockResolvedValue(ANA);
    billing.fees.update.mockResolvedValue(MARTA);
    recovery.config.get.mockResolvedValue({ recoveryNoticeHours: 24, recoveryValidDays: 60, feeDueDay: 10, autoGenerateFees: false });
    recovery.config.update.mockImplementation((_club: string, payload: object) =>
      Promise.resolve({ recoveryNoticeHours: 24, recoveryValidDays: 60, feeDueDay: 10, autoGenerateFees: false, ...payload }),
    );
  });
  afterEach(() => vi.useRealTimers());

  it("abre el mes de hoy con las columnas Alumno, Grupo, Cuota, Pagado, Pendiente y Estado", async () => {
    renderSection();
    expect(await screen.findByText("Marta", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Noviembre de 2026")).toBeInTheDocument();
    expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-11" });
    for (const name of ["Alumno", "Grupo", "Cuota", "Pagado", "Pendiente", "Estado"]) {
      expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
    }
  });

  it("una cuota archivada (más de 6 años) sale «Archivada» con su explicación, sin importes cobrados ni acciones", async () => {
    billing.fees.list.mockResolvedValue([
      fee({
        id: "f-old", customerName: "Antigua", clubCustomerId: "cc9", month: "2020-10", status: "ARCHIVED",
        paidCents: 0, pendingCents: 0, dueDate: "2020-10-10",
      }),
    ]);
    renderSection();
    await screen.findByText("Antigua", {}, WAIT);
    const antigua = within(row("Antigua"));
    expect(antigua.getByText("Archivada")).toBeInTheDocument();
    expect(antigua.getByText("Más de 6 años: ya no se guardan sus datos de cobro")).toBeInTheDocument();
    // Pagado y pendiente sin cifra
    expect(antigua.getAllByText("—")).toHaveLength(2);
    expect(antigua.queryByText("Hasta el 10")).not.toBeInTheDocument();
    expect(antigua.queryAllByRole("button")).toHaveLength(0);
    // Se puede filtrar por ese estado
    expect(screen.getByRole("option", { name: "Archivada" })).toBeInTheDocument();
  });

  it("cada cuota enseña su estado, lo pagado, lo que falta y cómo se calculó; la del cron, «Automática»", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    const marta = within(row("Marta"));
    expect(marta.getByText("Atrasada")).toBeInTheDocument();
    expect(marta.getByText("43,75 €", { selector: "span.block" })).toBeInTheDocument();
    expect(marta.getByText("5 de 8 clases · − 6,25 €")).toBeInTheDocument();
    expect(marta.getByText("Automática")).toBeInTheDocument();
    expect(marta.getByText("Hasta el 10")).toBeInTheDocument();

    expect(within(row("Pablo")).getByText("Pagada · Tarjeta")).toBeInTheDocument();
    expect(within(row("Pablo")).queryByText("Automática")).not.toBeInTheDocument();
    expect(within(row("Ana")).getByText("Anulada")).toBeInTheDocument();
    // El motivo automático sale aparte de la nota del gestor
    expect(within(row("Ana")).getByText("Baja temporal")).toBeInTheDocument();
    expect(within(row("Ana")).getByText("Se lo dijo su madre")).toBeInTheDocument();
    const luis = within(row("Luis"));
    expect(luis.getByText("Parcial")).toBeInTheDocument();
    // Pagado y pendiente de la parcial
    expect(luis.getByText("20,00 €")).toBeInTheDocument();
    expect(luis.getByText("25,00 €")).toBeInTheDocument();
  });

  it("los totales: pendiente de las no pagadas y cobrado de todas las no anuladas, también lo de las parciales", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    // Pendiente: Marta 43,75 + Luis 25 = 68,75 (2). Cobrado: Pablo 45 + Luis 20 + Vieja 45 = 110 (2 pagadas)
    expect(screen.getByText(/Pendiente:/)).toHaveTextContent("Pendiente: 68,75 € (2) · Cobrado: 110,00 € (2)");
  });

  it("cambiar de mes y filtrar por estado y por grupo lo pide al servidor; los cinco estados", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await waitFor(() => expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-12" }), WAIT);
    expect(screen.getByText("Diciembre de 2026")).toBeInTheDocument();

    const status = screen.getByLabelText("Estado");
    expect(within(status).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Todas", "Pagada", "Parcial", "Atrasada", "Pendiente", "Anulada", "Archivada",
    ]);
    fireEvent.change(status, { target: { value: "OVERDUE" } });
    await waitFor(() => expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-12", status: "OVERDUE" }), WAIT);
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    await waitFor(
      () => expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-12", status: "OVERDUE", groupId: "g1" }),
      WAIT,
    );
  });

  it("generar las cuotas del mes: pide confirmación, llama con el mes y cuenta lo creado", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Generar cuotas de noviembre de 2026/ }));
    expect(billing.fees.generate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Generar cuotas" }));
    await waitFor(() => expect(billing.fees.generate).toHaveBeenCalledWith("c1", "2026-11", undefined), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Se han creado 3 cuotas"), WAIT);
  });

  it("los avisos de generar (grupos sin clases en el calendario) se quedan a la vista", async () => {
    billing.fees.generate.mockResolvedValue({
      month: "2026-11", groups: 1, due: 3, created: 3, existing: 0,
      warnings: ["«Iniciación» no tiene clases en el calendario de 2026-11: sus cuotas son del mes entero"],
    });
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Generar cuotas de noviembre de 2026/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Generar cuotas" }));
    expect(await screen.findByText(/no tiene clases en el calendario/, {}, WAIT)).toBeInTheDocument();
  });

  it("generar con un grupo elegido es solo de ese grupo; si no había nada nuevo, lo dice sin éxito", async () => {
    billing.fees.generate.mockResolvedValue({ month: "2026-11", groups: 1, due: 3, created: 0, existing: 3, warnings: [] });
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(screen.getByRole("button", { name: /Generar cuotas de noviembre de 2026/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Generar cuotas" }));
    await waitFor(() => expect(billing.fees.generate).toHaveBeenCalledWith("c1", "2026-11", "g1"), WAIT);
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("No había cuotas nuevas · 3 ya estaban"), WAIT);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("un error al generar se enseña tal cual", async () => {
    billing.fees.generate.mockRejectedValue({ response: { data: { message: "El grupo está archivado" } } });
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Generar cuotas de noviembre de 2026/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Generar cuotas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El grupo está archivado"), WAIT);
  });

  it("cobrar una cuota: el importe por defecto es lo pendiente, se puede cobrar una parte y no más", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar la cuota de Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar cuota" });
    expect(within(dialog).getByText(/Marta · Iniciación · Noviembre de 2026/)).toBeInTheDocument();
    const amount = within(dialog).getByLabelText("Importe cobrado");
    expect(amount).toHaveValue("43,75");
    const confirm = within(dialog).getByRole("button", { name: "Cobrar" });
    // Sin método elegido no se cobra
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Bizum" }));

    // Más de lo que falta: no se deja
    fireEvent.change(amount, { target: { value: "50" } });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("No puede pasar de lo que falta por cobrar (43,75 €)");
    expect(confirm).toBeDisabled();

    // Una parte: la cuota queda parcial
    fireEvent.change(amount, { target: { value: "20" } });
    expect(within(dialog).getByText(/quedarán 23,75 € por cobrar/)).toBeInTheDocument();
    fireEvent.click(confirm);
    await waitFor(
      () =>
        expect(billing.fees.collect).toHaveBeenCalledWith("c1", {
          clubCustomerId: "cc1", amountCents: 2000, paymentMethod: "BIZUM", feeIds: ["f1"],
        }),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cobrado"), WAIT);
  });

  it("cobrar al alumno: el reparto de lo que debe, de la cuota más antigua a la más nueva, y el cambio si sobra", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Marta todo lo que debe" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar al alumno" });
    await waitFor(() => expect(billing.fees.list).toHaveBeenCalledWith("c1", { clubCustomerId: "cc1" }), WAIT);
    const split = await within(dialog).findByRole("list", { name: "Reparto" });
    const items = within(split).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Noviembre de 2026 · Iniciación");
    expect(items[1]).toHaveTextContent("Diciembre de 2026 · Iniciación");
    // Por defecto, todo lo que debe: 43,75 + 80
    expect(within(dialog).getByLabelText("Importe recibido")).toHaveValue("123,75");
    expect(within(dialog).getByRole("button", { name: "Cobrar 123,75 €" })).toBeDisabled();

    // 50 €: paga noviembre entero y 6,25 de diciembre
    fireEvent.change(within(dialog).getByLabelText("Importe recibido"), { target: { value: "50" } });
    expect(items[0]).toHaveTextContent("43,75 €");
    expect(items[1]).toHaveTextContent("6,25 €");
    fireEvent.click(within(dialog).getByRole("button", { name: "Efectivo" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar 50,00 €" }));
    await waitFor(
      () =>
        expect(billing.fees.collect).toHaveBeenCalledWith("c1", {
          clubCustomerId: "cc1", amountCents: 5000, paymentMethod: "CASH",
        }),
      WAIT,
    );
  });

  it("cobrar al alumno más de lo que debe: se cobra lo que debe y se enseña el cambio", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar a Marta todo lo que debe" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar al alumno" });
    const amount = await within(dialog).findByLabelText("Importe recibido");
    fireEvent.change(amount, { target: { value: "130" } });
    expect(within(dialog).getByRole("status")).toHaveTextContent("Cambio a devolver: 6,25 €");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tarjeta" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar 123,75 €" }));
    await waitFor(
      () =>
        expect(billing.fees.collect).toHaveBeenCalledWith("c1", {
          clubCustomerId: "cc1", amountCents: 12375, paymentMethod: "CARD",
        }),
      WAIT,
    );
  });

  it("ver los pagos: cada uno con su método y quién lo cobró; «Deshacer este cobro» pide confirmación", async () => {
    renderSection();
    await screen.findByText("Pablo", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Ver los pagos de la cuota de Pablo" }));
    const dialog = await screen.findByRole("dialog", { name: "Pagos de la cuota" });
    expect(within(dialog).getByText(/45,00 € · Tarjeta/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Recepción/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Deshacer el cobro de 45,00 €" }));
    expect(billing.fees.undoCollection).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Deshacer el cobro" }));
    await waitFor(() => expect(billing.fees.undoCollection).toHaveBeenCalledWith("c1", "col-1"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cobro deshecho"), WAIT);
  });

  it("un Bizum a un socio sale con su nombre en los pagos", async () => {
    renderSection();
    await screen.findByText("Luis", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Ver los pagos de la cuota de Luis" }));
    const dialog = await screen.findByRole("dialog", { name: "Pagos de la cuota" });
    expect(within(dialog).getByText(/20,00 € · Bizum · Rodri/)).toBeInTheDocument();
  });

  it("una cuota cobrada antes de los pagos por partes se deshace entera con «Quitar el cobro»", async () => {
    renderSection();
    await screen.findByText("Vieja", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Ver los pagos de la cuota de Vieja" }));
    const dialog = await screen.findByRole("dialog", { name: "Pagos de la cuota" });
    expect(within(dialog).getByText(/Cobrada entera \(Efectivo/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar el cobro" }));
    expect(billing.fees.unpay).not.toHaveBeenCalled();
    const confirms = await screen.findAllByRole("button", { name: "Quitar el cobro" });
    fireEvent.click(confirms[confirms.length - 1]);
    await waitFor(() => expect(billing.fees.unpay).toHaveBeenCalledWith("c1", "f5"), WAIT);
  });

  it("recalcular pide confirmación y llama con la cuota; si ya no toca, lo dice", async () => {
    billing.fees.recalculate.mockResolvedValue({ ...MARTA, status: "CANCELLED" });
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Recalcular la cuota de Marta" }));
    expect(billing.fees.recalculate).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Recalcular" }));
    await waitFor(() => expect(billing.fees.recalculate).toHaveBeenCalledWith("c1", "f1"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Ya no toca cuota: se ha anulado"), WAIT);
  });

  it("anular una cuota pendiente, con su motivo", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Anular la cuota de Marta" }));
    fireEvent.change(await screen.findByLabelText("Motivo de la anulación"), { target: { value: " Se dio de baja " } });
    fireEvent.click(screen.getByRole("button", { name: "Anular cuota" }));
    await waitFor(() => expect(billing.fees.cancel).toHaveBeenCalledWith("c1", "f1", "Se dio de baja"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cuota anulada"), WAIT);
  });

  it("editar el importe: euros a céntimos; uno mal escrito o por debajo de lo pagado no se manda", async () => {
    renderSection();
    await screen.findByText("Luis", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Editar la cuota de Luis" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar cuota" });
    const amount = within(dialog).getByLabelText("Importe de la cuota");
    expect(amount).toHaveValue("45,00");
    expect(within(dialog).getByText(/Ya lleva pagados 20,00 €/)).toBeInTheDocument();

    fireEvent.change(amount, { target: { value: "abc" } });
    expect(within(dialog).getByRole("button", { name: "Guardar cuota" })).toBeDisabled();
    fireEvent.change(amount, { target: { value: "19,99" } });
    expect(within(dialog).getByRole("button", { name: "Guardar cuota" })).toBeDisabled();

    fireEvent.change(amount, { target: { value: "30,50" } });
    fireEvent.change(within(dialog).getByLabelText("Nota (opcional)"), { target: { value: "Entró a mitad de mes" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cuota" }));
    await waitFor(
      () => expect(billing.fees.update).toHaveBeenCalledWith("c1", "f4", { amountCents: 3050, note: "Entró a mitad de mes" }),
      WAIT,
    );
  });

  it("qué botones tiene cada cuota según su estado", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    const labels = (name: string) => within(row(name)).queryAllByRole("button").map((b) => b.textContent?.trim());
    // Sin pagos: se cobra, se recalcula, se anula y se edita
    expect(labels("Marta")).toEqual(["Cobrar", "Al alumno", "Recalcular", "Anular", "Editar"]);
    // Parcial: se cobra el resto, se ven los pagos y se edita (no se anula con pagos)
    expect(labels("Luis")).toEqual(["Cobrar", "Al alumno", "Ver pagos", "Editar"]);
    expect(labels("Pablo")).toEqual(["Ver pagos", "Editar"]);
    expect(labels("Ana")).toEqual([]);
  });

  describe("sin acceso a las cuentas (recepción)", () => {
    beforeEach(() => {
      access.accounts = false;
    });

    it("no recalcula y no cambia el importe, pero sí la nota", async () => {
      renderSection();
      await screen.findByText("Marta", {}, WAIT);
      const labels = within(row("Marta")).queryAllByRole("button").map((b) => b.textContent?.trim());
      expect(labels).toEqual(["Cobrar", "Al alumno", "Anular", "Editar"]);
      fireEvent.click(screen.getByRole("button", { name: "Editar la cuota de Marta" }));
      const dialog = await screen.findByRole("dialog", { name: "Editar cuota" });
      expect(within(dialog).getByLabelText("Importe de la cuota")).toBeDisabled();
      expect(within(dialog).getByLabelText("Nota (opcional)")).toBeEnabled();
    });

    it("deshace el cobro de hoy pero no el de un día anterior", async () => {
      // Hoy es el 18-11: Pablo cobró el 10, Luis hoy
      billing.fees.list.mockResolvedValue([
        PABLO,
        fee({
          id: "f4", customerName: "Luis", clubCustomerId: "cc4", status: "PARTIAL", paidCents: 2000, pendingCents: 2500,
          payments: [payment({ id: "p2", collectionId: "col-2", amountCents: 2000, paidAt: "2026-11-18T08:00:00Z" })],
        }),
      ]);
      renderSection();
      await screen.findByText("Pablo", {}, WAIT);
      fireEvent.click(screen.getByRole("button", { name: "Ver los pagos de la cuota de Pablo" }));
      let dialog = await screen.findByRole("dialog", { name: "Pagos de la cuota" });
      expect(within(dialog).getByRole("button", { name: "Deshacer el cobro de 45,00 €" })).toBeDisabled();
      fireEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" }).at(-1) as HTMLElement);
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pagos de la cuota" })).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "Ver los pagos de la cuota de Luis" }));
      dialog = await screen.findByRole("dialog", { name: "Pagos de la cuota" });
      expect(within(dialog).getByRole("button", { name: "Deshacer el cobro de 20,00 €" })).toBeEnabled();
    });

    it("una cuota antigua cobrada un día anterior no se destapa", async () => {
      renderSection();
      await screen.findByText("Vieja", {}, WAIT);
      fireEvent.click(screen.getByRole("button", { name: "Ver los pagos de la cuota de Vieja" }));
      const dialog = await screen.findByRole("dialog", { name: "Pagos de la cuota" });
      expect(within(dialog).getByRole("button", { name: "Quitar el cobro" })).toBeDisabled();
    });
  });

  it("sin acceso de escritura, solo se leen: sin generar ni botones por cuota", async () => {
    renderSection(false);
    await screen.findByText("Marta", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Generar cuotas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver los pagos/ })).not.toBeInTheDocument();
  });

  it("sin cuotas lo dice; sin ningún grupo con cuota, avisa de dónde ponerla", async () => {
    billing.fees.list.mockResolvedValue([]);
    school.groups.list.mockResolvedValue([{ id: "g2", name: "Avanzado", monthlyFeeCents: null }]);
    renderSection();
    expect(await screen.findByText(/No hay cuotas de este mes/, {}, WAIT)).toBeInTheDocument();
    expect(await screen.findByText(/Ningún grupo tiene cuota mensual/, {}, WAIT)).toBeInTheDocument();
  });

  it("cobrar todas las pendientes del mes: enseña cuántas y el total, pide el método y llama con el mes y el grupo", async () => {
    billing.fees.list.mockResolvedValue([MARTA, PABLO]);
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    fireEvent.click(await screen.findByRole("button", { name: "Cobrar todas (1)" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar todas las cuotas pendientes" });
    expect(dialog).toHaveTextContent("Noviembre de 2026, Iniciación: 1 cuota, 43,75 € en total");
    const confirm = within(dialog).getByRole("button", { name: "Cobrar 43,75 €" });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Bizum" }));
    fireEvent.click(confirm);
    await waitFor(() => expect(billing.fees.payPending).toHaveBeenCalledWith("c1", "2026-11", "BIZUM", "g1"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("1 cuota cobrada: 43,75 €"), WAIT);
  });

  it("sin cuotas pendientes no hay «Cobrar todas»", async () => {
    billing.fees.list.mockResolvedValue([PABLO]);
    renderSection();
    await screen.findByText("Pablo", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Cobrar todas/ })).not.toBeInTheDocument();
  });

  it("ajustes de las cuotas: el día límite (1 a 28) y generarlas solas se guardan en la configuración", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    const form = await screen.findByRole("form", { name: "Ajustes de las cuotas" }, WAIT);
    const day = within(form).getByLabelText(/Día límite de pago/);
    expect(day).toHaveValue(10);
    const save = within(form).getByRole("button", { name: "Guardar ajustes" });
    expect(save).toBeDisabled();

    fireEvent.change(day, { target: { value: "29" } });
    fireEvent.click(save);
    await waitFor(() => expect(toast.error).toHaveBeenCalled(), WAIT);
    expect(recovery.config.update).not.toHaveBeenCalled();

    fireEvent.change(day, { target: { value: "15" } });
    fireEvent.click(within(form).getByLabelText("Generar las cuotas solas cada mes"));
    fireEvent.click(save);
    await waitFor(
      () => expect(recovery.config.update).toHaveBeenCalledWith("c1", { feeDueDay: 15, autoGenerateFees: true }),
      WAIT,
    );
  });

  it("sin permiso de escritura, los ajustes de las cuotas se leen pero no se tocan", async () => {
    renderSection(false);
    const form = await screen.findByRole("form", { name: "Ajustes de las cuotas" }, WAIT);
    expect(within(form).getByLabelText(/Día límite de pago/)).toBeDisabled();
    expect(within(form).queryByRole("button", { name: "Guardar ajustes" })).not.toBeInTheDocument();
  });
});
