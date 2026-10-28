/**
 * Crear partido a mano: la hora escrita es de la zona del torneo, no del
 * navegador (P8). Los tests corren en Europe/Madrid: un torneo de Canarias
 * tiene que mandar las 10:00 de Canarias, no las de Madrid.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

const createManualMatch = vi.fn().mockResolvedValue({ matchId: "m-1" });
// El rechazo del back, sin pasar por vi.fn: con mockRejectedValue vitest daba
// el test por fallido con el propio error, aunque el diálogo lo recoge
let rejectWith: Error | null = null;
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      createManualMatch: (...args: unknown[]) => (rejectWith ? Promise.reject(rejectWith) : createManualMatch(...args)),
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MatchCreateDialog } from "../../../components/admin/match-create-dialog";

function renderDialog(timeZone: string, initialDate?: string) {
  render(
    <MatchCreateDialog
      open
      onClose={vi.fn()}
      tournamentId="t-1"
      categoryId="c-1"
      categoryLabel="Masc. 4ª"
      groups={[]}
      pairs={[]}
      initialDate={initialDate}
      timeZone={timeZone}
    />,
  );
}

describe("MatchCreateDialog — hora en la zona del torneo", () => {
  beforeEach(() => createManualMatch.mockClear());

  it("torneo de Canarias: las 10:00 escritas en noviembre son las 10:00 UTC", async () => {
    renderDialog("Atlantic/Canary");
    fireEvent.change(screen.getByLabelText("Hora (opcional)"), {
      target: { value: "2026-11-20T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));

    await waitFor(() => expect(createManualMatch).toHaveBeenCalledTimes(1));
    expect(createManualMatch.mock.calls[0][0]).toBe("t-1");
    expect(createManualMatch.mock.calls[0][1]).toMatchObject({
      categoryId: "c-1",
      date: "2026-11-20T10:00:00.000Z",
    });
  });

  it("desde un hueco de la rejilla (hora ya en la zona del torneo), igual", async () => {
    renderDialog("Atlantic/Canary", "2026-07-01T10:00");
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));

    await waitFor(() => expect(createManualMatch).toHaveBeenCalledTimes(1));
    // Verano en Canarias: +1
    expect(createManualMatch.mock.calls[0][1].date).toBe("2026-07-01T09:00:00.000Z");
  });
});

describe("MatchCreateDialog — fuera de los tramos y mensajes del back", () => {
  beforeEach(() => {
    createManualMatch.mockClear();
    rejectWith = null;
  });

  // Jornada del 20-nov de 16:00 a 21:00; los grupos duran 60 min y la eliminatoria 90
  const SCHEDULE = [
    { date: "2026-11-20T00:00:00.000Z", slots: ["16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"] },
  ];
  const renderWithSchedule = (initialDate: string) =>
    render(
      <MatchCreateDialog
        open
        onClose={vi.fn()}
        tournamentId="t-1"
        categoryId="c-1"
        categoryLabel="Masc. 4ª"
        groups={[]}
        pairs={[]}
        initialDate={initialDate}
        timeZone="Europe/Madrid"
        schedule={SCHEDULE}
        durations={{ matchDuration: 60, elimMatchDuration: 90 }}
      />,
    );

  it("el hueco de las 22:00 avisa de que está fuera de los tramos, y deja crearlo", async () => {
    createManualMatch.mockResolvedValue({ matchId: "m-1" });
    renderWithSchedule("2026-11-20T22:00");
    expect(screen.getByRole("alert")).toHaveTextContent("Está fuera de los tramos de la jornada (16:00-21:00).");
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));
    await waitFor(() => expect(createManualMatch).toHaveBeenCalledTimes(1));
  });

  it("un cuarto de 90 min a las 20:00 acabaría después del cierre; a las 19:00, sin aviso", () => {
    renderWithSchedule("2026-11-20T20:00");
    expect(screen.getByRole("alert")).toHaveTextContent("Acabaría a las 21:30, después del cierre del tramo (21:00).");
    fireEvent.change(screen.getByLabelText("Hora (opcional)"), { target: { value: "2026-11-20T19:00" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si el back lo rechaza, se ve su mensaje y no un genérico", async () => {
    rejectWith = new ApiError("Las dos parejas tienen que ser de esta categoría.", 400);
    renderWithSchedule("2026-11-20T17:00");
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Las dos parejas tienen que ser de esta categoría."));
  });
});
