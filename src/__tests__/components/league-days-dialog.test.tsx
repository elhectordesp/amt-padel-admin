/**
 * «Editar días de juego» de una liga: sus días son de la semana, no por fecha.
 * Parte de los guardados, valida las franjas y manda el payload semanal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

const updateSchedule = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: { updateSchedule: (...args: unknown[]) => updateSchedule(...args) },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LeagueDaysDialog } from "../../../components/admin/league-days-dialog";

// Lunes por la tarde (18:00-20:00) y jueves en dos franjas
const SAVED = [
  { weekday: 1, slots: ["18:00", "18:30", "19:00", "19:30"], maxUnavailableHours: 2 },
  { weekday: 4, slots: ["10:00", "10:30", "18:00", "18:30"], maxUnavailableHours: 2 },
];

const onClose = vi.fn();
const onSaved = vi.fn();
const renderDialog = (initialDays = SAVED) =>
  render(<LeagueDaysDialog open onClose={onClose} tournamentId="l-1" initialDays={initialDays} onSaved={onSaved} />);

const save = () => screen.getByRole("button", { name: /Guardar días/ });

describe("LeagueDaysDialog", () => {
  beforeEach(() => {
    updateSchedule.mockReset();
    onClose.mockClear();
    onSaved.mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("parte de los días guardados: los de la semana, con sus franjas", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Lunes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Jueves" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Martes" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Inicio de la franja del lunes")).toHaveValue("18:00");
    expect(screen.getByLabelText("Fin de la franja del lunes")).toHaveValue("20:00");
    expect(screen.getAllByLabelText("Inicio de la franja del jueves")).toHaveLength(2);
  });

  it("guarda un día por día de la semana, sin fecha, y cierra", async () => {
    updateSchedule.mockResolvedValue([]);
    renderDialog();
    // Se añade el sábado y se quita el jueves
    fireEvent.click(screen.getByRole("button", { name: "Sábado" }));
    fireEvent.click(screen.getByRole("button", { name: "Jueves" }));
    fireEvent.click(save());

    await waitFor(() => expect(updateSchedule).toHaveBeenCalledTimes(1));
    const [id, payload] = updateSchedule.mock.calls[0];
    expect(id).toBe("l-1");
    expect(payload).toEqual([
      { weekday: 1, maxUnavailableSlots: 2, blocks: [{ start: "18:00", end: "20:00" }] },
      { weekday: 6, maxUnavailableSlots: 0, blocks: [{ start: "16:00", end: "21:00" }] },
    ]);
    expect(payload.every((d: { date?: string }) => !("date" in d))).toBe(true);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("sin ningún día no se puede guardar", () => {
    renderDialog([SAVED[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Lunes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige al menos un día de juego.");
    expect(save()).toBeDisabled();
  });

  it("franjas que se solapan no se pueden guardar", () => {
    renderDialog();
    fireEvent.click(screen.getAllByRole("button", { name: /Añadir franja/ })[0]);
    // Lunes: 18:00-20:00 + la nueva (09:00-14:00 libre); se la solapa con la de la tarde
    const starts = screen.getAllByLabelText("Inicio de la franja del lunes");
    fireEvent.change(starts[1], { target: { value: "19:00" } });
    fireEvent.change(screen.getAllByLabelText("Fin de la franja del lunes")[1], { target: { value: "21:00" } });
    expect(screen.getByRole("alert")).toHaveTextContent("El lunes tiene franjas que se solapan.");
    expect(save()).toBeDisabled();
    expect(updateSchedule).not.toHaveBeenCalled();
  });

  it("si el back lo rechaza, se ve su mensaje y no se cierra", async () => {
    updateSchedule.mockRejectedValue(new Error("La liga ya ha empezado"));
    renderDialog();
    fireEvent.click(save());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("La liga ya ha empezado"));
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("ignora los días sin día de la semana (de un torneo)", () => {
    renderDialog([{ weekday: null, slots: ["10:00"], maxUnavailableHours: 1 } as never, SAVED[0]]);
    expect(screen.getAllByLabelText(/Inicio de la franja/)).toHaveLength(1);
  });
});
