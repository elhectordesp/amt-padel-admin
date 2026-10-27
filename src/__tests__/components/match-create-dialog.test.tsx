/**
 * Crear partido a mano: la hora escrita es de la zona del torneo, no del
 * navegador (P8). Los tests corren en Europe/Madrid: un torneo de Canarias
 * tiene que mandar las 10:00 de Canarias, no las de Madrid.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const createManualMatch = vi.fn().mockResolvedValue({ matchId: "m-1" });
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { createManualMatch: (...args: unknown[]) => createManualMatch(...args) },
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
