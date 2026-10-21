/**
 * Finanzas: cobrado, pendiente de cobro y devengado (P1-5, D1) y un solo IVA
 * (importe ÷ 1,21) en tarjetas, tabla y CSV (P1-6).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { FinanceStats } from "@/types";

vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

// El gráfico no se mide en jsdom (ancho 0): fuera
vi.mock("recharts", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nothing = () => null;
  return {
    ResponsiveContainer: Box, AreaChart: Box, Area: Nothing, XAxis: Nothing,
    YAxis: Nothing, CartesianGrid: Nothing, Tooltip: Nothing,
  };
});

const downloadCsvMock = vi.fn();
vi.mock("@/lib/utils/csv", () => ({
  downloadCsv: (...args: unknown[]) => downloadCsvMock(...args),
}));

const statsMock = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: { finance: { stats: (...args: unknown[]) => statsMock(...args) } },
}));

import FinanzasPage from "../../../app/(admin)/finanzas/page";

/** 536 € devengados, 441 € cobrados y 95 € pendientes (el caso de la QA). */
const stats: FinanceStats = {
  period:  "month",
  vatRate: 0.21,
  revenue: {
    registrations: 536, sponsorships: 0, merchandise: 0, total: 536,
    collected: 441, outstanding: 95, withoutVat: 442.98, vatAmount: 93.02,
  },
  costs:  { operational: -134, total: -134 },
  profit: { gross: 402, net: 332.23, vatAmount: 69.77 },
  chart:  [],
  byTournament: [
    { id: "t1", name: "Open Valencia", revenue: 456, collected: 441, outstanding: 15, registrations: 14 },
    { id: "t2", name: "Open Málaga",   revenue: 80,  collected: 0,   outstanding: 80, registrations: 2 },
  ],
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <FinanzasPage />
    </QueryClientProvider>,
  );
}

describe("FinanzasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statsMock.mockResolvedValue(stats);
  });

  it("enseña las tres cifras: cobrado, pendiente de cobro y devengado", async () => {
    renderPage();

    expect(await screen.findByText("De 536,00 € devengados")).toBeInTheDocument();
    const cobrado = screen.getByText("Cobrado").parentElement!;
    expect(cobrado).toHaveTextContent("441,00 €");
    expect(screen.getByText("Pendiente de cobro")).toBeInTheDocument();
    expect(screen.getByText("95,00 €")).toBeInTheDocument();
    expect(screen.getByText("Devengado (con IVA)")).toBeInTheDocument();
    expect(screen.getByText("16 parejas confirmadas × precio")).toBeInTheDocument();
  });

  it("un solo IVA para los ingresos: tarjeta, fila y total dan 442,98 € + 93,02 €", async () => {
    renderPage();
    await screen.findByText("De 536,00 € devengados");

    expect(screen.getByText("IVA: 93,02 €")).toBeInTheDocument();
    // Tarjeta sin IVA, fila de inscripciones y TOTAL INGRESOS
    expect(screen.getAllByText("442,98 €")).toHaveLength(3);
    expect(screen.getAllByText("93,02 €")).toHaveLength(2);
    // Lo de antes: el IVA del beneficio restado a los ingresos
    expect(screen.queryByText("466,23 €")).not.toBeInTheDocument();
  });

  it("el desglose por torneo separa cobrado, pendiente y devengado", async () => {
    renderPage();
    await screen.findByText("Open Málaga");

    for (const h of ["COBRADO", "PENDIENTE", "DEVENGADO"])
      expect(screen.getByText(h)).toBeInTheDocument();
    const row = screen.getByText("Open Málaga").closest("tr")!;
    expect([...row.querySelectorAll("td")].map((td) => td.textContent)).toEqual([
      "Open Málaga", "2", "0,00 €", "80,00 €", "80,00 €",
    ]);
  });

  it("el CSV usa el mismo IVA y añade lo cobrado y lo pendiente", async () => {
    renderPage();
    await screen.findByText("De 536,00 € devengados");

    fireEvent.click(screen.getByText("Exportar P&L"));

    const [, rows] = downloadCsvMock.mock.calls[0] as [string, Record<string, string>[]];
    const byConcept = Object.fromEntries(rows.map((r) => [r.Concepto, r]));
    expect(byConcept["Inscripciones (devengado)"]).toMatchObject({ "Sin IVA (€)": "442,98", "IVA (€)": "93,02" });
    expect(byConcept["TOTAL INGRESOS (devengado)"]).toMatchObject({ "Sin IVA (€)": "442,98", "IVA (€)": "93,02" });
    expect(byConcept["Cobrado"]).toMatchObject({ "Con IVA (€)": "441,00" });
    expect(byConcept["Pendiente de cobro"]).toMatchObject({ "Con IVA (€)": "95,00" });
  });

  it("con un back que aún no manda lo cobrado, «—» en vez de un número falso", async () => {
    statsMock.mockResolvedValue({
      ...stats,
      vatRate: undefined,
      revenue: { registrations: 536, sponsorships: 0, merchandise: 0, total: 536 },
      byTournament: [{ id: "t1", name: "Open Valencia", revenue: 536, registrations: 16 }],
    });

    renderPage();
    await screen.findByText("Open Valencia");

    // Cobrado y pendiente (tarjetas y fila del torneo)
    expect(screen.getAllByText("—")).toHaveLength(4);
    // El IVA, igual: 21 % por defecto
    expect(screen.getByText("IVA: 93,02 €")).toBeInTheDocument();
  });
});
