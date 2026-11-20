/**
 * Calendario de una liga: los partidos por fecha (los sin fecha, aparte), el
 * tablero por pista de un día y programar un partido (fecha, hora y pista del
 * club). Si el back rechaza la pista por ocupada, el aviso se queda en el
 * diálogo; sin permiso de escritura, solo se ve.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MatchResult, Tournament } from "@/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const svc = vi.hoisted(() => ({
  scheduleLeagueMatch: vi.fn(),
  courts: vi.fn(),
}));
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    matches: { scheduleLeagueMatch: (...a: unknown[]) => svc.scheduleLeagueMatch(...a) },
    tournamentCourts: { list: () => svc.courts() },
  },
}));

import { LeagueCalendarTab } from "@/components/admin/league-calendar";
import { toast } from "sonner";

const TOURNAMENT = {
  id: "l1",
  name: "Liga de invierno",
  kind: "LEAGUE",
  timezone: "Europe/Madrid",
  matchDuration: 60,
  elimMatchDuration: null,
  categories: [
    { id: "c1", gender: "M", level: "3a" },
    { id: "c2", gender: "F", level: "4a" },
  ],
  schedule: [{ id: "d1", label: "Martes", date: null, weekday: 2, slots: ["19:00", "19:30", "20:00"], maxUnavailableHours: 0 }],
} as unknown as Tournament;

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
    players: [],
    ...over,
  };
}

// 20-11-2026 en Madrid es CET (UTC+1): 18:00Z son las 19:00
const MATCHES: MatchResult[] = [
  match({ id: "m1", date: "2026-11-20T18:00:00.000Z", court: "Pista 1", team1: ["Ana"], team2: ["Beto"] }),
  match({ id: "m2", date: "2026-11-20T19:00:00.000Z", court: "Pista 2", round: 2, team1: ["Carla"], team2: ["Dani"] }),
  match({ id: "m3", date: "2026-11-24T18:00:00.000Z", court: null, round: 3, team1: ["Eva"], team2: ["Fran"] }),
  match({ id: "sin1", round: 4, team1: ["Gus"], team2: ["Hugo"] }),
  match({ id: "sin2", categoryId: "c2", round: 1, team1: ["Iris"], team2: ["Jon"], group: "Grupo B" }),
];

const COURTS = [
  { id: "tc1", tournamentId: "l1", courtId: "k1", court: { id: "k1", name: "Pista 1" } },
  { id: "tc2", tournamentId: "l1", courtId: "k2", court: { id: "k2", name: "Pista 2" } },
];

function renderTab(over: Partial<Parameters<typeof LeagueCalendarTab>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LeagueCalendarTab
        tournamentId="l1"
        tournament={TOURNAMENT}
        matches={MATCHES}
        canWrite
        onCorrectResult={vi.fn()}
        {...over}
      />
    </QueryClientProvider>,
  );
}

describe("LeagueCalendarTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.courts.mockResolvedValue(COURTS);
    svc.scheduleLeagueMatch.mockResolvedValue({ match: {} });
  });

  describe("lista por fecha", () => {
    it("un bloque por día con sus partidos por hora y pista, y los sin fecha aparte", async () => {
      renderTab();

      const dia20 = screen.getByRole("region", { name: "2026-11-20" });
      expect(within(dia20).getByText("19:00")).toBeInTheDocument();
      expect(within(dia20).getByText("Pista 1")).toBeInTheDocument();
      expect(within(dia20).getByText("20:00")).toBeInTheDocument();
      expect(within(dia20).getByText("2 partidos")).toBeInTheDocument();

      // Un partido con fecha pero sin pista lo dice
      const dia24 = screen.getByRole("region", { name: "2026-11-24" });
      expect(within(dia24).getByText("Sin pista")).toBeInTheDocument();

      const sinFecha = screen.getByRole("region", { name: "Sin fecha" });
      expect(within(sinFecha).getByText(/Sin fecha · 2 partidos/)).toBeInTheDocument();
      expect(within(sinFecha).getByText(/Gus/)).toBeInTheDocument();
      // Los sin fecha no se mezclan con los de un día
      expect(within(dia20).queryByText(/Gus/)).not.toBeInTheDocument();
    });

    it("filtra por categoría", () => {
      renderTab();
      fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), { target: { value: "c2" } });
      const sinFecha = screen.getByRole("region", { name: "Sin fecha" });
      expect(within(sinFecha).getByText(/Iris/)).toBeInTheDocument();
      expect(within(sinFecha).queryByText(/Gus/)).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "2026-11-20" })).not.toBeInTheDocument();
    });

    it("sin ninguna fecha puesta, lo explica", () => {
      renderTab({ matches: [MATCHES[3]] });
      expect(screen.getByText(/Ningún partido tiene fecha todavía/)).toBeInTheDocument();
    });
  });

  describe("programar un partido", () => {
    it("pone la fecha y la pista: la hora que se escribe es la de la liga", async () => {
      renderTab();
      const sinFecha = screen.getByRole("region", { name: "Sin fecha" });
      fireEvent.click(within(sinFecha).getAllByRole("button", { name: /Programar/ })[0]);

      const dialog = await screen.findByRole("dialog", { name: "Programar partido" });
      // La pista espera a la fecha
      expect(within(dialog).getByLabelText(/^Pista/)).toBeDisabled();
      fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), { target: { value: "2026-11-24T19:00" } });
      // Las pistas del club llegan de su consulta
      await within(dialog).findByRole("option", { name: "Pista 2" });
      fireEvent.change(within(dialog).getByLabelText(/^Pista/), { target: { value: "Pista 2" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(svc.scheduleLeagueMatch).toHaveBeenCalledTimes(1));
      // 19:00 en Madrid (CET) son las 18:00 UTC
      expect(svc.scheduleLeagueMatch).toHaveBeenCalledWith("sin1", { date: "2026-11-24T18:00:00.000Z", court: "Pista 2" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(toast.success).toHaveBeenCalledWith("Partido programado");
    });

    it("si la pista está ocupada, el aviso del back se queda en el diálogo y no se cierra", async () => {
      svc.scheduleLeagueMatch.mockRejectedValue(
        new Error("No se puede programar ahí: «Pista 1» está bloqueada (Cambio de césped)"),
      );
      renderTab();
      const sinFecha = screen.getByRole("region", { name: "Sin fecha" });
      fireEvent.click(within(sinFecha).getAllByRole("button", { name: /Programar/ })[0]);
      const dialog = await screen.findByRole("dialog", { name: "Programar partido" });
      fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), { target: { value: "2026-11-24T19:00" } });
      await within(dialog).findByRole("option", { name: "Pista 1" });
      fireEvent.change(within(dialog).getByLabelText(/^Pista/), { target: { value: "Pista 1" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent("«Pista 1» está bloqueada (Cambio de césped)");
      expect(screen.getByRole("dialog", { name: "Programar partido" })).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();

      // Puede corregirlo y volver a guardar: el aviso se va al reintentar
      svc.scheduleLeagueMatch.mockResolvedValue({ match: {} });
      fireEvent.change(within(dialog).getByLabelText(/^Pista/), { target: { value: "Pista 2" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    describe("un día en que la liga no juega (aviso «Confirma para…»)", () => {
      const WARNING = "El sábado no es un día de juego de la liga (se juega: viernes). Confirma para programarlo igualmente.";

      const openAndSave = async () => {
        renderTab();
        const sinFecha = screen.getByRole("region", { name: "Sin fecha" });
        fireEvent.click(within(sinFecha).getAllByRole("button", { name: /Programar/ })[0]);
        const dialog = await screen.findByRole("dialog", { name: "Programar partido" });
        fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), { target: { value: "2026-11-21T19:00" } });
        await within(dialog).findByRole("option", { name: "Pista 2" });
        fireEvent.change(within(dialog).getByLabelText(/^Pista/), { target: { value: "Pista 2" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
        return dialog;
      };

      it("se pregunta y, si se acepta, se repite la petición con force", async () => {
        svc.scheduleLeagueMatch.mockRejectedValueOnce(new Error(WARNING)).mockResolvedValue({ match: {} });
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);

        await openAndSave();

        await waitFor(() => expect(svc.scheduleLeagueMatch).toHaveBeenCalledTimes(2));
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Confirma para programarlo igualmente"));
        expect(svc.scheduleLeagueMatch).toHaveBeenNthCalledWith(1, "sin1", { date: "2026-11-21T18:00:00.000Z", court: "Pista 2" });
        expect(svc.scheduleLeagueMatch).toHaveBeenNthCalledWith(2, "sin1", { date: "2026-11-21T18:00:00.000Z", court: "Pista 2", force: true });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(toast.success).toHaveBeenCalledWith("Partido programado");
        confirm.mockRestore();
      });

      it("si no se acepta, no se repite y el aviso se queda en el diálogo", async () => {
        svc.scheduleLeagueMatch.mockRejectedValue(new Error(WARNING));
        const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

        const dialog = await openAndSave();

        expect(await within(dialog).findByRole("alert")).toHaveTextContent("no es un día de juego de la liga");
        expect(svc.scheduleLeagueMatch).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("dialog", { name: "Programar partido" })).toBeInTheDocument();
        confirm.mockRestore();
      });

      it("un error que no se confirma (pista ocupada, jugador con otro partido) no pregunta", async () => {
        svc.scheduleLeagueMatch.mockRejectedValue(new Error("No se puede programar ahí: Ana ya tiene otro partido"));
        const confirm = vi.spyOn(window, "confirm");

        const dialog = await openAndSave();

        expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ana ya tiene otro partido");
        expect(confirm).not.toHaveBeenCalled();
        confirm.mockRestore();
      });
    });

    it("cambiar un partido ya programado parte de su hora y su pista, y se puede quitar", async () => {
      renderTab();
      const dia20 = screen.getByRole("region", { name: "2026-11-20" });
      fireEvent.click(within(dia20).getAllByRole("button", { name: /Editar/ })[0]);

      const dialog = await screen.findByRole("dialog", { name: "Programar partido" });
      expect(within(dialog).getByLabelText("Fecha y hora")).toHaveValue("2026-11-20T19:00");
      expect(within(dialog).getByLabelText(/^Pista/)).toHaveValue("Pista 1");

      fireEvent.click(within(dialog).getByRole("button", { name: "Quitar fecha y pista" }));
      await waitFor(() => expect(svc.scheduleLeagueMatch).toHaveBeenCalledWith("m1", { date: null, court: null }));
      expect(toast.success).toHaveBeenCalledWith("Partido sin fecha");
    });

    it("sin la fecha no hay pista: al borrarla se vacía y se bloquea", async () => {
      renderTab();
      const dia20 = screen.getByRole("region", { name: "2026-11-20" });
      fireEvent.click(within(dia20).getAllByRole("button", { name: /Editar/ })[0]);
      const dialog = await screen.findByRole("dialog", { name: "Programar partido" });
      fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), { target: { value: "" } });
      expect(within(dialog).getByLabelText(/^Pista/)).toBeDisabled();
      expect(within(dialog).getByLabelText(/^Pista/)).toHaveValue("");
    });
  });

  it("sin permiso de escritura se ve el calendario pero no salen los botones de programar", () => {
    renderTab({ canWrite: false });
    expect(screen.getByRole("region", { name: "2026-11-20" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Programar/ })).not.toBeInTheDocument();
  });

  it("un partido jugado no se reprograma desde la lista", () => {
    renderTab({
      matches: [match({ id: "j", date: "2026-11-20T18:00:00.000Z", court: "Pista 1", isResult: true, status: "FINISHED", sets1: [6, 6], sets2: [3, 4] })],
    });
    expect(screen.getByText("Jugado")).toBeInTheDocument();
    expect(screen.getByText("6-3 / 6-4")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
  });

  describe("tablero por pista", () => {
    it("un día con las pistas del club en columnas", async () => {
      renderTab();
      fireEvent.click(screen.getByRole("button", { name: "Tablero por pista" }));
      // Las columnas son las pistas del club, tengan o no partido ese día
      expect(await screen.findByText("Pista 1", { selector: "div" })).toBeInTheDocument();
      expect(await screen.findByText("Pista 2", { selector: "div" })).toBeInTheDocument();
      // Los sin fecha no están en el tablero: van en la lista
      expect(screen.queryByText(/Sin programar/)).not.toBeInTheDocument();
    });

    it("pulsar un partido del tablero abre su programación (si hay permiso)", async () => {
      renderTab();
      fireEvent.click(screen.getByRole("button", { name: "Tablero por pista" }));
      const card = await screen.findByText("Ana");
      fireEvent.click(card);
      expect(await screen.findByRole("dialog", { name: "Programar partido" })).toBeInTheDocument();
    });

    it("sin permiso, pulsar un partido no abre nada", async () => {
      renderTab({ canWrite: false });
      fireEvent.click(screen.getByRole("button", { name: "Tablero por pista" }));
      fireEvent.click(await screen.findByText("Ana"));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
