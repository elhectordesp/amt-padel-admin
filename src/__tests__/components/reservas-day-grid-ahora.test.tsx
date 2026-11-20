import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import type { Court } from "@/types";

const COURTS = [{ id: "p1", name: "Pista 1", active: true }] as unknown as Court[];
const WINDOW = { openTime: "09:00", closeTime: "23:00" };

function renderGrid(nowMinutes: number | null) {
  return render(
    <ReservasDayGrid
      date="2026-11-20"
      timeZone="Europe/Madrid"
      courts={COURTS}
      bookings={[]}
      window={WINDOW}
      nowMinutes={nowMinutes}
    />,
  );
}

describe("ReservasDayGrid: arranca en la hora actual", () => {
  afterEach(() => { delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; });

  it("hoy lleva la franja de ahora a la vista", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderGrid(21 * 60 + 10);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBeInstanceOf(HTMLTableRowElement);
  });

  it("otro día no se mueve", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderGrid(null);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
