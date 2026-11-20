/**
 * Las deudas del club fuera de «Cuentas»: «Pendiente de cobro» de la caja
 * (píldora y «Cobrar todo»), «Deudas que avisan hoy» de la portada y la ficha
 * del cliente.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ enabled: true, cash: true }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => access.enabled }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: () => access.cash }),
}));
const cashMock = vi.hoisted(() => ({ day: vi.fn(), debts: vi.fn() }));
vi.mock("@/lib/services/cash", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/cash")>()),
  cashService: cashMock,
}));
const debts = vi.hoisted(() => ({ list: vi.fn(), warnings: vi.fn(), pay: vi.fn() }));
vi.mock("@/lib/services/club-debts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-debts")>()),
  clubDebtsService: debts,
}));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: { partners: { list: vi.fn().mockResolvedValue([]) } },
}));
vi.mock("@/lib/services/bookings", () => ({ bookingsService: { bookings: { markPaid: vi.fn() } } }));
vi.mock("@/lib/services/admin", () => ({ adminService: { registrations: { updatePayment: vi.fn() } } }));

import { CajaDebts } from "@/components/admin/caja-debts";
import { CustomerDebtsSection } from "@/components/admin/customer-debts-section";
import { DebtWarningsNotice } from "@/components/admin/debt-warnings-notice";

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

const clubDebtItem = (extra: Record<string, unknown> = {}) => ({
  source: "CLUB_DEBT", refId: "d1", concept: "Bolas", date: "2026-12-01T00:00:00.000Z", amountCents: 450,
  dayNumber: 5, lastDay: false, expiryDays: 10, longTerm: false, ...extra,
});

describe("caja: deudas del club en «Pendiente de cobro»", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.enabled = true;
    access.cash = true;
  });

  it("la línea lleva «Día n de N» y el último día se resalta", async () => {
    cashMock.debts.mockResolvedValue({
      people: [{
        key: "customer:c1", name: "Ana", userId: null, customerId: "c1", totalCents: 900,
        items: [clubDebtItem(), clubDebtItem({ refId: "d2", dayNumber: 10, lastDay: true })],
      }],
      totalCents: 900,
    });
    wrap(<CajaDebts clubId="c1" timeZone="Europe/Madrid" />);
    expect(await screen.findByText("Día 5 de 10")).toBeInTheDocument();
    expect(screen.getByText("Último día")).toBeInTheDocument();
  });

  it("«Cobrar todo» de la persona cobra solo sus deudas del club", async () => {
    cashMock.debts.mockResolvedValue({
      people: [{
        key: "customer:c1", name: "Ana", userId: null, customerId: "c1", totalCents: 6350,
        items: [
          clubDebtItem(),
          clubDebtItem({ refId: "d2", amountCents: 900 }),
          { source: "VOUCHER", refId: "v1", concept: "Bono", date: "2026-11-01T00:00:00.000Z", amountCents: 5000 },
        ],
      }],
      totalCents: 6350,
    });
    debts.pay.mockResolvedValue({ paid: 2, totalCents: 1350, debts: [] });
    wrap(<CajaDebts clubId="c1" timeZone="Europe/Madrid" />);
    await userEvent.click(await screen.findByRole("button", { name: /Cobrar todo/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Tarjeta" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
    await waitFor(() =>
      expect(debts.pay).toHaveBeenCalledWith("c1", { debtIds: ["d1", "d2"], method: "CARD" }),
    );
  });

  it("«Cobrar» de una línea cobra solo esa deuda", async () => {
    cashMock.debts.mockResolvedValue({
      people: [{
        key: "customer:c1", name: "Ana", userId: null, customerId: "c1", totalCents: 1350,
        items: [clubDebtItem(), clubDebtItem({ refId: "d2", amountCents: 900 })],
      }],
      totalCents: 1350,
    });
    debts.pay.mockResolvedValue({ paid: 1, totalCents: 450, debts: [] });
    wrap(<CajaDebts clubId="c1" timeZone="Europe/Madrid" />);
    const buttons = await screen.findAllByRole("button", { name: "Cobrar" });
    await userEvent.click(buttons[0]);
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Efectivo" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
    await waitFor(() =>
      expect(debts.pay).toHaveBeenCalledWith("c1", { debtIds: ["d1"], method: "CASH" }),
    );
  });

  it("sin deudas del club, no hay «Cobrar todo»", async () => {
    cashMock.debts.mockResolvedValue({
      people: [{
        key: "customer:c1", name: "Ana", userId: null, customerId: "c1", totalCents: 5000,
        items: [{ source: "VOUCHER", refId: "v1", concept: "Bono", date: "2026-11-01T00:00:00.000Z", amountCents: 5000 }],
      }],
      totalCents: 5000,
    });
    wrap(<CajaDebts clubId="c1" timeZone="Europe/Madrid" />);
    await screen.findByText("Bono");
    expect(screen.queryByRole("button", { name: /Cobrar todo/ })).not.toBeInTheDocument();
  });
});

describe("DebtWarningsNotice (portada)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.enabled = true;
    access.cash = true;
  });

  it("lista las deudas que avisan hoy, el último día resaltado", async () => {
    debts.warnings.mockResolvedValue([
      { id: "d1", name: "Ana", amountCents: 450, dayNumber: 9, lastDay: false, concept: "Bolas" },
      { id: "d2", name: "Pablo", amountCents: 900, dayNumber: 10, lastDay: true, concept: "Cañas" },
    ]);
    wrap(<DebtWarningsNotice clubId="c1" />);
    expect(await screen.findByText("Deudas que avisan hoy")).toBeInTheDocument();
    expect(screen.getByText("Día 9")).toBeInTheDocument();
    expect(screen.getByText("Último día")).toBeInTheDocument();
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/caja");
  });

  it("sin avisos no sale; sin el módulo o sin la caja no pide nada", async () => {
    debts.warnings.mockResolvedValue([]);
    wrap(<DebtWarningsNotice clubId="c1" />);
    await waitFor(() => expect(debts.warnings).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Deudas que avisan hoy")).not.toBeInTheDocument();
    access.enabled = false;
    wrap(<DebtWarningsNotice clubId="c1" />);
    access.enabled = true;
    access.cash = false;
    wrap(<DebtWarningsNotice clubId="c1" />);
    expect(debts.warnings).toHaveBeenCalledTimes(1);
  });
});

describe("CustomerDebtsSection (ficha del cliente)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.enabled = true;
    access.cash = true;
  });

  it("enseña sus deudas y lo que sigue abierto", async () => {
    debts.list.mockResolvedValue([{
      key: "customer:c1", name: "Ana", clubCustomerId: "c1", openCents: 450,
      debts: [
        { id: "d1", concept: "Bolas", amountCents: 450, debtDate: "2026-12-01", status: "OPEN", longTerm: false, dayNumber: 5, lastDay: false },
        { id: "d2", concept: "Cañas", amountCents: 900, debtDate: "2026-11-01", status: "PAID", longTerm: false, dayNumber: 40, lastDay: false },
      ],
    }]);
    wrap(<CustomerDebtsSection clubId="c1" customerId="cc1" />);
    expect(await screen.findByText("Bolas")).toBeInTheDocument();
    expect(debts.list).toHaveBeenCalledWith("c1", "ALL", "cc1");
    expect(screen.getByText("4,50 €", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Cobrada")).toBeInTheDocument();
  });

  it("un cliente sin deudas no la enseña", async () => {
    debts.list.mockResolvedValue([]);
    wrap(<CustomerDebtsSection clubId="c1" customerId="cc1" />);
    await waitFor(() => expect(debts.list).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByLabelText("Deudas")).not.toBeInTheDocument());
  });
});
