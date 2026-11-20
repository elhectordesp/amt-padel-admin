/**
 * «Cuentas» → «Deudas»: lista por persona con filtro, cobrar (método y Bizum),
 * deshacer el cobro, largo plazo, nueva deuda, y perdonar (doble confirmación,
 * con motivo) y reabrir solo con el área «accounts».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ cash: true, accounts: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({
    roles: ["OWNER"],
    can: (area: string) => (area === "accounts" ? access.accounts : area === "cash" ? access.cash : true),
  }),
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const debts = vi.hoisted(() => ({
  list: vi.fn(), warnings: vi.fn(), create: vi.fn(), pay: vi.fn(), undoPay: vi.fn(),
  update: vi.fn(), forgive: vi.fn(), reopen: vi.fn(),
}));
vi.mock("@/lib/services/club-debts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-debts")>()),
  clubDebtsService: debts,
}));
vi.mock("@/lib/services/accounts-config", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts-config")>()),
  accountsConfigService: {
    get: vi.fn().mockResolvedValue({ debtExpiryDays: 10, debtWarnDays: [5], cardFeeBps: 0 }),
  },
}));
const partners = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: { partners },
}));
vi.mock("@/components/admin/booking-customer-picker", () => ({ BookingCustomerPicker: () => null }));

import { AccountsDebtsSection } from "@/components/admin/accounts-debts-section";

const debt = (extra: Record<string, unknown> = {}) => ({
  id: "d1", origin: "MANUAL", concept: "Bolas", amountCents: 450, debtDate: "2026-12-01", status: "OPEN",
  longTerm: false, notes: null, dayNumber: 5, expiresOn: "2026-12-10", warnToday: false, lastDay: false,
  paymentMethod: null, bizumPartnerName: null, paidAt: null, paidByName: null, closedAt: null,
  bookingId: null, saleId: null, createdByName: "Recepción", ...extra,
});
const ana = (ds: ReturnType<typeof debt>[]) => ({
  key: "customer:c1", name: "Ana", clubCustomerId: "c1",
  openCents: ds.filter((d) => d.status === "OPEN").reduce((s, d) => s + d.amountCents, 0), debts: ds,
});

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AccountsDebtsSection clubId="club-1" />
    </QueryClientProvider>,
  );
}

describe("AccountsDebtsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.cash = true;
    access.accounts = true;
    debts.list.mockResolvedValue([ana([debt()])]);
    partners.list.mockResolvedValue([{ id: "p1", name: "Marta", active: true }]);
  });

  it("lista por persona con la píldora «Día n de N» y el total abierto", async () => {
    renderSection();
    expect(await screen.findByText("Bolas")).toBeInTheDocument();
    expect(debts.list).toHaveBeenCalledWith("club-1", "OPEN");
    expect(screen.getByText("Día 5 de 10")).toBeInTheDocument();
    expect(screen.getByText(/Total abierto: 4,50/)).toBeInTheDocument();
  });

  it("el filtro pide el estado elegido y enseña el cobro de una cobrada", async () => {
    debts.list.mockResolvedValue([
      ana([debt({ status: "PAID", paymentMethod: "BIZUM", bizumPartnerName: "Marta", paidAt: "2026-12-02T10:00:00.000Z", paidByName: "Recepción" })]),
    ]);
    renderSection();
    await userEvent.click(await screen.findByRole("tab", { name: "Cobradas" }));
    await waitFor(() => expect(debts.list).toHaveBeenCalledWith("club-1", "PAID"));
    expect(await screen.findByText(/Cobrada el 2\/12\/2026 · Bizum · Marta · Recepción/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deshacer cobro/ })).toBeInTheDocument();
  });

  it("cobrar: método y, con Bizum, a qué móvil llegó", async () => {
    debts.pay.mockResolvedValue({ paid: 1, totalCents: 450, debts: [] });
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Cobrar" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Bizum" }));
    const cobrar = within(dialog).getByRole("button", { name: "Cobrar" });
    expect(cobrar).toBeDisabled();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Marta" }));
    await userEvent.click(cobrar);
    await waitFor(() =>
      expect(debts.pay).toHaveBeenCalledWith("club-1", { debtIds: ["d1"], method: "BIZUM", bizumPartnerId: "p1" }),
    );
  });

  it("«Cobrar todo» manda los ids de las abiertas de la persona", async () => {
    debts.list.mockResolvedValue([
      ana([debt({ id: "d1" }), debt({ id: "d2", amountCents: 900 }), debt({ id: "d3", status: "PAID" })]),
    ]);
    debts.pay.mockResolvedValue({ paid: 2, totalCents: 1350, debts: [] });
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: /Cobrar todo/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("13,50");
    await userEvent.click(within(dialog).getByRole("button", { name: "Efectivo" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
    await waitFor(() =>
      expect(debts.pay).toHaveBeenCalledWith("club-1", { debtIds: ["d1", "d2"], method: "CASH" }),
    );
  });

  it("largo plazo: alterna el marcador", async () => {
    debts.update.mockResolvedValue(debt({ longTerm: true }));
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Largo plazo" }));
    await waitFor(() => expect(debts.update).toHaveBeenCalledWith("club-1", "d1", { longTerm: true }));
  });

  it("perdonar pide el motivo y una segunda confirmación antes de llamar", async () => {
    debts.forgive.mockResolvedValue(debt({ status: "FORGIVEN" }));
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Perdonar" }));
    const first = await screen.findByRole("dialog");
    const next = within(first).getByRole("button", { name: "Continuar" });
    expect(next).toBeDisabled();
    await userEvent.type(within(first).getByLabelText("Motivo"), "Es del club");
    await userEvent.click(next);
    expect(debts.forgive).not.toHaveBeenCalled();
    const second = await screen.findByRole("dialog");
    expect(second).toHaveTextContent("¿Perdonar de verdad?");
    await userEvent.click(within(second).getByRole("button", { name: "Perdonar la deuda" }));
    await waitFor(() => expect(debts.forgive).toHaveBeenCalledWith("club-1", "d1", "Es del club"));
  });

  it("sin el área accounts no hay Perdonar ni Reabrir, y los cobros siguen", async () => {
    access.accounts = false;
    debts.list.mockResolvedValue([ana([debt(), debt({ id: "d2", status: "LOST" })])]);
    renderSection();
    await screen.findAllByText("Bolas");
    expect(screen.queryByRole("button", { name: "Perdonar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reabrir" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cobrar" })).toBeInTheDocument();
  });

  it("reabrir una perdida", async () => {
    debts.list.mockResolvedValue([ana([debt({ status: "LOST", closedAt: "2026-12-11T09:00:00.000Z" })])]);
    debts.reopen.mockResolvedValue(debt({ longTerm: true }));
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(debts.reopen).toHaveBeenCalledWith("club-1", "d1"));
  });

  it("deshacer el cobro de una cobrada", async () => {
    debts.list.mockResolvedValue([
      ana([debt({ status: "PAID", paymentMethod: "CASH", paidAt: "2026-12-02T10:00:00.000Z" })]),
    ]);
    debts.undoPay.mockResolvedValue(debt());
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: /Deshacer cobro/ }));
    await waitFor(() => expect(debts.undoPay).toHaveBeenCalledWith("club-1", "d1"));
  });

  it("nueva deuda de otra persona: nombre, concepto e importe", async () => {
    debts.create.mockResolvedValue(debt());
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: /Nueva deuda/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Otra persona" }));
    await userEvent.type(within(dialog).getByLabelText("Nombre"), "Pablo");
    await userEvent.type(within(dialog).getByLabelText("Concepto"), "Cañas");
    await userEvent.type(within(dialog).getByLabelText("Importe"), "9,50");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apuntar deuda" }));
    await waitFor(() =>
      expect(debts.create).toHaveBeenCalledWith(
        "club-1",
        expect.objectContaining({ personName: "Pablo", concept: "Cañas", amountCents: 950 }),
      ),
    );
  });
});
