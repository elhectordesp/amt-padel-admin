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

const downloadCsvMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/utils/csv", () => ({ downloadCsv: downloadCsvMock }));

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

// Cada uno es el único (y el primero) de su categoría: Ana en 3ª y Luis en 4ª
const row = (id: string, name: string, gender: "M" | "F", level: "3a" | "4a", points: number, rank: number, partner: string) =>
  ({ id, name, gender, level, points, played: 2, wins: 2, trend: "stable", globalRank: rank, categoryRank: 1, partner });

/** La tarjeta del podio, por el nombre de pila que enseña. */
const podium = (firstName: string) => screen.getByText(firstName).closest("div.border") as HTMLElement;

/** Abre el Mixto y espera a que salgan sus jugadores. */
async function openMixed() {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Mixto" }));
  await screen.findByRole("row", { name: /Ana López c\/ Luis Mora/ });
}

describe("RankingsPage — el ranking Mixto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rankingsMock.list.mockImplementation((gender: string) =>
      Promise.resolve(gender === "MX"
        ? [row("u-ana", "Ana López", "F", "3a", 300, 1, "Luis Mora"), row("u-luis", "Luis Mora", "M", "4a", 250, 2, "Ana López")]
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

  it("las pestañas de categoría salen con su recuento y cada una enseña solo a su jugador, con su pareja", async () => {
    await openMixed();
    expect(screen.getByRole("button", { name: "3ª(1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4ª(1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "4ª(1)" }));
    expect(screen.getByRole("row", { name: /^#1 #2 .*Luis Mora c\/ Ana López/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Ana López c\/ Luis Mora/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3ª(1)" }));
    expect(screen.getByRole("row", { name: /^#1 #1 .*Ana López c\/ Luis Mora/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Luis Mora c\/ Ana López/ })).not.toBeInTheDocument();
  });

  it("el podio enseña a los dos, cada uno en su puesto", async () => {
    await openMixed();
    expect(podium("Ana")).toHaveTextContent("#1");
    expect(podium("Ana")).toHaveTextContent("300 pts");
    expect(podium("Luis")).toHaveTextContent("#2");
    expect(podium("Luis")).toHaveTextContent("250 pts");
  });

  it("el CSV lleva MX en el nombre y una fila por jugador", async () => {
    await openMixed();
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(downloadCsvMock).toHaveBeenCalledWith("ranking-MX-global", [
      { "#Global": 1, "#Categoría": 1, Jugador: "Ana López", Categoría: "3ª", Puntos: 300, "% Victorias": "100%", Tendencia: "stable" },
      { "#Global": 2, "#Categoría": 1, Jugador: "Luis Mora", Categoría: "4ª", Puntos: 250, "% Victorias": "100%", Tendencia: "stable" },
    ]);
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
