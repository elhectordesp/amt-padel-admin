/**
 * Rankings: el Mixto (D3) es una pestaña más del de circuito, junto a
 * Masculino y Femenino. El SPA no lo tiene: el back responde 400 a gender=MX
 * con type=spa, así que al pasar al SPA desde el Mixto se vuelve al Masculino.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

const rankingsMock = vi.hoisted(() => ({
  list:        vi.fn(),
  recalculate: vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({ adminService: { rankings: rankingsMock } }));

import RankingsPage from "../../../app/(admin)/rankings/page";

const SEASON = new Date().getFullYear();

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RankingsPage />
    </QueryClientProvider>,
  );
}

const row = (id: string, name: string, gender: "M" | "F", rank: number, partner: string) =>
  ({ id, name, gender, level: "3a", points: 300, played: 2, wins: 2, trend: "stable", globalRank: rank, categoryRank: rank, partner });

describe("RankingsPage — el ranking Mixto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rankingsMock.list.mockImplementation((gender: string) =>
      Promise.resolve(gender === "MX"
        ? [row("u-ana", "Ana López", "F", 1, "Luis Mora"), row("u-luis", "Luis Mora", "M", 2, "Ana López")]
        : []),
    );
  });

  it("el de circuito ofrece Masculino, Femenino y Mixto, y el Mixto pide gender=MX con la temporada", async () => {
    renderPage();
    await waitFor(() => expect(rankingsMock.list).toHaveBeenCalledWith("M", "circuit", SEASON));

    expect(screen.getByRole("button", { name: "Masculino" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Femenino" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mixto" }));

    await waitFor(() => expect(rankingsMock.list).toHaveBeenCalledWith("MX", "circuit", SEASON));
    expect(await screen.findByText("Ranking global — Mixto")).toBeInTheDocument();
    // Jugadores y jugadoras juntos, cada uno con su pareja de Mixta
    expect(screen.getByRole("row", { name: /^#1 .*Ana López c\/ Luis Mora/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /^#2 .*Luis Mora c\/ Ana López/ })).toBeInTheDocument();
  });

  it("el SPA no tiene Mixto: desde el Mixto vuelve al Masculino y nunca pide MX con el SPA", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Mixto" }));
    await waitFor(() => expect(rankingsMock.list).toHaveBeenCalledWith("MX", "circuit", SEASON));

    fireEvent.click(screen.getByRole("button", { name: "Nivel SPA" }));

    await waitFor(() => expect(rankingsMock.list).toHaveBeenCalledWith("M", "spa", undefined));
    expect(rankingsMock.list.mock.calls.filter(([gender, type]) => gender === "MX" && type !== "circuit")).toEqual([]);
    expect(screen.queryByRole("button", { name: "Mixto" })).not.toBeInTheDocument();
    expect(screen.getByText("Ranking global — Masculino")).toBeInTheDocument();
  });
});
