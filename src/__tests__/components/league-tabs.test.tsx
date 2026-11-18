/**
 * Pestañas de la ficha de una liga: «Jornadas» (por grupo y jornada, con el
 * resultado) y «Clasificación» (la que calcula el back para los grupos).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LeagueRoundsTab, LeagueStandingsTab, type LeagueStandingsGroup } from "../../../components/admin/league-tabs";
import type { MatchResult } from "@/types";

const CATEGORIES = [
  { id: "c1", gender: "M" as const, level: "3a" as const },
  { id: "c2", gender: "F" as const, level: "4a" as const },
];

function match(over: Partial<MatchResult> & { id: string }): MatchResult {
  return {
    tournament: "t1",
    categoryId: "c1",
    phase: "GROUPS",
    date: null,
    court: null,
    team1: [],
    team2: [],
    isResult: false,
    status: "SCHEDULED",
    group: "Grupo A",
    round: 1,
    players: [],
    ...over,
  };
}

// Grupo A de tres parejas: cada jornada juegan dos y la tercera descansa
const MATCHES: MatchResult[] = [
  match({ id: "m1", round: 1, team1: ["Ana"], team2: ["Beto"], players: [{ userId: "u1", team: 1 }, { userId: "u2", team: 2 }], isResult: true, status: "FINISHED", sets1: [6, 6], sets2: [3, 4], winner: "team1" }),
  match({ id: "m2", round: 2, team1: ["Ana"], team2: ["Carla"], players: [{ userId: "u1", team: 1 }, { userId: "u3", team: 2 }] }),
  match({ id: "m3", round: 3, team1: ["Beto"], team2: ["Carla"], players: [{ userId: "u2", team: 1 }, { userId: "u3", team: 2 }] }),
  match({ id: "other", categoryId: "c2", group: "Grupo A", round: 1, team1: ["Otra"], team2: ["Pareja"] }),
];

const ROW = { setsWon: 0, setsLost: 0, setDiff: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, played: 0, wins: 0, points: 0 };
const STANDINGS: Record<string, LeagueStandingsGroup[]> = {
  c1: [
    {
      id: "g1",
      label: "Grupo A",
      rows: [
        { ...ROW, pos: 1, userId: "u1", name: "Ana", played: 1, wins: 1, points: 3, setsWon: 2, setDiff: 2, gamesWon: 12, gamesLost: 7, gameDiff: 5 },
        { ...ROW, pos: 2, userId: "u3", name: "Carla" },
        { ...ROW, pos: 3, userId: "u2", name: "Beto", played: 1, setsLost: 2, setDiff: -2, gamesWon: 7, gamesLost: 12, gameDiff: -5 },
      ],
    },
  ],
  c2: [],
};

describe("LeagueRoundsTab", () => {
  const renderTab = (over: Partial<Parameters<typeof LeagueRoundsTab>[0]> = {}) => {
    const onEnterResult = vi.fn();
    const onCorrectResult = vi.fn();
    render(
      <LeagueRoundsTab
        startDate="2026-12-07"
        categories={CATEGORIES}
        matches={MATCHES}
        standings={STANDINGS}
        onEnterResult={onEnterResult}
        onCorrectResult={onCorrectResult}
        {...over}
      />,
    );
    return { onEnterResult, onCorrectResult };
  };

  it("muestra las jornadas del grupo en orden, con su semana orientativa y lo jugado", () => {
    renderTab();
    const grupo = screen.getByRole("region", { name: "Grupo A" });
    const jornadas = within(grupo).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(jornadas).toEqual(["Jornada 1", "Jornada 2", "Jornada 3"]);
    // Inicio + 7 días por jornada
    expect(within(grupo).getByText(/Semana del 7 dic · 1\/1 jugados/)).toBeInTheDocument();
    expect(within(grupo).getByText(/Semana del 14 dic · 0\/1 jugados/)).toBeInTheDocument();
    expect(within(grupo).getByText(/Semana del 21 dic · 0\/1 jugados/)).toBeInTheDocument();
  });

  it("solo enseña los partidos de la categoría elegida, y se cambia de categoría", () => {
    renderTab();
    expect(screen.queryByText("Otra")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Fem\. 4ª/ }));
    expect(screen.getByText("Otra")).toBeInTheDocument();
    expect(screen.queryByText("Carla")).not.toBeInTheDocument();
  });

  it("dice quién descansa cada jornada", () => {
    renderTab();
    expect(screen.getByText("Carla", { selector: "span.text-foreground" })).toBeInTheDocument();
    expect(screen.getByText("Beto", { selector: "span.text-foreground" })).toBeInTheDocument();
    expect(screen.getByText("Ana", { selector: "span.text-foreground" })).toBeInTheDocument();
  });

  it("el marcador de lo jugado y «vs» en lo pendiente", () => {
    renderTab();
    expect(screen.getByText("6-3 / 6-4")).toBeInTheDocument();
    expect(screen.getAllByText("vs")).toHaveLength(2);
  });

  it("«Meter resultado» en lo pendiente y «Corregir» en lo jugado abren el flujo de siempre", () => {
    const { onEnterResult, onCorrectResult } = renderTab();
    fireEvent.click(screen.getAllByRole("button", { name: /Meter resultado/ })[0]);
    expect(onEnterResult).toHaveBeenCalledWith(expect.objectContaining({ id: "m2" }));
    fireEvent.click(screen.getByRole("button", { name: /Corregir/ }));
    expect(onCorrectResult).toHaveBeenCalledWith(expect.objectContaining({ id: "m1" }));
  });

  it("sin permiso para meter resultados se ven las jornadas pero no sus botones", () => {
    renderTab({ canWrite: false });
    expect(screen.getByText("6-3 / 6-4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Meter resultado/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir/ })).not.toBeInTheDocument();
  });

  it("un partido sin las dos parejas no ofrece meter resultado", () => {
    renderTab({ matches: [match({ id: "vacio", team1: ["Ana"], team2: [] })] });
    expect(screen.queryByRole("button", { name: /Meter resultado/ })).not.toBeInTheDocument();
  });

  it("sin jornadas, manda a sortear los grupos", () => {
    renderTab({ matches: [] });
    expect(screen.getByText(/aún no tiene jornadas/)).toBeInTheDocument();
  });

  it("con una sola categoría no hay selector", () => {
    renderTab({ categories: [CATEGORIES[0]] });
    expect(screen.queryByRole("group", { name: "Categoría" })).not.toBeInTheDocument();
  });
});

describe("LeagueStandingsTab", () => {
  it("la clasificación de cada grupo, con las columnas del cuadro", () => {
    render(<LeagueStandingsTab categories={CATEGORIES} standings={STANDINGS} />);
    const table = screen.getByRole("table", { name: "Clasificación Grupo A" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("cell")[1].textContent)).toEqual(["Ana", "Carla", "Beto"]);
    // Ana: 1 jugado, 1 ganado, +2 sets, +5 juegos, 3 puntos
    const ana = within(rows[0]).getAllByRole("cell").map((c) => c.textContent);
    expect(ana).toEqual(["1", "Ana", "1", "1", "2", "0", "+2", "12", "7", "+5", "3"]);
    expect(within(rows[2]).getAllByRole("cell")[6].textContent).toBe("-2");
  });

  it("cambia de categoría", () => {
    render(<LeagueStandingsTab categories={CATEGORIES} standings={STANDINGS} />);
    fireEvent.click(screen.getByRole("button", { name: /Fem\. 4ª/ }));
    expect(screen.getByText(/aún no tiene clasificación/)).toBeInTheDocument();
  });

  it("mientras carga, lo dice", () => {
    render(<LeagueStandingsTab categories={CATEGORIES} standings={{}} />);
    expect(screen.getByText("Cargando clasificación...")).toBeInTheDocument();
  });
});
