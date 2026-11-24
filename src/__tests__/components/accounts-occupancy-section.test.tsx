/**
 * «Cuentas» → «Ocupación»: cifras totales y por tipo, desglose por pista,
 * franja, hora y día, rango a mano con su validación, y el efecto de un cambio
 * de precios con el aviso de pocos datos.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const svc = vi.hoisted(() => ({ get: vi.fn(), priceChange: vi.fn() }));
vi.mock("@/lib/services/club-occupancy", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-occupancy")>()),
  occupancyService: svc,
}));

import { AccountsOccupancySection } from "@/components/admin/accounts-occupancy-section";

type Types = Partial<Record<"BOOKING" | "CONTRACT" | "CLASS" | "EVENT", number>>;
const cell = (open: number, byType: Types) => {
  const t = { BOOKING: 0, CONTRACT: 0, CLASS: 0, EVENT: 0, ...byType };
  const occupied = t.BOOKING + t.CONTRACT + t.CLASS + t.EVENT;
  return { openMinutes: open, occupiedMinutes: occupied, pct: open ? Math.round((occupied / open) * 1000) / 10 : 0, byType: t };
};

const occupancy = () => ({
  from: "2026-11-01",
  to: "2026-11-30",
  totals: cell(1000, { BOOKING: 200, CONTRACT: 100, CLASS: 50, EVENT: 50 }),
  byCourt: [
    { courtId: "c1", name: "Pista Central", ...cell(600, { BOOKING: 300 }) },
    { courtId: "c2", name: "Pista 2", ...cell(400, { CLASS: 100 }) },
  ],
  byBand: {
    WEEKDAY_MORNING: cell(300, { BOOKING: 30 }),
    WEEKDAY_AFTERNOON: cell(500, { BOOKING: 250 }),
    WEEKEND: cell(200, {}),
  },
  byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, ...(hour === 10 ? cell(120, { BOOKING: 60 }) : cell(0, {})) })),
  byWeekday: Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, ...cell(i === 0 ? 100 : 0, i === 0 ? { BOOKING: 25 } : {}) })),
});

const side = (pct: number, price: number | null, perDay: number | null) => {
  const m = { pct, openMinutes: 100, occupiedMinutes: pct, bookedHours: 1, openDays: 7, avgPricePerHourCents: price, bookedPerOpenDayCents: perDay };
  return { from: "2026-10-01", to: "2026-10-28", days: 28, total: m, byBand: { WEEKDAY_MORNING: m, WEEKDAY_AFTERNOON: m, WEEKEND: m } };
};

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AccountsOccupancySection clubId="club-1" />
    </QueryClientProvider>,
  );
}

describe("AccountsOccupancySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-30T10:00:00Z") });
    svc.get.mockResolvedValue(occupancy());
  });
  afterEach(() => vi.useRealTimers());

  it("pide el último mes, que acaba hoy, y enseña total y tipos", async () => {
    renderSection();
    const total = await screen.findByRole("region", { name: "Ocupación total" });
    expect(svc.get).toHaveBeenCalledWith("club-1", "2026-11-01", "2026-11-30");
    expect(within(total).getByText("40 %")).toBeInTheDocument();
    expect(within(total).getByText(/6 h 40 min de 16 h 40 min abiertas/)).toBeInTheDocument();
    expect(within(total).getAllByText("Reservas")).toHaveLength(2);
    expect(within(total).getByText("20 %")).toBeInTheDocument();
    expect(within(total).getAllByText("Contrato de pistas")).toHaveLength(2);
  });

  it("desglosa por pista, franja, hora (solo las abiertas) y día", async () => {
    renderSection();
    const byCourt = await screen.findByRole("region", { name: "Por pista" });
    expect(within(byCourt).getByText("Pista Central")).toBeInTheDocument();
    expect(within(byCourt).getByText("Pista 2")).toBeInTheDocument();
    expect(within(byCourt).getByRole("img", { name: "Pista Central: 50 % ocupado" })).toBeInTheDocument();
    const byBand = screen.getByRole("region", { name: "Por franja" });
    expect(within(byBand).getByText("Fin de semana y festivos")).toBeInTheDocument();
    const byHour = screen.getByRole("region", { name: "Por hora" });
    expect(within(byHour).getAllByRole("listitem")).toHaveLength(1);
    expect(within(byHour).getByText("10:00")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Por día de la semana" })).getByText("Lunes")).toBeInTheDocument();
  });

  it("el último trimestre pide 90 días", async () => {
    renderSection();
    await screen.findByRole("region", { name: "Ocupación total" });
    fireEvent.click(screen.getByRole("button", { name: "Último trimestre" }));
    await waitFor(() => expect(svc.get).toHaveBeenLastCalledWith("club-1", "2026-09-02", "2026-11-30"));
  });

  it("con fechas a mano valida el rango y no pide nada mientras falle", async () => {
    renderSection();
    await screen.findByRole("region", { name: "Ocupación total" });
    svc.get.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Fechas" }));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-12-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-01" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/anterior/);
    expect(svc.get).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-12-31" } });
    await waitFor(() => expect(svc.get).toHaveBeenCalledWith("club-1", "2026-12-01", "2026-12-31"));
  });

  it("muestra un error con reintento si falla la carga", async () => {
    svc.get.mockRejectedValue(new Error("boom"));
    renderSection();
    expect(await screen.findByText("No se pudo cargar la ocupación")).toBeInTheDocument();
  });

  describe("efecto de un cambio de precios", () => {
    it("no pide nada hasta que se elige la fecha y enseña antes y después", async () => {
      svc.priceChange.mockResolvedValue({
        date: "2026-10-28",
        before: side(30, 2000, 5000),
        after: side(45, 2400, null),
        afterDays: 28,
        lowData: false,
      });
      renderSection();
      await screen.findByRole("region", { name: "Ocupación total" });
      expect(svc.priceChange).not.toHaveBeenCalled();
      fireEvent.change(screen.getByLabelText("Fecha del cambio de precios"), { target: { value: "2026-10-28" } });
      const block = await screen.findByRole("region", { name: "Efecto de un cambio de precios" });
      await within(block).findByText("Total");
      expect(svc.priceChange).toHaveBeenCalledWith("club-1", "2026-10-28");
      expect(within(block).getAllByText("30 %").length).toBeGreaterThan(0);
      expect(within(block).getAllByText("45 %").length).toBeGreaterThan(0);
      expect(within(block).getAllByText("20,00 €").length).toBeGreaterThan(0);
      expect(within(block).getAllByText("24,00 €").length).toBeGreaterThan(0);
      // Sin datos de reservado por día: raya
      expect(within(block).getAllByText("—").length).toBeGreaterThan(0);
      expect(within(block).queryByText(/Pocos datos/)).not.toBeInTheDocument();
    });

    it("avisa «Pocos datos: menos de 7 días» con lowData", async () => {
      svc.priceChange.mockResolvedValue({
        date: "2026-11-27",
        before: side(30, 2000, 5000),
        after: side(10, null, null),
        afterDays: 4,
        lowData: true,
      });
      renderSection();
      await screen.findByRole("region", { name: "Ocupación total" });
      fireEvent.change(screen.getByLabelText("Fecha del cambio de precios"), { target: { value: "2026-11-27" } });
      expect(await screen.findByText(/Pocos datos: menos de 7 días/)).toBeInTheDocument();
    });

    it("una fecha futura dice que aún no hay después", async () => {
      svc.priceChange.mockResolvedValue({
        date: "2026-12-05",
        before: side(30, 2000, 5000),
        after: null,
        afterDays: 0,
        lowData: true,
      });
      renderSection();
      await screen.findByRole("region", { name: "Ocupación total" });
      fireEvent.change(screen.getByLabelText("Fecha del cambio de precios"), { target: { value: "2026-12-05" } });
      expect(await screen.findByText(/todavía no ha llegado/)).toBeInTheDocument();
    });
  });
});
