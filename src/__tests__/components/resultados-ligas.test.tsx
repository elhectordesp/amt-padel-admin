/**
 * Resultados: los selectores incluyen las ligas (agrupadas aparte de los
 * torneos) y los partidos de grupos de una liga dicen su jornada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const listAll = vi.fn();
const matchesList = vi.fn();
const setResult = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { listAll: () => listAll() },
    matches: { list: (...args: unknown[]) => matchesList(...args), setResult: (...args: unknown[]) => setResult(...args) },
  },
}));

import ResultadosPage from "../../../app/(admin)/resultados/page";

const base = { club: { id: "c1", name: "Club Madrid" }, startDate: "2026-12-07T00:00:00.000Z", endDate: "2027-03-01T00:00:00.000Z", categories: [] };
const TOURNAMENT = { ...base, id: "t1", name: "Open de otoño", kind: "TOURNAMENT", status: "ONGOING" };
const LEAGUE = { ...base, id: "l1", name: "Liga de invierno", kind: "LEAGUE", status: "ONGOING" };

const match = (id: string, phase: string, round: number | null) => ({
  id, phase, round, date: null, court: null, team1: ["Ana"], team2: ["Beto"], isResult: false, status: "SCHEDULED", sets1: [], sets2: [],
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ResultadosPage />
    </QueryClientProvider>,
  );
}

describe("Resultados con ligas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAll.mockResolvedValue([TOURNAMENT, LEAGUE]);
    matchesList.mockResolvedValue([]);
  });

  it("el selector lista torneos y ligas, cada grupo con su etiqueta", async () => {
    renderPage();
    expect(await screen.findByRole("option", { name: "Liga de invierno" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Ligas" })).toContainElement(screen.getByRole("option", { name: "Liga de invierno" }));
    expect(screen.getByRole("group", { name: "Torneos" })).toContainElement(screen.getByRole("option", { name: "Open de otoño" }));
  });

  it("elegir una liga carga sus partidos; los de grupos dicen su jornada", async () => {
    matchesList.mockResolvedValue([match("m1", "GROUPS", 3)]);
    renderPage();
    await screen.findByRole("option", { name: "Liga de invierno" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l1" } });

    expect((await screen.findAllByText("Grupos · Jornada 3")).length).toBeGreaterThan(0);
    expect(matchesList).toHaveBeenCalledWith("l1");
  });

  it("en un torneo, la fase sin jornada", async () => {
    matchesList.mockResolvedValue([match("m1", "GROUPS", 1)]);
    renderPage();
    await screen.findByRole("option", { name: "Open de otoño" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "t1" } });

    expect((await screen.findAllByText("Grupos")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Jornada/)).not.toBeInTheDocument();
  });
});

describe("Resultados: torneo que no está en curso (F17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAll.mockResolvedValue([TOURNAMENT]);
    matchesList.mockResolvedValue([match("m1", "GROUPS", 1)]);
  });

  it("el «Confirma para…» del back se ofrece en un diálogo del panel y reintenta con force", async () => {
    setResult
      .mockRejectedValueOnce(new Error("El torneo no está «Programado». Confirma para registrar el resultado de todas formas."))
      .mockResolvedValueOnce({});
    const nativeConfirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await screen.findByRole("option", { name: "Open de otoño" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "t1" } });
    fireEvent.click((await screen.findAllByRole("button", { name: /Introducir|Registrar|Resultado/ }))[0]);
    fireEvent.change(await screen.findByLabelText("Set 1 pareja 1"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Set 1 pareja 2"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Set 2 pareja 1"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Set 2 pareja 2"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar resultado" }));

    const dialog = await screen.findByRole("dialog", { name: "¿Registrar el resultado igualmente?" });
    expect(nativeConfirm).not.toHaveBeenCalled();
    fireEvent.click(Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Registrar igualmente")!);
    await waitFor(() => expect(setResult).toHaveBeenCalledTimes(2));
    expect(setResult.mock.calls[1][5]).toBe(true);
    nativeConfirm.mockRestore();
  });
});
