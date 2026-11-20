/**
 * Cierre de caja del día (módulo «Cuentas»): cerrar con el efectivo contado y el
 * datáfono, ver el cierre hecho, volver a cerrar si cambió y reabrir (solo
 * propietario y gestor).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ enabled: true, roles: ["OWNER"] as string[] | null }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => access.enabled }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: access.roles, can: () => true }),
}));
const svc = vi.hoisted(() => ({ get: vi.fn(), close: vi.fn(), reopen: vi.fn(), unclosed: vi.fn() }));
vi.mock("@/lib/services/cash-closure", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/cash-closure")>()),
  cashClosureService: svc,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CashClosurePanel } from "@/components/admin/cash-closure-panel";

const DATE = "2020-03-10";
const CURRENT = {
  expectedByMethod: { CASH: 12000, CARD: 8000 },
  expectedCashCents: 12000,
  expectedCardCents: 8000,
};
const OPEN_STATE = { date: DATE, closure: null, current: CURRENT, changedSinceClose: false, changes: [] };
const CLOSURE = {
  id: "c1", date: DATE,
  expectedByMethod: { CASH: 12000, CARD: 8000 },
  expectedCashCents: 12000, countedCashCents: 11850, cashDiffCents: -150,
  expectedCardCents: 8000, cardTerminalCents: null, cardDiffCents: null,
  notes: null, closedByName: "Marta", closedAt: "2020-03-10T21:00:00.000Z",
};

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CashClosurePanel clubId="club-1" date={DATE} timeZone="Europe/Madrid" />
    </QueryClientProvider>,
  );
}

describe("CashClosurePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.enabled = true;
    access.roles = ["OWNER"];
    svc.get.mockResolvedValue(OPEN_STATE);
    svc.close.mockResolvedValue(CLOSURE);
    svc.reopen.mockResolvedValue({ reopened: true, date: DATE });
  });

  it("con el módulo apagado no sale ni pide nada", () => {
    access.enabled = false;
    renderPanel();
    expect(screen.queryByText("Cerrar el día")).not.toBeInTheDocument();
    expect(svc.get).not.toHaveBeenCalled();
  });

  it("un día futuro no se puede cerrar: no sale", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <CashClosurePanel clubId="club-1" date="2999-01-01" timeZone="Europe/Madrid" />
      </QueryClientProvider>,
    );
    expect(screen.queryByText("Cerrar el día")).not.toBeInTheDocument();
    expect(svc.get).not.toHaveBeenCalled();
  });

  it("cerrar: enseña lo esperado, el resultado en vivo y manda el cierre en céntimos", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Cerrar el día/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("120,00 €")).toBeInTheDocument();

    // Sin teclear nada, no se puede confirmar
    expect(within(dialog).getByRole("button", { name: /Confirmar cierre/ })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Efectivo contado"), { target: { value: "118,50" } });
    expect(within(dialog).getByText("Faltan 1,50 €")).toBeInTheDocument();
    expect(within(dialog).getByText("Sin comparar")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Total del datáfono"), { target: { value: "80" } });
    expect(within(dialog).getByText("Cuadra")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Total del datáfono"), { target: { value: "82,25" } });
    expect(within(dialog).getByText("Sobran 2,25 €")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Nota del cierre"), { target: { value: "  Falta un euro  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Confirmar cierre/ }));
    await waitFor(() =>
      expect(svc.close).toHaveBeenCalledWith("club-1", {
        date: DATE, countedCashCents: 11850, cardTerminalCents: 8225, notes: "Falta un euro",
      }),
    );
  });

  it("datáfono en blanco: se manda null; un importe que no vale no deja confirmar", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Cerrar el día/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Efectivo contado"), { target: { value: "120" } });
    expect(within(dialog).getByText("Cuadra")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Total del datáfono"), { target: { value: "abc" } });
    expect(within(dialog).getByRole("button", { name: /Confirmar cierre/ })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Total del datáfono"), { target: { value: "" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /Confirmar cierre/ }));
    await waitFor(() =>
      expect(svc.close).toHaveBeenCalledWith("club-1", {
        date: DATE, countedCashCents: 12000, cardTerminalCents: null, notes: undefined,
      }),
    );
  });

  it("ya cerrado: la tarjeta del cierre con el resultado, quién lo cerró y sin aviso de cambios", async () => {
    svc.get.mockResolvedValue({ ...OPEN_STATE, closure: CLOSURE });
    renderPanel();
    expect(await screen.findByText(/Día cerrado por Marta/)).toBeInTheDocument();
    expect(screen.getByText("Faltan 1,50 €")).toBeInTheDocument();
    expect(screen.getByText("Sin comparar")).toBeInTheDocument();
    expect(screen.queryByText("Ha cambiado después del cierre")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a cerrar" })).not.toBeInTheDocument();
  });

  it("cambió después del cierre: aviso con las diferencias y «Volver a cerrar» con lo anterior", async () => {
    svc.get.mockResolvedValue({
      ...OPEN_STATE,
      closure: CLOSURE,
      changedSinceClose: true,
      changes: [{ method: "CASH", closedCents: 12000, nowCents: 13500 }],
    });
    renderPanel();
    expect(await screen.findByText("Ha cambiado después del cierre")).toBeInTheDocument();
    expect(screen.getByText(/Efectivo: al cerrar 120,00 €, ahora 135,00 €/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver a cerrar" }));
    const dialog = screen.getByRole("dialog", { name: "Volver a cerrar el día" });
    expect(within(dialog).getByLabelText("Efectivo contado")).toHaveValue("118,50");
  });

  it("reabrir: solo propietario y gestor, con confirmación", async () => {
    svc.get.mockResolvedValue({ ...OPEN_STATE, closure: CLOSURE });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Reabrir el día/ }));
    expect(svc.reopen).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(svc.reopen).toHaveBeenCalledWith("club-1", DATE));
  });

  it("recepción no ve «Reabrir el día»", async () => {
    access.roles = ["RECEPTION"];
    svc.get.mockResolvedValue({ ...OPEN_STATE, closure: CLOSURE });
    renderPanel();
    await screen.findByText(/Día cerrado por Marta/);
    expect(screen.queryByRole("button", { name: /Reabrir el día/ })).not.toBeInTheDocument();
  });
});
