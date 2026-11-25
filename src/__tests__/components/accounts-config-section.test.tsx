/**
 * Ajustes de cuentas: plazo de las deudas, días de aviso y comisión del
 * datáfono. Los guarda quien escribe en Configuración; recepción solo los ve.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ canWrite: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: (_area: string, level = "read") => level === "read" || access.canWrite }),
}));
const svc = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/services/accounts-config", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts-config")>()),
  accountsConfigService: svc,
}));
const debts = vi.hoisted(() => ({ expiryPreview: vi.fn() }));
vi.mock("@/lib/services/club-debts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-debts")>()),
  clubDebtsService: debts,
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AccountsConfigSection } from "@/components/admin/accounts-config-section";
import {
  bpsToFeeText, feePercentToBps, parseWarnDays, warnDaysText,
} from "@/lib/utils/accounts-config";

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AccountsConfigSection clubId="club-1" />
    </QueryClientProvider>,
  );
}

const DEFAULTS = { debtExpiryDays: null, debtWarnDays: [], cardFeeBps: 0 };
const save = () => screen.getByRole("button", { name: "Guardar ajustes" });

describe("AccountsConfigSection: aviso al poner o acortar el plazo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.canWrite = true;
    svc.update.mockImplementation((_club: string, input: object) => Promise.resolve(input));
  });

  it("al poner un plazo, enseña cuántas deudas se perderían y no guarda hasta confirmar", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: null, debtWarnDays: [], cardFeeBps: 0 });
    debts.expiryPreview.mockResolvedValue({ count: 3, totalCents: 1350 });
    renderSection();
    fireEvent.click(await screen.findByLabelText(/Caducan a los/));
    fireEvent.change(screen.getByLabelText("Días para que caduque una deuda"), { target: { value: "30" } });
    fireEvent.click(save());
    const dialog = await screen.findByRole("dialog");
    expect(debts.expiryPreview).toHaveBeenCalledWith("club-1", 30);
    expect(dialog).toHaveTextContent("3 deudas abiertas");
    expect(dialog).toHaveTextContent("13,50");
    expect(svc.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar el plazo" }));
    await waitFor(() =>
      expect(svc.update).toHaveBeenCalledWith("club-1", { debtExpiryDays: 30, debtWarnDays: [], cardFeeBps: 0 }),
    );
  });

  it("al acortar el plazo también pregunta; si se cancela, no guarda", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: 30, debtWarnDays: [], cardFeeBps: 0 });
    debts.expiryPreview.mockResolvedValue({ count: 1, totalCents: 450 });
    renderSection();
    fireEvent.change(await screen.findByLabelText("Días para que caduque una deuda"), { target: { value: "10" } });
    fireEvent.click(save());
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("1 deuda abierta");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(svc.update).not.toHaveBeenCalled();
  });

  it("alargar el plazo o quitarlo no consulta nada y guarda directo", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: 10, debtWarnDays: [], cardFeeBps: 0 });
    renderSection();
    fireEvent.change(await screen.findByLabelText("Días para que caduque una deuda"), { target: { value: "20" } });
    fireEvent.click(save());
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(debts.expiryPreview).not.toHaveBeenCalled();
  });

  it("al acortar sin deudas afectadas guarda sin preguntar", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: 30, debtWarnDays: [], cardFeeBps: 0 });
    debts.expiryPreview.mockResolvedValue({ count: 0, totalCents: 0 });
    renderSection();
    fireEvent.change(await screen.findByLabelText("Días para que caduque una deuda"), { target: { value: "10" } });
    fireEvent.click(save());
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("si la comprobación falla, no guarda nada", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: null, debtWarnDays: [], cardFeeBps: 0 });
    debts.expiryPreview.mockRejectedValue(new Error("caído"));
    renderSection();
    fireEvent.click(await screen.findByLabelText(/Caducan a los/));
    fireEvent.change(screen.getByLabelText("Días para que caduque una deuda"), { target: { value: "30" } });
    fireEvent.click(save());
    await waitFor(() => expect(debts.expiryPreview).toHaveBeenCalled());
    expect(svc.update).not.toHaveBeenCalled();
  });
});

describe("AccountsConfigSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.canWrite = true;
    svc.get.mockResolvedValue(DEFAULTS);
    svc.update.mockImplementation((_club: string, input: object) => Promise.resolve(input));
    debts.expiryPreview.mockResolvedValue({ count: 0, totalCents: 0 });
  });

  it("sin ajustes guardados: las deudas no caducan, sin avisos y sin comisión", async () => {
    renderSection();
    expect(await screen.findByLabelText("No caducan")).toBeChecked();
    expect(screen.getByLabelText("Días de aviso de las deudas")).toHaveValue("");
    expect(screen.getByLabelText("Comisión del datáfono (%)")).toHaveValue("0");
    expect(save()).toBeDisabled();
  });

  it("guarda el plazo, los avisos ordenados y la comisión en puntos básicos", async () => {
    renderSection();
    fireEvent.click(await screen.findByLabelText(/Caducan a los/));
    fireEvent.change(screen.getByLabelText("Días para que caduque una deuda"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Días de aviso de las deudas"), { target: { value: "10, 5 7" } });
    fireEvent.change(screen.getByLabelText("Comisión del datáfono (%)"), { target: { value: "1,5" } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(svc.update).toHaveBeenCalledWith("club-1", {
        debtExpiryDays: 30, debtWarnDays: [5, 7, 10], cardFeeBps: 150,
      }),
    );
  });

  it("carga lo guardado y «No caducan» manda null", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: 20, debtWarnDays: [5, 10], cardFeeBps: 125 });
    renderSection();
    expect(await screen.findByLabelText("Días para que caduque una deuda")).toHaveValue("20");
    expect(screen.getByLabelText("Días de aviso de las deudas")).toHaveValue("5, 10");
    expect(screen.getByLabelText("Comisión del datáfono (%)")).toHaveValue("1,25");
    fireEvent.click(screen.getByLabelText("No caducan"));
    fireEvent.click(save());
    await waitFor(() =>
      expect(svc.update).toHaveBeenCalledWith("club-1", {
        debtExpiryDays: null, debtWarnDays: [5, 10], cardFeeBps: 125,
      }),
    );
  });

  it("un aviso que pasa del plazo, o una comisión fuera de rango, no deja guardar", async () => {
    svc.get.mockResolvedValue({ debtExpiryDays: 10, debtWarnDays: [5], cardFeeBps: 0 });
    renderSection();
    const warn = await screen.findByLabelText("Días de aviso de las deudas");
    fireEvent.change(warn, { target: { value: "5, 12" } });
    expect(screen.getByText(/Ningún aviso puede pasar del plazo de la deuda \(10 días\)/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
    fireEvent.change(warn, { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Comisión del datáfono (%)"), { target: { value: "11" } });
    expect(screen.getByText(/Un porcentaje de 0 a 10/)).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("recepción lo ve pero no lo cambia", async () => {
    access.canWrite = false;
    renderSection();
    expect(await screen.findByLabelText("Comisión del datáfono (%)")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar ajustes" })).not.toBeInTheDocument();
  });

  it("error al cargar: lo dice", async () => {
    svc.get.mockRejectedValue(new Error("boom"));
    renderSection();
    expect(await screen.findByText("No se pudieron cargar los ajustes de cuentas")).toBeInTheDocument();
  });
});

describe("ajustes de cuentas: lo que se escribe", () => {
  it("días de aviso: de 1 a 365, sin repetidos y ordenados", () => {
    expect(parseWarnDays("")).toEqual([]);
    expect(parseWarnDays("10, 5; 7 5")).toEqual([5, 7, 10]);
    expect(parseWarnDays("0")).toBeNull();
    expect(parseWarnDays("366")).toBeNull();
    expect(parseWarnDays("2,5")).toEqual([2, 5]);
    expect(parseWarnDays("2.5")).toBeNull();
    expect(parseWarnDays("a")).toBeNull();
    expect(warnDaysText([5, 7])).toBe("5, 7");
  });

  it("comisión: de 0 a 10 % con hasta dos decimales, en puntos básicos", () => {
    expect(feePercentToBps("1,5")).toBe(150);
    expect(feePercentToBps("0")).toBe(0);
    expect(feePercentToBps("10")).toBe(1000);
    expect(feePercentToBps("10,01")).toBeNull();
    expect(feePercentToBps("1,555")).toBeNull();
    expect(feePercentToBps("-1")).toBeNull();
    expect(feePercentToBps("")).toBeNull();
    expect(bpsToFeeText(150)).toBe("1,5");
    expect(bpsToFeeText(0)).toBe("0");
  });
});

describe("ajustes de la tesorería (inicio, colchón y fondo)", () => {
  const renderTreasury = (treasuryOn: boolean) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <AccountsConfigSection clubId="club-1" treasuryOn={treasuryOn} />
      </QueryClientProvider>,
    );
  };
  const saveTreasury = () => screen.getByRole("button", { name: "Guardar tesorería" });

  beforeEach(() => {
    vi.clearAllMocks();
    access.canWrite = true;
    svc.get.mockResolvedValue({
      ...DEFAULTS, debtWarnDays: [5], treasuryStartDate: null, reserveCents: 0, fundOpeningCents: 0,
    });
    svc.update.mockImplementation((_club: string, input: object) => Promise.resolve(input));
  });

  it("apagada, no salen sus ajustes", async () => {
    renderTreasury(false);
    await screen.findByText("Plazo de las deudas");
    expect(screen.queryByLabelText("Inicio de la tesorería")).not.toBeInTheDocument();
  });

  it("encendida, guarda solo lo que cambia y manda las deudas como estaban", async () => {
    renderTreasury(true);
    const start = await screen.findByLabelText("Inicio de la tesorería");
    expect(saveTreasury()).toBeDisabled();
    fireEvent.change(start, { target: { value: "2026-11-01" } });
    fireEvent.change(screen.getByLabelText("Colchón"), { target: { value: "1500" } });
    fireEvent.click(saveTreasury());
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith("club-1", {
      debtExpiryDays: null, debtWarnDays: [5], cardFeeBps: 0,
      treasuryStartDate: "2026-11-01", reserveCents: 150000,
    }));
  });

  it("un importe que no vale no deja guardar", async () => {
    renderTreasury(true);
    await screen.findByLabelText("Inicio de la tesorería");
    fireEvent.change(screen.getByLabelText("Saldo inicial del fondo"), { target: { value: "mucho" } });
    expect(saveTreasury()).toBeDisabled();
    expect(screen.getByText(/Escribe un importe válido/)).toBeInTheDocument();
  });

  it("quien solo lee los ve sin botón de guardar", async () => {
    access.canWrite = false;
    renderTreasury(true);
    expect(await screen.findByLabelText("Inicio de la tesorería")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar tesorería" })).not.toBeInTheDocument();
  });
});
