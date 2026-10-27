import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CategoryLevelSummary } from "@/types/preparation";

const levelBandsMock = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { levelBands: (...a: unknown[]) => levelBandsMock(...a) },
  },
}));

import { CategoryLevelBands, bandLabel } from "../../../components/admin/category-level-bands";

const summary = (o: Partial<CategoryLevelSummary>): CategoryLevelSummary => ({
  categoryId: "c1", gender: "M", level: "4a",
  band: { min: 429, max: 571 },
  players: 6, minSpa: 300, maxSpa: 800, avgSpa: 521.7,
  belowBand: 1, aboveBand: 2, lowReliability: 1,
  ...o,
});

function renderBands() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CategoryLevelBands tournamentId="t1" />
    </QueryClientProvider>,
  );
}

describe("bandLabel", () => {
  it("rango, o sin techo en el nivel más alto", () => {
    expect(bandLabel({ min: 429, max: 571 })).toBe("429-571");
    expect(bandLabel({ min: 858, max: null })).toBe("858 o más");
    expect(bandLabel(null)).toBe("Sin banda");
  });
});

describe("CategoryLevelBands", () => {
  beforeEach(() => vi.clearAllMocks());

  it("por categoría: banda recomendada, mínimo, media, máximo y quién queda fuera", async () => {
    levelBandsMock.mockResolvedValue([
      summary({}),
      summary({ categoryId: "c2", gender: "F", level: "1a", band: { min: 858, max: null }, players: 0, minSpa: null, maxSpa: null, avgSpa: null, belowBand: 0, aboveBand: 0, lowReliability: 0 }),
    ]);
    renderBands();

    expect(await screen.findByText("Masc. 4ª")).toBeInTheDocument();
    expect(screen.getByText("429-571")).toBeInTheDocument();
    expect(screen.getByText("521,7")).toBeInTheDocument();
    expect(screen.getByText("1 por debajo de la banda")).toBeInTheDocument();
    expect(screen.getByText("2 por encima de la banda")).toBeInTheDocument();
    expect(screen.getByText("1 con SPA poco fiable")).toBeInTheDocument();
    // Sin inscritos: lo dice
    expect(screen.getByText("Fem. 1ª")).toBeInTheDocument();
    expect(screen.getByText("858 o más")).toBeInTheDocument();
    expect(screen.getByText("Sin jugadores inscritos.")).toBeInTheDocument();
    // Solo informa
    expect(screen.getByText(/no limita las inscripciones/)).toBeInTheDocument();
    expect(levelBandsMock).toHaveBeenCalledWith("t1");
  });

  it("sin categorías lo dice en vez de quedarse en blanco", async () => {
    levelBandsMock.mockResolvedValue([]);
    renderBands();
    expect(await screen.findByText(/aún no tiene categorías/)).toBeInTheDocument();
  });
});
