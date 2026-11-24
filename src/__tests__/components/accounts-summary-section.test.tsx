/**
 * «Cuentas» → «Resumen»: cifras, ingresos por fuente, gastos, márgenes por
 * actividad, cómo se ha cobrado, «Requiere atención», el selector de periodo con
 * sus flechas y las descargas (Excel y ZIP).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
// El gráfico de recharts no mide nada en jsdom: se prueba su descripción accesible
vi.mock("recharts", () => {
  const Nothing = () => null;
  return {
    BarChart: Nothing, Bar: Nothing, CartesianGrid: Nothing, Legend: Nothing, Tooltip: Nothing, XAxis: Nothing, YAxis: Nothing,
    ResponsiveContainer: () => null,
  };
});
const svc = vi.hoisted(() => ({ summary: vi.fn(), attention: vi.fn(), excel: vi.fn(), receipts: vi.fn() }));
vi.mock("@/lib/services/club-reports", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-reports")>()),
  reportsService: svc,
}));
const saved = vi.hoisted(() => vi.fn());
vi.mock("@/lib/utils/club-reports", async (orig) => ({
  ...(await orig<typeof import("@/lib/utils/club-reports")>()),
  saveDownload: saved,
}));

import { toast } from "sonner";
import { AccountsSummarySection } from "@/components/admin/accounts-summary-section";
import { ApiError } from "@/lib/api";

const summary = (over: Record<string, unknown> = {}) => ({
  period: "month",
  from: "2026-11-01",
  to: "2026-11-30",
  label: "Nov 2026",
  income: {
    totalCents: 372000,
    bySource: {
      BOOKINGS: 110000, REGISTRATIONS: 0, VOUCHERS_COURT: 60000, VOUCHERS_CLASS: 20000, FEES_ACADEMY: 80000,
      FEES_TEAMS: 60000, PRIVATE_CLASSES: 0, SHOP: 10000, OTHER_DEBTS: 7000, LEDGER: 25000,
    },
    ledgerByCategory: [{ categoryId: "c-sp", name: "Patrocinios", activity: "OTHER", cents: 25000 }],
    contractCents: 40000,
  },
  expenses: {
    totalCents: 317700,
    byCategory: [{ categoryId: "c-rent", name: "Alquiler de la instalación", activity: "COURTS", cents: 225000 }],
    coaches: { accruedCents: 37500, missingRate: false },
    shopPurchasesCents: 24000,
    cardFeesCents: 1200,
  },
  result: 54300,
  marginPct: 0.1459,
  byActivity: {
    COURTS: { incomeCents: 170000, expenseCents: 225000, resultCents: -55000 },
    ACADEMY: { incomeCents: 100000, expenseCents: 37500, resultCents: 62500 },
    TEAMS: { incomeCents: 60000, expenseCents: 0, resultCents: 60000 },
    TOURNAMENTS: { incomeCents: 0, expenseCents: 0, resultCents: 0 },
    SHOP: { incomeCents: 10000, expenseCents: 4000, resultCents: 6000 },
    OTHER: { incomeCents: 32000, expenseCents: 13200, resultCents: 18800 },
  },
  shop: { costOfSoldCents: 4000 },
  byMethod: {
    totalsByMethod: { CASH: 292000, CARD: 120000, BIZUM: 15000 },
    bizumByReceiver: { Marta: 9000, Club: 6000 },
    ledgerIncomeByPayment: { BANK: 25000 },
  },
  series: ["Jun 2026", "Jul 2026", "Ago 2026", "Sep 2026", "Oct 2026", "Nov 2026"].map((label, i) => ({
    label, from: `2026-0${i + 1}-01`, to: `2026-0${i + 1}-28`,
    incomeCents: 100000 * (i + 1), expenseCents: 50000 * (i + 1), resultCents: 50000 * (i + 1),
  })),
  warnings: [],
  ...over,
});

const attention = (items: unknown[] = []) => ({ items });
const sampleAttention = attention([
  {
    key: "OVERDUE_FEES", severity: "high", title: "Cuotas de la escuela atrasadas", count: 3, amountCents: 15000,
    href: "/mi-club/escuela",
    details: [{ label: "Ana · Iniciación 2026-10", amountCents: 5000, date: "2026-11-10" }],
  },
  {
    key: "MISSING_RECEIPTS", severity: "normal", title: "Gastos sin justificante", count: 2, amountCents: 30000,
    href: "/mi-club/cuentas?tab=gastos", details: [],
  },
]);

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AccountsSummarySection clubId="club-1" />
    </QueryClientProvider>,
  );
}

describe("AccountsSummarySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T10:00:00Z") });
    svc.summary.mockResolvedValue(summary());
    svc.attention.mockResolvedValue(attention());
  });
  afterEach(() => vi.useRealTimers());

  it("pide el mes en curso y enseña las cuatro cifras", async () => {
    renderSection();
    expect(await screen.findByText("Nov 2026")).toBeInTheDocument();
    expect(svc.summary).toHaveBeenCalledWith("club-1", "month", "2026-11-24");
    const figure = (label: string) => screen.getByRole("group", { name: label });
    expect(figure("Ingresos")).toHaveTextContent("3720,00 €");
    expect(figure("Gastos")).toHaveTextContent("3177,00 €");
    expect(figure("Resultado")).toHaveTextContent("+543,00 €");
    expect(figure("Margen")).toHaveTextContent("14,6 %");
  });

  it("un periodo fuera del plazo de conservación enseña el motivo del back", async () => {
    svc.summary.mockRejectedValue(
      new ApiError("El periodo empieza antes del plazo de conservación de las cuentas (2020-01-01): elige un periodo posterior", 400, "INVALID_QUERY_PARAM"),
    );
    renderSection();
    expect(await screen.findByText("No se pudo cargar el resumen")).toBeInTheDocument();
    expect(screen.getByText(/antes del plazo de conservación/)).toBeInTheDocument();
  });

  it("un fallo que no es un 400 no enseña el mensaje técnico", async () => {
    svc.summary.mockRejectedValue(new ApiError("connect ECONNREFUSED", 500));
    renderSection();
    expect(await screen.findByText("No se pudo cargar el resumen")).toBeInTheDocument();
    expect(screen.queryByText(/ECONNREFUSED/)).not.toBeInTheDocument();
  });

  it("ingresos por fuente: sin las que están a 0, con el contrato aparte y los apuntes por categoría", async () => {
    renderSection();
    const block = await screen.findByRole("region", { name: "Ingresos por fuente" });
    expect(within(block).getByText("Reservas")).toBeInTheDocument();
    expect(within(block).getByText("De ellas, contrato de pistas")).toBeInTheDocument();
    expect(within(block).getByText("Ingresos apuntados a mano: Patrocinios")).toBeInTheDocument();
    expect(within(block).queryByText("Inscripciones de torneos")).not.toBeInTheDocument();
    expect(within(block).queryByText("Clases privadas")).not.toBeInTheDocument();
  });

  it("gastos: categorías, entrenadores, compras de la tienda y datáfono", async () => {
    renderSection();
    const block = await screen.findByRole("region", { name: "Gastos" });
    for (const label of ["Alquiler de la instalación", "Entrenadores (horas dadas)", "Compras de la tienda", "Comisión del datáfono"])
      expect(within(block).getByText(label)).toBeInTheDocument();
  });

  it("márgenes por actividad, con la nota del coste de lo vendido y el resultado con signo", async () => {
    renderSection();
    const block = await screen.findByRole("region", { name: "Márgenes por actividad" });
    expect(within(block).getByText(/el gasto es el coste de lo vendido \(40,00 €\)/)).toBeInTheDocument();
    expect(within(block).getByRole("row", { name: /Pistas/ })).toHaveTextContent("-550,00 €");
    expect(within(block).getByRole("row", { name: /Academia/ })).toHaveTextContent("+625,00 €");
  });

  it("cómo se ha cobrado: por método, el Bizum por receptor y los apuntes por forma de cobro", async () => {
    renderSection();
    const block = await screen.findByRole("region", { name: "Cómo se ha cobrado" });
    expect(within(block).getByText("Efectivo")).toBeInTheDocument();
    expect(within(block).getByText("Móvil de Marta")).toBeInTheDocument();
    expect(within(block).getByText("Móvil de Club")).toBeInTheDocument();
    expect(within(block).getByText("Banco")).toBeInTheDocument();
  });

  it("el gráfico se describe con los 6 periodos para quien no lo ve", async () => {
    renderSection();
    const chart = await screen.findByRole("img", { name: /Jun 2026: ingresos 1000,00 €, gastos 500,00 €/ });
    expect(chart).toHaveAccessibleName(/Nov 2026: ingresos 6000,00 €, gastos 3000,00 €/);
  });

  it("los avisos del resumen (entrenadores sin tarifa...) salen en una lista", async () => {
    svc.summary.mockResolvedValue(summary({ warnings: ["Entrenadores sin tarifa: hay clases sin tarifa"] }));
    renderSection();
    expect(await screen.findByText(/Entrenadores sin tarifa/)).toBeInTheDocument();
  });

  describe("requiere atención", () => {
    it("arriba, con gravedad, importe, detalle y enlaces", async () => {
      svc.attention.mockResolvedValue(sampleAttention);
      renderSection();
      const block = await screen.findByRole("region", { name: "Requiere atención" });
      const overdue = within(block).getByRole("link", { name: /Cuotas de la escuela atrasadas/ });
      expect(overdue).toHaveAttribute("href", "/mi-club/escuela");
      expect(overdue).toHaveTextContent("3");
      expect(overdue).toHaveTextContent("Urgente");
      expect(overdue).toHaveTextContent("150,00 €");
      expect(within(block).getByText("Ana · Iniciación 2026-10")).toBeInTheDocument();
      expect(within(block).getByRole("link", { name: /Gastos sin justificante/ })).not.toHaveTextContent("Urgente");
    });

    it("sin avisos, el bloque no sale", async () => {
      renderSection();
      await screen.findByText("Nov 2026");
      expect(screen.queryByRole("region", { name: "Requiere atención" })).not.toBeInTheDocument();
    });
  });

  describe("periodo", () => {
    it("cambiar a trimestre pide el trimestre de hoy; las flechas van de periodo en periodo", async () => {
      renderSection();
      await screen.findByText("Nov 2026");
      fireEvent.click(screen.getByRole("button", { name: "Trimestre" }));
      await waitFor(() => expect(svc.summary).toHaveBeenLastCalledWith("club-1", "quarter", "2026-11-24"));
      fireEvent.click(screen.getByRole("button", { name: "Periodo anterior" }));
      await waitFor(() => expect(svc.summary).toHaveBeenLastCalledWith("club-1", "quarter", "2026-08-01"));
    });

    it("no se puede ir a un periodo que no ha empezado", async () => {
      renderSection();
      await screen.findByText("Nov 2026");
      expect(screen.getByRole("button", { name: "Periodo siguiente" })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Periodo anterior" }));
      await waitFor(() => expect(svc.summary).toHaveBeenLastCalledWith("club-1", "month", "2026-10-01"));
      expect(screen.getByRole("button", { name: "Periodo siguiente" })).toBeEnabled();
    });

    it("un fallo no se pinta como un resumen a cero", async () => {
      svc.summary.mockRejectedValue(new Error("boom"));
      renderSection();
      expect(await screen.findByText("No se pudo cargar el resumen")).toBeInTheDocument();
    });
  });

  describe("descargas", () => {
    it("«Descargar Excel» pide el periodo y el día y guarda el fichero", async () => {
      const file = { blob: new Blob(["x"]), fileName: "Cuentas Club Nov 2026.xlsx" };
      svc.excel.mockResolvedValue(file);
      renderSection();
      await screen.findByText("Nov 2026");
      fireEvent.click(screen.getByRole("button", { name: /Descargar Excel/ }));
      await waitFor(() => expect(svc.excel).toHaveBeenCalledWith("club-1", "month", "2026-11-24"));
      await waitFor(() => expect(saved).toHaveBeenCalledWith(file));
    });

    it("por semana no hay Excel", async () => {
      renderSection();
      await screen.findByText("Nov 2026");
      fireEvent.click(screen.getByRole("button", { name: "Semana" }));
      await waitFor(() => expect(svc.summary).toHaveBeenLastCalledWith("club-1", "week", "2026-11-24"));
      expect(screen.getByRole("button", { name: /Descargar Excel/ })).toBeDisabled();
    });

    it("«Justificantes del mes (ZIP)» pide el mes del periodo", async () => {
      const file = { blob: new Blob(["z"]), fileName: "Justificantes 2026-11.zip" };
      svc.receipts.mockResolvedValue(file);
      renderSection();
      await screen.findByText("Nov 2026");
      fireEvent.click(screen.getByRole("button", { name: /Justificantes del mes/ }));
      await waitFor(() => expect(svc.receipts).toHaveBeenCalledWith("club-1", "2026-11"));
      await waitFor(() => expect(saved).toHaveBeenCalledWith(file));
    });

    it("si la descarga falla, lo dice con el mensaje del error", async () => {
      svc.receipts.mockRejectedValue(Object.assign(new Error("Hay 301"), { code: "LEDGER_TOO_MANY_RECEIPTS" }));
      renderSection();
      await screen.findByText("Nov 2026");
      fireEvent.click(screen.getByRole("button", { name: /Justificantes del mes/ }));
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ese mes tiene más de 300 justificantes y no caben en un ZIP."));
      expect(saved).not.toHaveBeenCalled();
    });
  });
});
