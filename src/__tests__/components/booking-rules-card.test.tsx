/**
 * Tarjeta «Reglas de reserva»: los dos bloques, su ejemplo y lo que manda al
 * cambiar de modo.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BookingRulesCard } from "@/components/admin/booking-rules-card";
import type { BookingRulesForm } from "@/lib/utils/booking-rules";

const off: BookingRulesForm = {
  strictModeEnabled: false,
  strictFrom: null,
  strictTo: null,
  advanceRuleEnabled: false,
  advanceRuleFrom: null,
  advanceRuleTo: null,
  advanceRuleMinutes: 120,
};

describe("BookingRulesCard", () => {
  it("enseña los dos bloques y un ejemplo bajo cada uno", () => {
    render(<BookingRulesCard value={off} onChange={vi.fn()} />);
    expect(screen.getByText("Reglas de reserva")).toBeTruthy();
    expect(screen.getByText("Reservas sin huecos")).toBeTruthy();
    expect(screen.getByText("Antelación con arrastre")).toBeTruthy();
    expect(screen.getByText(/dejaría libre 11:30-12:00/)).toBeTruthy();
    expect(screen.getByText(/Con 2 h de antelación/)).toBeTruthy();
  });

  it("pasar a Estricto propone una franja", () => {
    const onChange = vi.fn();
    render(<BookingRulesCard value={off} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Estricto" }));
    expect(onChange).toHaveBeenCalledWith({
      strictModeEnabled: true,
      strictFrom: "17:00",
      strictTo: "22:00",
    });
  });

  it("con el modo estricto activo se piden las horas; en flexible no", () => {
    const { rerender } = render(<BookingRulesCard value={off} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/Estricto para las reservas que empiezan: desde/)).toBeNull();
    rerender(
      <BookingRulesCard
        value={{ ...off, strictModeEnabled: true, strictFrom: "17:00", strictTo: "22:00" }}
        onChange={vi.fn()}
      />,
    );
    expect(
      (screen.getByLabelText(/Estricto para las reservas que empiezan: desde/) as HTMLInputElement).value,
    ).toBe("17:00");
  });

  it("activar la antelación pide franja y minutos", () => {
    const onChange = vi.fn();
    render(<BookingRulesCard value={off} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Antelación con arrastre"));
    expect(onChange).toHaveBeenCalledWith({
      advanceRuleEnabled: true,
      advanceRuleFrom: "17:00",
      advanceRuleTo: "22:00",
    });
  });
});
