/**
 * «Gastos e ingresos» (F8-C1): lista por mes con filtros y totales, nuevo
 * gasto con sus avisos, pagar un pendiente, ver un justificante (URL firmada en
 * otra pestaña) y borrar con confirmación.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const ledger = vi.hoisted(() => ({
  categories: { list: vi.fn() },
  entries: { list: vi.fn(), create: vi.fn(), update: vi.fn(), pay: vi.fn(), remove: vi.fn() },
  attachments: { upload: vi.fn(), url: vi.fn(), remove: vi.fn() },
  recurring: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/ledger", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/ledger")>()),
  ledgerService: ledger,
}));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));

import { LedgerEntriesSection } from "@/components/admin/ledger-entries-section";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "cat-luz", name: "Luz", kind: "EXPENSE", activity: "COURTS", vatPercent: 21, systemKey: "ELECTRICITY", active: true, displayOrder: 10, inUse: true },
  { id: "cat-tienda", name: "Compras de la tienda", kind: "EXPENSE", activity: "SHOP", vatPercent: 21, systemKey: "SHOP_PURCHASES", active: true, displayOrder: 20, inUse: false },
  { id: "cat-entr", name: "Entrenadores", kind: "EXPENSE", activity: "ACADEMY", vatPercent: 21, systemKey: "COACHES", active: true, displayOrder: 5, inUse: true },
  { id: "cat-pat", name: "Patrocinios", kind: "INCOME", activity: "OTHER", vatPercent: 21, systemKey: "SPONSORSHIP", active: true, displayOrder: 30, inUse: false },
];

const entry = (extra: Record<string, unknown> = {}) => ({
  id: "e1", kind: "EXPENSE", categoryId: "cat-luz", categoryName: "Luz", activity: "COURTS",
  date: "2026-11-10", imputedMonth: null, amountCents: 8000, payment: "BANK", partnerId: null,
  partnerName: null, paidOn: null, concept: "Recibo de noviembre", note: null, noReceipt: false,
  recurringId: null, coachStaffId: null, coachName: null, attachments: [], needsReceipt: false,
  receiptsRetired: false, createdByName: "Dueño", createdAt: "2026-11-10T10:00:00Z", ...extra,
});

const page = (items: unknown[], totals = { incomeCents: 0, expenseCents: 8000, pendingCents: 0 }) => ({
  items, total: items.length, page: 1, pageSize: 50, totals,
});

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <LedgerEntriesSection clubId="c1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  ledger.categories.list.mockResolvedValue(CATEGORIES);
  ledger.entries.list.mockResolvedValue(page([entry()]));
  ledger.recurring.list.mockResolvedValue([]);
  accounts.partners.list.mockResolvedValue([{ id: "s1", name: "Marta", active: true }]);
});

describe("lista", () => {
  it("pide el mes en curso entero y enseña los totales del filtro", async () => {
    ledger.entries.list.mockResolvedValue(page([entry()], { incomeCents: 3000, expenseCents: 8000, pendingCents: 2000 }));
    renderSection();
    expect(await screen.findByText("Recibo de noviembre")).toBeInTheDocument();
    const filter = ledger.entries.list.mock.calls[0][1];
    expect(filter.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(filter.to).toMatch(/^\d{4}-\d{2}-(28|29|30|31)$/);
    const totals = within(screen.getByLabelText("Totales"));
    expect(totals.getByText(/30,00/)).toBeInTheDocument();
    expect(totals.getByText(/80,00/)).toBeInTheDocument();
    expect(totals.getByText(/20,00 € sin pagar/)).toBeInTheDocument();
  });

  it("los filtros viajan al back: «Sin justificante» y el tipo", async () => {
    renderSection();
    await screen.findByText("Recibo de noviembre");
    fireEvent.click(screen.getByLabelText("Sin justificante"));
    await waitFor(() => expect(ledger.entries.list.mock.calls.at(-1)?.[1].missingReceipt).toBe(true));
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "INCOME" } });
    await waitFor(() => expect(ledger.entries.list.mock.calls.at(-1)?.[1].kind).toBe("INCOME"));
  });

  it("al cambiar de mes pide el anterior", async () => {
    renderSection();
    await screen.findByText("Recibo de noviembre");
    const before = ledger.entries.list.mock.calls[0][1].from as string;
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));
    await waitFor(() => expect(ledger.entries.list.mock.calls.at(-1)?.[1].from).not.toBe(before));
  });

  it("un apunte pasado su plazo dice que el justificante se retiró por antigüedad", async () => {
    ledger.entries.list.mockResolvedValue(
      page([entry({ receiptsRetired: true, concept: "Concepto retirado por antigüedad" }), entry({ id: "e2", concept: "Reciente" })]),
    );
    renderSection();
    expect(await screen.findByText("Justificante retirado por antigüedad")).toBeInTheDocument();
    expect(screen.getAllByText("Justificante retirado por antigüedad")).toHaveLength(1);
  });

  it("marca los gastos sin justificante y los pendientes", async () => {
    ledger.entries.list.mockResolvedValue(
      page([entry({ needsReceipt: true, payment: "PENDING" }), entry({ id: "e2", concept: "Sin ticket", noReceipt: true })]),
    );
    renderSection();
    expect(await screen.findByText("Falta el justificante")).toBeInTheDocument();
    expect(screen.getByText("Sin pagar")).toBeInTheDocument();
    expect(screen.getByText("No hay ticket")).toBeInTheDocument();
  });

  it("un mes sin apuntes lo dice", async () => {
    ledger.entries.list.mockResolvedValue(page([]));
    renderSection();
    expect(await screen.findByText(/No hay apuntes en/)).toBeInTheDocument();
  });
});

describe("justificantes", () => {
  it("ver un justificante pide la URL firmada y la abre en otra pestaña", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    ledger.entries.list.mockResolvedValue(
      page([entry({ attachments: [{ id: "a1", fileName: "ticket.jpg", mimeType: "image/jpeg", bytes: 1000 }] })]),
    );
    ledger.attachments.url.mockResolvedValue({ url: "https://firmada.test/x", expiresAt: "2026-11-10T10:05:00Z" });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Ver justificante ticket.jpg" }));
    await waitFor(() => expect(open).toHaveBeenCalledWith("https://firmada.test/x", "_blank", "noopener,noreferrer"));
    expect(ledger.attachments.url).toHaveBeenCalledWith("c1", "a1");
    open.mockRestore();
  });
});

describe("pagar un gasto pendiente", () => {
  it("elige cómo se pagó y manda el día", async () => {
    ledger.entries.list.mockResolvedValue(page([entry({ payment: "PENDING" })]));
    ledger.entries.pay.mockResolvedValue(entry());
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Pagar/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Caja" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Marcar como pagado" }));
    await waitFor(() => expect(ledger.entries.pay).toHaveBeenCalled());
    const [, id, body] = ledger.entries.pay.mock.calls[0];
    expect(id).toBe("e1");
    expect(body).toMatchObject({ payment: "CASH", partnerId: null });
    expect(body.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("editar un pago a un entrenador", () => {
  it("no ofrece «Pendiente de pago» y conserva su categoría", async () => {
    ledger.entries.list.mockResolvedValue(
      page([entry({ categoryId: "cat-entr", categoryName: "Entrenadores", coachStaffId: "co1", coachName: "Marta", concept: "Entrenador: Marta" })]),
    );
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Editar Entrenador: Marta" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Pendiente de pago" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Entrenadores" })).toBeInTheDocument();
  });

  it("un gasto normal sí ofrece «Pendiente de pago» al editarlo", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Editar Recibo de noviembre" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Pendiente de pago" })).toBeInTheDocument();
  });
});

describe("borrar", () => {
  it("pide confirmación y borra", async () => {
    ledger.entries.remove.mockResolvedValue(undefined);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Recibo de noviembre" }));
    expect(ledger.entries.remove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(ledger.entries.remove).toHaveBeenCalledWith("c1", "e1"));
    expect(toast.success).toHaveBeenCalledWith("Apunte borrado");
  });
});

describe("nuevo gasto e ingreso", () => {
  const open = async (name: "Nuevo gasto" | "Nuevo ingreso") => {
    renderSection();
    await screen.findByText("Recibo de noviembre");
    fireEvent.click(screen.getByRole("button", { name }));
    return screen.findByRole("dialog");
  };

  it("no guarda sin importe ni concepto y los marca", async () => {
    const dialog = await open("Nuevo gasto");
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByText(/importe válido/)).toBeInTheDocument();
    expect(within(dialog).getByText("Escribe el concepto")).toBeInTheDocument();
    expect(ledger.entries.create).not.toHaveBeenCalled();
  });

  it("un gasto en caja se manda con su importe en céntimos y su categoría", async () => {
    ledger.entries.create.mockResolvedValue(entry());
    const dialog = await open("Nuevo gasto");
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "12,50" } });
    fireEvent.change(within(dialog).getByLabelText("Concepto"), { target: { value: "Bombillas" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Caja" }));
    expect(within(dialog).getByText(/baja el efectivo que debe haber/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(ledger.entries.create).toHaveBeenCalled());
    expect(ledger.entries.create.mock.calls[0][1]).toMatchObject({
      categoryId: "cat-luz", amountCents: 1250, payment: "CASH", concept: "Bombillas", partnerId: null, imputedMonth: null,
    });
  });

  it("«De su bolsillo» exige socio", async () => {
    const dialog = await open("Nuevo gasto");
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Concepto"), { target: { value: "Tornillos" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "De su bolsillo" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByText("Elige el socio")).toBeInTheDocument();
    expect(ledger.entries.create).not.toHaveBeenCalled();
  });

  it("«Pendiente» solo se ofrece en gastos", async () => {
    let dialog = await open("Nuevo gasto");
    expect(within(dialog).getByRole("button", { name: "Pendiente de pago" })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Nuevo ingreso" }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Pendiente de pago" })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Lo que se cobra en el panel ya cuenta solo/)).toBeInTheDocument();
  });

  it("no ofrece la categoría de entrenadores: se paga desde Entrenadores", async () => {
    const dialog = await open("Nuevo gasto");
    fireEvent.click(within(dialog).getByRole("button", { name: "Luz" }));
    expect(within(dialog).getByRole("button", { name: "Compras de la tienda" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Entrenadores" })).not.toBeInTheDocument();
  });

  it("la fecha y el mes llevan como mínimo el primer día que se conserva (6 años); el navegador bloquea lo anterior", async () => {
    const dialog = await open("Nuevo gasto");
    const year = new Date().getFullYear() - 6;
    expect((within(dialog).getByLabelText("Fecha") as HTMLInputElement).min).toBe(`${year}-01-01`);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Cuenta en otro mes" }));
    expect((within(dialog).getByLabelText("Mes al que cuenta") as HTMLInputElement).min).toBe(`${year}-01`);
    // Con una errata en el año el formulario no se envía
    fireEvent.change(within(dialog).getByLabelText("Fecha"), { target: { value: `${year - 10}-11-10` } });
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "5" } });
    fireEvent.change(within(dialog).getByLabelText("Concepto"), { target: { value: "Tornillos" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(ledger.entries.create).not.toHaveBeenCalled();
  });

  it("con una categoría de tienda avisa de no repetir las compras de cajas", async () => {
    const dialog = await open("Nuevo gasto");
    expect(within(dialog).queryByRole("note")).not.toBeInTheDocument();
    // Abre el selector de categoría y elige la de tienda
    fireEvent.click(within(dialog).getByRole("button", { name: "Luz" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Compras de la tienda" }));
    expect(within(dialog).getByRole("note")).toHaveTextContent(
      "Las compras de Tienda → Compra de cajas ya cuentan: no las repitas aquí.",
    );
  });
});
