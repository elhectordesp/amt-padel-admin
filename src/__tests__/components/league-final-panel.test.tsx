/**
 * Cuadro final de una liga: un botón manual por categoría, desactivado con el
 * motivo a la vista mientras queden partidos de grupos sin resultado; saca la
 * eliminatoria con los N primeros de cada grupo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LeagueStandingsGroup } from "@/components/admin/league-tabs";
import type { MatchResult } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const svc = vi.hoisted(() => ({ generateLeagueFinal: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({
  adminService: { tournaments: { generateLeagueFinal: (...a: unknown[]) => svc.generateLeagueFinal(...a) } },
}));

import { LeagueFinalPanel } from "@/components/admin/league-final-panel";
import { toast } from "sonner";

const CATEGORIES = [
  { id: "c1", gender: "M" as const, level: "3a" as const },
  { id: "c2", gender: "F" as const, level: "4a" as const },
];

const ROW = { setsWon: 0, setsLost: 0, setDiff: 0, gamesWon: 0, gamesLost: 0, gameDiff: 0, played: 0, wins: 0, points: 0 };
const group = (id: string, label: string, pairs: number, qualifyCount = 2): LeagueStandingsGroup => ({
  id,
  label,
  qualifyCount,
  rows: Array.from({ length: pairs }, (_, i) => ({ ...ROW, pos: i + 1, userId: `${id}-u${i}`, name: `Pareja ${i + 1}` })),
});
const STANDINGS: Record<string, LeagueStandingsGroup[]> = {
  c1: [group("g1", "Grupo A", 4), group("g2", "Grupo B", 4)],
  c2: [group("g3", "Grupo A", 3)],
};

function match(over: Partial<MatchResult> & { id: string }): MatchResult {
  return {
    tournament: "l1",
    categoryId: "c1",
    phase: "GROUPS",
    date: null,
    court: null,
    team1: ["Ana"],
    team2: ["Beto"],
    isResult: false,
    status: "SCHEDULED",
    group: "Grupo A",
    round: 1,
    ...over,
  };
}
const finished = (id: string, over: Partial<MatchResult> = {}) => match({ id, isResult: true, status: "FINISHED", ...over });

function renderPanel(matches: MatchResult[], canWrite = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <LeagueFinalPanel tournamentId="l1" categories={CATEGORIES} matches={matches} standings={STANDINGS} canWrite={canWrite} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const cardOf = (label: RegExp) => screen.getByRole("heading", { name: label }).closest("div.bg-card") as HTMLElement;

describe("LeagueFinalPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.generateLeagueFinal.mockResolvedValue({ generated: true, qualifiers: 4 });
  });

  it("con partidos de grupos sin resultado, el botón está desactivado y dice cuántos quedan", () => {
    renderPanel([finished("a"), match({ id: "b" }), match({ id: "c" })]);
    const card = cardOf(/3ª/);
    expect(within(card).getByRole("button", { name: "Generar cuadro final" })).toBeDisabled();
    // El motivo está a la vista, no solo en un tooltip
    expect(within(card).getByRole("status")).toHaveTextContent("Quedan 2 partidos de grupos sin resultado.");
    fireEvent.click(within(card).getByRole("button", { name: "Generar cuadro final" }));
    expect(svc.generateLeagueFinal).not.toHaveBeenCalled();
  });

  it("cada categoría con lo suyo: una puede estar lista y otra no", () => {
    renderPanel([finished("a"), match({ id: "b", categoryId: "c2" })]);
    expect(within(cardOf(/3ª/)).getByRole("button", { name: "Generar cuadro final" })).toBeEnabled();
    expect(within(cardOf(/4ª/)).getByRole("button", { name: "Generar cuadro final" })).toBeDisabled();
  });

  it("sin grupos sorteados lo dice y no deja generar", () => {
    renderPanel([finished("a")]);
    const card = cardOf(/4ª/);
    expect(within(card).queryByRole("button", { name: /cuadro final/ })).not.toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent(/Sortea primero/);
  });

  it("acabados los grupos, genera con los N primeros (2 por defecto) y avisa", async () => {
    const { invalidate } = renderPanel([finished("a"), finished("b")]);
    const card = cardOf(/3ª/);
    expect(within(card).getByText(/Pasan los 2 primeros de cada grupo: 4 parejas al cuadro/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Generar cuadro final" }));
    await waitFor(() => expect(svc.generateLeagueFinal).toHaveBeenCalledWith("l1", "c1", 2));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Cuadro final generado con 4 parejas"));
    // Recarga lo que cambia: el cuadro, la clasificación y la liga
    const keys = invalidate.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey[0]);
    expect(keys).toEqual(expect.arrayContaining(["bracket", "standings", "matches", "tournament"]));
  });

  it("se puede elegir cuántos pasan, hasta las parejas del grupo más pequeño (máx. 4)", async () => {
    renderPanel([finished("a")]);
    const card = cardOf(/3ª/);
    const select = within(card).getByRole("combobox", { name: /Pasan de cada grupo/ });
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["1", "2", "3", "4"]);
    fireEvent.change(select, { target: { value: "3" } });
    expect(within(card).getByText(/Pasan los 3 primeros de cada grupo: 6 parejas/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Generar cuadro final" }));
    await waitFor(() => expect(svc.generateLeagueFinal).toHaveBeenCalledWith("l1", "c1", 3));

    // El grupo de 3 parejas de la otra categoría: como mucho 3
    const select2 = within(cardOf(/4ª/)).queryByRole("combobox");
    expect(select2).toBeNull(); // sin partidos de grupos sorteados, no hay selector
  });

  it("con el cuadro final ya hecho ofrece rehacerlo, pidiendo confirmación", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPanel([finished("a"), match({ id: "qf", phase: "QF", group: null, team2: ["Carla"] })]);
    const card = cardOf(/3ª/);
    expect(within(card).getByText(/El cuadro final ya está generado/)).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: "Rehacer cuadro final" }));
    expect(svc.generateLeagueFinal).not.toHaveBeenCalled();

    fireEvent.click(within(card).getByRole("button", { name: "Rehacer cuadro final" }));
    await waitFor(() => expect(svc.generateLeagueFinal).toHaveBeenCalledWith("l1", "c1", 2));
    confirm.mockRestore();
  });

  it("con partidos del cuadro final ya jugados no se rehace", () => {
    renderPanel([finished("a"), finished("qf", { phase: "QF", group: null })]);
    const card = cardOf(/3ª/);
    expect(within(card).getByRole("button", { name: "Rehacer cuadro final" })).toBeDisabled();
    expect(within(card).getByRole("status")).toHaveTextContent(/ya tiene partidos jugados/);
  });

  it("si el back lo rechaza, enseña su mensaje", async () => {
    svc.generateLeagueFinal.mockRejectedValue(new Error("Queda 1 partido de grupos sin resultado"));
    renderPanel([finished("a")]);
    fireEvent.click(within(cardOf(/3ª/)).getByRole("button", { name: "Generar cuadro final" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Queda 1 partido de grupos sin resultado"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sin permiso de escritura se ve cómo va pero no salen ni el botón ni el selector", () => {
    renderPanel([finished("a"), match({ id: "b" })], false);
    const card = cardOf(/3ª/);
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    expect(within(card).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(card).getByRole("status")).toHaveTextContent("Queda 1 partido de grupos sin resultado.");
  });
});
