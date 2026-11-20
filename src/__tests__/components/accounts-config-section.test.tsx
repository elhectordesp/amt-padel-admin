/**
 * Ajustes de cuentas: plazo de las deudas, días de aviso y comisión del
 * datáfono. Los guarda quien escribe en Configuración; recepción solo los ve.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ canWrite: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: () => access.canWrite }),
}));
const svc = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/services/accounts-config", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts-config")>()),
  accountsConfigService: svc,
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

describe("AccountsConfigSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.canWrite = true;
    svc.get.mockResolvedValue(DEFAULTS);
    svc.update.mockImplementation((_club: string, input: object) => Promise.resolve(input));
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
