/**
 * Cuotas de la escuela: las del mes por alumno, generarlas (sin duplicar, lo
 * decide el back), cobrarlas en el mostrador, quitar el cobro, editar el
 * importe y anular. Sin acceso de escritura, solo se leen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));

const school = vi.hoisted(() => ({ groups: { list: vi.fn() } }));
vi.mock("@/lib/services/school", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school")>();
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});
const billing = vi.hoisted(() => ({
  fees: { list: vi.fn(), generate: vi.fn(), update: vi.fn(), pay: vi.fn(), unpay: vi.fn(), cancel: vi.fn() },
}));
vi.mock("@/lib/services/school-billing", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school-billing")>();
  return { ...actual, schoolBillingService: { ...actual.schoolBillingService, ...billing } };
});

import { SchoolFeesSection } from "@/components/admin/school-fees-section";

const fee = (over: Record<string, unknown> = {}) => ({
  id: "f1", groupId: "g1", groupName: "Iniciación", clubCustomerId: "cc1", customerName: "Marta",
  month: "2026-11", amountCents: 4500, status: "pending", paymentMethod: null, paidAt: null,
  cancelledAt: null, note: null, createdAt: "2026-11-01T10:00:00Z", ...over,
});
const PENDING = fee();
const PAID = fee({ id: "f2", customerName: "Pablo", status: "paid", paymentMethod: "CARD", paidAt: "2026-11-10T10:00:00Z" });
const CANCELLED = fee({ id: "f3", customerName: "Ana", status: "cancelled", cancelledAt: "2026-11-12T10:00:00Z" });

const GROUPS = [
  { id: "g1", name: "Iniciación", monthlyFeeCents: 4500 },
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

/** La fila de la lista de un alumno. */
const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("SchoolFeesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // «Hoy» es el 18 de noviembre de 2026: el mes que se abre es noviembre
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    school.groups.list.mockResolvedValue(GROUPS);
    billing.fees.list.mockResolvedValue([PENDING, PAID, CANCELLED]);
    billing.fees.generate.mockResolvedValue({ month: "2026-11", groups: 1, due: 3, created: 3, existing: 0 });
    billing.fees.pay.mockResolvedValue(PAID);
    billing.fees.unpay.mockResolvedValue(PENDING);
    billing.fees.cancel.mockResolvedValue(CANCELLED);
    billing.fees.update.mockResolvedValue(PENDING);
  });
  afterEach(() => vi.useRealTimers());

  it("abre el mes de hoy y enseña cada cuota con su estado, su grupo y su importe; los totales no cuentan las anuladas", async () => {
    renderSection();
    expect(await screen.findByText("Marta", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Noviembre de 2026")).toBeInTheDocument();
    expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-11" });
    expect(within(row("Marta")).getByText("Pendiente")).toBeInTheDocument();
    expect(within(row("Pablo")).getByText("Cobrada · Tarjeta")).toBeInTheDocument();
    expect(within(row("Ana")).getByText("Anulada")).toBeInTheDocument();
    expect(screen.getAllByText(/Iniciación · 45,00 €/)).toHaveLength(3);
    const totals = screen.getByText(/Pendiente:/);
    expect(totals).toHaveTextContent("Pendiente: 45,00 € (1) · Cobrado: 45,00 € (1)");
  });

  it("cambiar de mes y filtrar por estado y por grupo lo pide al servidor", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await waitFor(() => expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-12" }), WAIT);
    expect(screen.getByText("Diciembre de 2026")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "pending" } });
    await waitFor(() => expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-12", status: "pending" }), WAIT);
    fireEvent.change(screen.getByLabelText("Grupo"), { target: { value: "g1" } });
    await waitFor(
      () => expect(billing.fees.list).toHaveBeenCalledWith("c1", { month: "2026-12", status: "pending", groupId: "g1" }),
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

  it("generar con un grupo elegido es solo de ese grupo; si no había nada nuevo, lo dice sin éxito", async () => {
    billing.fees.generate.mockResolvedValue({ month: "2026-11", groups: 1, due: 3, created: 0, existing: 3 });
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

  it("cobrar una cuota: el método de la lista, sin importe que cambiar", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Cobrar la cuota de Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Cobrar cuota" });
    expect(within(dialog).getByText(/Marta · Iniciación · Noviembre de 2026/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Cobrar" });
    // Sin método elegido no se cobra
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Bizum" }));
    fireEvent.click(confirm);
    await waitFor(() => expect(billing.fees.pay).toHaveBeenCalledWith("c1", "f1", "BIZUM"), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cuota cobrada"), WAIT);
  });

  it("quitar el cobro de una cuota cobrada pide confirmación", async () => {
    renderSection();
    await screen.findByText("Pablo", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Quitar el cobro de la cuota de Pablo" }));
    expect(billing.fees.unpay).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Quitar el cobro" }));
    await waitFor(() => expect(billing.fees.unpay).toHaveBeenCalledWith("c1", "f2"), WAIT);
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

  it("editar el importe: euros a céntimos; uno mal escrito no se manda", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Editar la cuota de Marta" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar cuota" });
    const amount = within(dialog).getByLabelText("Importe de la cuota");
    expect(amount).toHaveValue("45,00");

    fireEvent.change(amount, { target: { value: "abc" } });
    expect(within(dialog).getByRole("button", { name: "Guardar cuota" })).toBeDisabled();

    fireEvent.change(amount, { target: { value: "30,50" } });
    fireEvent.change(within(dialog).getByLabelText("Nota (opcional)"), { target: { value: "Entró a mitad de mes" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cuota" }));
    await waitFor(
      () => expect(billing.fees.update).toHaveBeenCalledWith("c1", "f1", { amountCents: 3050, note: "Entró a mitad de mes" }),
      WAIT,
    );
  });

  it("solo las pendientes se cobran, editan o anulan; las cobradas, solo quitar el cobro; las anuladas, nada", async () => {
    renderSection();
    await screen.findByText("Marta", {}, WAIT);
    const labels = (name: string) => within(row(name)).queryAllByRole("button").map((b) => b.textContent?.trim());
    expect(labels("Marta")).toEqual(["Cobrar", "Editar", "Anular"]);
    expect(labels("Pablo")).toEqual(["Quitar cobro"]);
    expect(labels("Ana")).toEqual([]);
  });

  it("sin acceso de escritura, solo se leen: sin generar ni botones por cuota", async () => {
    renderSection(false);
    await screen.findByText("Marta", {}, WAIT);
    expect(screen.queryByRole("button", { name: /Generar cuotas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar el cobro/ })).not.toBeInTheDocument();
  });

  it("sin cuotas lo dice; sin ningún grupo con cuota, avisa de dónde ponerla", async () => {
    billing.fees.list.mockResolvedValue([]);
    school.groups.list.mockResolvedValue([{ id: "g2", name: "Avanzado", monthlyFeeCents: null }]);
    renderSection();
    expect(await screen.findByText(/No hay cuotas de este mes/, {}, WAIT)).toBeInTheDocument();
    expect(await screen.findByText(/Ningún grupo tiene cuota mensual/, {}, WAIT)).toBeInTheDocument();
  });
});
