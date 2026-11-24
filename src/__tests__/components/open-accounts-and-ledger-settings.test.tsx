/**
 * Cuentas abiertas (lista y ficha del cliente), fijos y categorías con el aviso
 * de justificantes (F8 fase 2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const access = vi.hoisted(() => ({ canAccounts: true, accountsOn: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: () => access.canAccounts }),
}));
vi.mock("@/lib/use-accounts-enabled", () => ({
  useAccountsEnabled: () => access.accountsOn,
  useClubAccounts: () => ({ on: access.accountsOn, known: true, isError: false, refetch: vi.fn() }),
}));
const ledger = vi.hoisted(() => ({
  categories: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  recurring: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  openAccounts: { list: vi.fn(), set: vi.fn() },
}));
vi.mock("@/lib/services/ledger", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/ledger")>()),
  ledgerService: ledger,
}));
const config = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/services/accounts-config", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts-config")>()),
  accountsConfigService: config,
}));
const debts = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/services/club-debts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-debts")>()),
  clubDebtsService: debts,
}));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: { partners: { list: vi.fn().mockResolvedValue([]) } },
}));

import { CustomerOpenAccount } from "@/components/admin/customer-open-account";
import { LedgerCategoriesSection } from "@/components/admin/ledger-categories-section";
import { LedgerRecurringSection } from "@/components/admin/ledger-recurring-section";
import { OpenAccountsSection } from "@/components/admin/open-accounts-section";
import { toast } from "sonner";

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );
}

const CATEGORIES = [
  { id: "cat-luz", name: "Luz", kind: "EXPENSE", activity: "COURTS", vatPercent: 21, systemKey: "ELECTRICITY", active: true, displayOrder: 10, inUse: true },
  { id: "cat-propia", name: "Césped", kind: "EXPENSE", activity: "COURTS", vatPercent: null, systemKey: null, active: true, displayOrder: 20, inUse: false },
  { id: "cat-usada", name: "Reformas", kind: "EXPENSE", activity: "OTHER", vatPercent: null, systemKey: null, active: false, displayOrder: 30, inUse: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  access.canAccounts = true;
  access.accountsOn = true;
  ledger.categories.list.mockResolvedValue(CATEGORIES);
  ledger.recurring.list.mockResolvedValue([]);
  ledger.openAccounts.list.mockResolvedValue([]);
  config.get.mockResolvedValue({ debtExpiryDays: 30, debtWarnDays: [5], cardFeeBps: 100, receiptsRequiredFrom: null });
});

describe("cuenta abierta en la ficha del cliente", () => {
  it("se enciende con el interruptor y avisa de las deudas que pasan a largo plazo", async () => {
    ledger.openAccounts.set.mockResolvedValue({ clubCustomerId: "cc1", openAccount: true, converted: 2 });
    wrap(<CustomerOpenAccount clubId="c1" customerId="cc1" openAccount={false} />);
    fireEvent.click(screen.getByLabelText("Cuenta abierta"));
    await waitFor(() => expect(ledger.openAccounts.set).toHaveBeenCalledWith("c1", "cc1", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cuenta abierta. 2 deudas pasan a largo plazo"));
  });

  it("sin el permiso de cuentas o con el módulo apagado, no aparece", () => {
    access.canAccounts = false;
    const { container, rerender } = wrap(<CustomerOpenAccount clubId="c1" customerId="cc1" openAccount={false} />);
    expect(container).toBeEmptyDOMElement();
    access.canAccounts = true;
    access.accountsOn = false;
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <CustomerOpenAccount clubId="c1" customerId="cc1" openAccount={false} />
      </QueryClientProvider>,
    );
    expect(screen.queryByLabelText("Cuenta abierta")).not.toBeInTheDocument();
  });
});

describe("cuentas abiertas (pestaña Deudas)", () => {
  it("lista lo que debe cada una y cuándo pagó por última vez", async () => {
    ledger.openAccounts.list.mockResolvedValue([
      { clubCustomerId: "cc1", name: "Rodri", openCents: 9000, openDebts: 3, lastPaidAt: "2026-11-10T10:00:00Z" },
      { clubCustomerId: "cc2", name: "PLD", openCents: 0, openDebts: 0, lastPaidAt: null },
    ]);
    wrap(<OpenAccountsSection clubId="c1" />);
    expect(await screen.findByText("Rodri")).toBeInTheDocument();
    expect(screen.getByText(/Debe 90,00 € en 3 deudas · último pago el 10\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/todavía no ha pagado/)).toBeInTheDocument();
    // Sin deudas abiertas, no hay nada que cobrar
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[1]).getByRole("button", { name: /Cobrar/ })).toBeDisabled();
  });

  it("«Cobrar» pide sus deudas abiertas y abre el cobro con el total", async () => {
    ledger.openAccounts.list.mockResolvedValue([
      { clubCustomerId: "cc1", name: "Rodri", openCents: 1500, openDebts: 2, lastPaidAt: null },
    ]);
    debts.list.mockResolvedValue([
      { key: "customer:cc1", name: "Rodri", clubCustomerId: "cc1", openCents: 1500, debts: [
        { id: "d1", status: "OPEN", amountCents: 1000 }, { id: "d2", status: "OPEN", amountCents: 500 },
      ] },
    ]);
    wrap(<OpenAccountsSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Cobrar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(debts.list).toHaveBeenCalledWith("c1", "OPEN", "cc1");
    expect(dialog).toHaveTextContent("Rodri · 2 deudas");
    expect(dialog).toHaveTextContent("15,00");
  });

  it("abrir una cuenta elige un cliente y lo manda encendido", async () => {
    ledger.openAccounts.list.mockResolvedValue([]);
    wrap(<OpenAccountsSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Abrir una cuenta/ }));
    const dialog = await screen.findByRole("dialog");
    // Sin cliente elegido no se puede abrir
    expect(within(dialog).getByRole("button", { name: "Abrir cuenta" })).toBeDisabled();
  });
});

describe("fijos", () => {
  const FIXED = {
    id: "r1", categoryId: "cat-luz", categoryName: "Luz", concept: "Alquiler", amountCents: 150000, dayOfMonth: 5,
    payment: "BANK", partnerId: null, partnerName: null, startMonth: "2026-10", active: true, lastMonth: "2026-11",
  };

  it("lista el fijo con su día, su pago y su último apunte, y lo pausa", async () => {
    ledger.recurring.list.mockResolvedValue([FIXED]);
    ledger.recurring.update.mockResolvedValue({ ...FIXED, active: false });
    wrap(<LedgerRecurringSection clubId="c1" categories={CATEGORIES as never} today="2026-11-23" />);
    expect(await screen.findByText(/el día 5 · Banco/)).toBeInTheDocument();
    expect(screen.getByText(/último apunte: noviembre de 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pausar/ }));
    await waitFor(() => expect(ledger.recurring.update).toHaveBeenCalledWith("c1", "r1", { active: false }));
  });

  it("borrar uno con apuntes (409) dice que se pause", async () => {
    ledger.recurring.list.mockResolvedValue([FIXED]);
    ledger.recurring.remove.mockRejectedValue(Object.assign(new Error("x"), { code: "ACCOUNTS_IN_USE" }));
    wrap(<LedgerRecurringSection clubId="c1" categories={CATEGORIES as never} today="2026-11-23" />);
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Alquiler" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Este fijo ya ha apuntado cosas: no se borra, ponlo en pausa."),
    );
  });

  it("el diálogo de fijos no ofrece la categoría de entrenadores", async () => {
    const withCoaches = [
      { id: "cat-ent", name: "Entrenadores", kind: "EXPENSE", activity: "SCHOOL", vatPercent: null, systemKey: "COACHES", active: true, displayOrder: 5, inUse: true },
      ...CATEGORIES,
    ];
    wrap(<LedgerRecurringSection clubId="c1" categories={withCoaches as never} today="2026-11-23" />);
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo fijo/ }));
    const dialog = await screen.findByRole("dialog");
    // Con ella a la vista sería la primera elegida: sale la primera de las demás
    expect(within(dialog).queryByText("Entrenadores")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Luz")).toBeInTheDocument();
  });

  it("un fijo nuevo exige importe y día válidos y se manda en céntimos", async () => {
    ledger.recurring.create.mockResolvedValue(FIXED);
    wrap(<LedgerRecurringSection clubId="c1" categories={CATEGORIES as never} today="2026-11-23" />);
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo fijo/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Concepto"), { target: { value: "Alquiler" } });
    fireEvent.change(within(dialog).getByLabelText("Día del mes"), { target: { value: "32" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await within(dialog).findByText("Un día del 1 al 31")).toBeInTheDocument();
    expect(ledger.recurring.create).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Día del mes"), { target: { value: "31" } });
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "1500" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(ledger.recurring.create).toHaveBeenCalled());
    expect(ledger.recurring.create.mock.calls[0][1]).toMatchObject({
      categoryId: "cat-luz", concept: "Alquiler", amountCents: 150000, dayOfMonth: 31, payment: "BANK", startMonth: "2026-11",
    });
  });
});

describe("categorías y aviso de justificantes (Ajustes)", () => {
  it("las de serie y las usadas no tienen borrar; las propias sin usar, sí", async () => {
    wrap(<LedgerCategoriesSection clubId="c1" />);
    expect(await screen.findByText("Luz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar Luz" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Borrar Reformas" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Borrar Césped" })).toBeInTheDocument();
    expect(screen.getByText("Desactivada")).toBeInTheDocument();
  });

  it("desactivar y activar mandan active", async () => {
    ledger.categories.update.mockResolvedValue({});
    wrap(<LedgerCategoriesSection clubId="c1" />);
    await screen.findByText("Luz");
    const row = screen.getByText("Luz").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(ledger.categories.update).toHaveBeenCalledWith("c1", "cat-luz", { active: false }));
  });

  it("una categoría nueva se manda con tipo, actividad e IVA", async () => {
    ledger.categories.create.mockResolvedValue({});
    wrap(<LedgerCategoriesSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Nueva categoría/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nombre"), { target: { value: "Seguros" } });
    fireEvent.change(within(dialog).getByLabelText("IVA"), { target: { value: "21" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(ledger.categories.create).toHaveBeenCalled());
    expect(ledger.categories.create.mock.calls[0][1]).toEqual({
      name: "Seguros", kind: "EXPENSE", activity: "OTHER", vatPercent: 21,
    });
  });

  it("el aviso de justificantes se enciende con un día y se guarda con el resto de ajustes", async () => {
    config.update.mockResolvedValue({});
    wrap(<LedgerCategoriesSection clubId="c1" />);
    const day = await screen.findByLabelText("Avisar de gastos sin justificante desde");
    expect(day).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Avisar de los gastos sin justificante desde el/));
    fireEvent.change(day, { target: { value: "2026-12-01" } });
    const field = screen.getByRole("group", { name: "Avisar de gastos sin justificante" });
    fireEvent.click(within(field).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(config.update).toHaveBeenCalled());
    expect(config.update.mock.calls[0][1]).toEqual({
      debtExpiryDays: 30, debtWarnDays: [5], cardFeeBps: 100, receiptsRequiredFrom: "2026-12-01",
    });
  });

  it("borrar una categoría con apuntes (409) dice que se desactive", async () => {
    ledger.categories.remove.mockRejectedValue(Object.assign(new Error("x"), { code: "ACCOUNTS_IN_USE" }));
    wrap(<LedgerCategoriesSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Césped" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Borrar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/desactívala/)));
  });
});
