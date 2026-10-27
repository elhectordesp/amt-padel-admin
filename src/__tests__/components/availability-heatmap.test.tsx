import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AvailabilityHeatmap as Heatmap } from "@/types/preparation";

const heatmapMock = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { availabilityHeatmap: (...a: unknown[]) => heatmapMock(...a) },
  },
}));

import { AvailabilityHeatmap, slotColumns } from "../../../components/admin/availability-heatmap";

const categories = [
  { id: "c1", gender: "M", level: "4a" },
  { id: "c2", gender: "F", level: "3a" },
];

const heatmap: Heatmap = {
  categoryId: null,
  totalPairs: 6,
  pairsWithRestrictions: 3,
  criticalCells: 1,
  days: [
    {
      dayId: "d1", label: "Viernes", date: null, type: "AMBOS",
      cells: [
        { slot: "18:00", unavailablePairs: 4, availablePct: 33, level: "CRITICAL" },
        { slot: "19:00", unavailablePairs: 0, availablePct: 100, level: "HIGH" },
      ],
    },
    {
      dayId: "d2", label: "Sábado", date: null, type: "AMBOS",
      cells: [
        { slot: "09:00", unavailablePairs: 1, availablePct: 83, level: "MEDIUM" },
        { slot: "19:00", unavailablePairs: 2, availablePct: 67, level: "LOW" },
      ],
    },
  ],
};

function renderMap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AvailabilityHeatmap tournamentId="t1" categories={categories} />
    </QueryClientProvider>,
  );
}

describe("slotColumns", () => {
  it("las franjas de todas las jornadas, en orden y sin repetir", () => {
    expect(slotColumns(heatmap.days)).toEqual(["09:00", "18:00", "19:00"]);
  });
});

describe("AvailabilityHeatmap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pinta cada franja con las parejas que no pueden y su semáforo en texto visible, y avisa de las críticas", async () => {
    heatmapMock.mockResolvedValue(heatmap);
    renderMap();

    // Para el lector de pantalla, la descripción entera
    const critical = (
      await screen.findByText(/^Viernes 18:00: 4 de 6 parejas no pueden \(33 % puede\) · Muy justa$/)
    ).closest("td")!;
    expect(critical.className).toContain("bg-red-400");
    // A la vista, el número y la etiqueta corta: el color nunca va solo
    expect(within(critical).getByText("4")).toBeVisible();
    expect(within(critical).getByText("M. justa")).toBeVisible();
    const low = screen.getByText(/^Sábado 19:00: 2 de 6 .* · Justa$/).closest("td")!;
    expect(within(low).getByText("2")).toBeInTheDocument();
    expect(within(low).getByText("Justa")).toBeInTheDocument();
    // El sábado no tiene las 18:00: hueco, no un 0
    expect(screen.getAllByText("Sin franja")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("En 1 franja puede jugar menos de la mitad");
    expect(screen.getByText(/parejas inscritas ·/).textContent).toMatch(/^6 parejas inscritas · 3 con alguna franja/);
    // Leyenda con las etiquetas, no solo colores
    expect(screen.getByRole("list", { name: "Leyenda" })).toHaveTextContent("Buena");
    expect(heatmapMock).toHaveBeenCalledWith("t1", undefined);
  });

  it("se filtra por categoría", async () => {
    heatmapMock.mockResolvedValue(heatmap);
    renderMap();
    await screen.findByText(/^Viernes 18:00/);
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "c2" } });
    await waitFor(() => expect(heatmapMock).toHaveBeenLastCalledWith("t1", "c2"));
    expect(screen.getByRole("option", { name: "Fem. 3ª" })).toBeInTheDocument();
  });

  it("sin parejas o sin jornadas, lo dice en vez de pintar un mapa vacío", async () => {
    heatmapMock.mockResolvedValueOnce({ ...heatmap, totalPairs: 0 });
    const { unmount } = renderMap();
    expect(await screen.findByText("Aún no hay parejas inscritas.")).toBeInTheDocument();
    unmount();

    heatmapMock.mockResolvedValueOnce({ ...heatmap, days: [] });
    renderMap();
    expect(await screen.findByText(/no tiene jornadas/)).toBeInTheDocument();
  });
});
