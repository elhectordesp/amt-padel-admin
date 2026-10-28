/**
 * «Editar jornadas» (P2-9): no guarda tramos solapados ni jornadas fuera de
 * las fechas del torneo, el tramo nuevo no pisa los que hay y, si el back
 * falla, se ve su mensaje.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";

const updateSchedule = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { updateSchedule: (...args: unknown[]) => updateSchedule(...args) },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ScheduleEditorDialog } from "../../../components/admin/schedule-editor-dialog";

// Torneo del 20 al 22 de noviembre, con una jornada de tarde el 20
const renderDialog = () =>
  render(
    <ScheduleEditorDialog
      open
      onClose={vi.fn()}
      tournamentId="t-1"
      startDate="2026-11-20"
      endDate="2026-11-22"
      initialDays={[
        { date: "2026-11-20T00:00:00.000Z", type: "AMBOS", slots: ["16:00", "16:30", "17:00", "17:30"] },
      ]}
    />,
  );

const save = () => screen.getByRole("button", { name: /Guardar jornadas/ });
const timeInputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="time"]'));

describe("ScheduleEditorDialog — validación de jornadas (P2-9)", () => {
  beforeEach(() => {
    updateSchedule.mockReset();
    vi.mocked(toast.error).mockClear();
  });

  it("«Añadir tramo» propone uno que no pisa el que hay, y se puede guardar", async () => {
    updateSchedule.mockResolvedValue([]);
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Añadir tramo/ }));
    expect(timeInputs().map((i) => i.value)).toEqual(["16:00", "18:00", "09:00", "14:00"]);
    expect(save()).toBeEnabled();
    fireEvent.click(save());
    await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
  });

  it("un tramo que se solapa con otro no se puede guardar", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Añadir tramo/ }));
    // 09:00-14:00 → 15:00-17:00: pisa el de 16:00-18:00
    fireEvent.change(timeInputs()[2], { target: { value: "15:00" } });
    fireEvent.change(timeInputs()[3], { target: { value: "17:00" } });
    expect(screen.getByText("En la jornada del 20 nov hay tramos que se solapan.")).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("una jornada fuera de las fechas del torneo no se puede guardar", () => {
    renderDialog();
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="date"]')!, {
      target: { value: "2026-12-25" },
    });
    expect(
      screen.getByText("La jornada del 25 dic cae fuera del torneo (del 20 nov al 22 nov)."),
    ).toBeInTheDocument();
    expect(save()).toBeDisabled();
  });

  it("dos jornadas el mismo día con tipos distintos se guardan (el back las admite: grupos y eliminatoria)", async () => {
    updateSchedule.mockResolvedValue([]);
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /Añadir jornada/ }));
    const dates = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    fireEvent.change(dates[1], { target: { value: "2026-11-20" } });
    const types = document.querySelectorAll<HTMLSelectElement>("select");
    fireEvent.change(types[0], { target: { value: "GRUPOS" } });
    fireEvent.change(types[1], { target: { value: "ELIMINATORIAS" } });

    expect(save()).toBeEnabled();
    fireEvent.click(save());
    await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
    expect(updateSchedule.mock.calls[0][1]).toMatchObject([
      { date: "2026-11-20", type: "GRUPOS" },
      { date: "2026-11-20", type: "ELIMINATORIAS" },
    ]);
  });

  it("si el back lo rechaza, se ve su mensaje y no un genérico", async () => {
    updateSchedule.mockRejectedValue(new ApiError("El torneo ya ha empezado; las jornadas y horarios no se pueden editar.", 400));
    renderDialog();
    fireEvent.click(save());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("El torneo ya ha empezado; las jornadas y horarios no se pueden editar."),
    );
  });
});
