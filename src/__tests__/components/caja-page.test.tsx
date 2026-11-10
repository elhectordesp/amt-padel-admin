/**
 * /caja: la caja del día (totales por método y movimientos) y lo pendiente de
 * cobro por persona, con el cobro que guarda método e importe.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "club-1" }),
  isClub: (r: string | null) => r === "club",
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));

const cashMock = vi.hoisted(() => ({ day: vi.fn(), debts: vi.fn() }));
vi.mock("@/lib/services/cash", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/cash")>()),
  cashService: cashMock,
}));
const markPaid = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/bookings", () => ({ bookingsService: { bookings: { markPaid } } }));
const updatePayment = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/admin", () => ({ adminService: { registrations: { updatePayment } } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CajaPage from "../../../app/(admin)/caja/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <CajaPage />
    </QueryClientProvider>,
  );
}

const DAY = {
  date: "2026-11-10",
  timezone: "Europe/Madrid",
  movements: [
    { source: "BOOKING", refId: "b1", at: "2026-11-10T09:30:00.000Z", concept: "Reserva Pista 1", person: "Ana", method: "CARD", amountCents: 1800 },
    { source: "REGISTRATION", refId: "r1", at: "2026-11-10T10:00:00.000Z", concept: "Inscripción Open", person: "Luis", method: "CASH", amountCents: 1000 },
  ],
  totalsByMethod: { CARD: 1800, CASH: 1000 },
  totalCents: 2800,
};

const DEBTS = {
  totalCents: 2800,
  people: [
    {
      key: "user:u1", name: "Luis", userId: "u1", customerId: null, totalCents: 2800,
      items: [
        { source: "BOOKING", refId: "b9", concept: "Reserva Pista 2", date: "2026-11-09T09:00:00.000Z", amountCents: 1800 },
        { source: "REGISTRATION", refId: "r9", concept: "Inscripción Open", date: "2026-11-14T00:00:00.000Z", amountCents: 1000, slot: "partner", playerId: "u-eva" },
      ],
    },
  ],
};

describe("CajaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cashMock.day.mockResolvedValue(DAY);
    cashMock.debts.mockResolvedValue(DEBTS);
    markPaid.mockResolvedValue({});
    updatePayment.mockResolvedValue({});
  });

  it("caja del día: totales por método, total y cada movimiento con su hora del club", async () => {
    renderPage();
    expect(await screen.findByText("Reserva Pista 1")).toBeInTheDocument();
    expect(cashMock.day).toHaveBeenCalledWith("club-1", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(screen.getAllByText("Tarjeta").length).toBeGreaterThan(0);
    expect(screen.getByText("Total del día").nextElementSibling).toHaveTextContent("28,00");
    expect(screen.getByText("10:30")).toBeInTheDocument();
  });

  it("cambiar el día pide ese día", async () => {
    renderPage();
    await screen.findByText("Reserva Pista 1");
    fireEvent.change(screen.getByLabelText("Día de la caja"), { target: { value: "2026-11-09" } });
    await waitFor(() => expect(cashMock.day).toHaveBeenCalledWith("club-1", "2026-11-09"));
  });

  it("pendiente de cobro: agrupado por persona con su total", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    expect(await screen.findByText("Luis")).toBeInTheDocument();
    expect(screen.getByText("Reserva Pista 2")).toBeInTheDocument();
    expect(screen.getAllByText(/28,00/).length).toBeGreaterThan(0);
  });

  it("cobrar una reserva: el método de la lista y el importe, en markPaid", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    await screen.findByText("Reserva Pista 2");
    fireEvent.click(screen.getAllByRole("button", { name: /Cobrar/ })[0]);
    expect(screen.getByLabelText("Importe cobrado")).toHaveValue("18,00");
    fireEvent.click(screen.getByRole("button", { name: "Bizum" }));
    fireEvent.change(screen.getByLabelText("Importe cobrado"), { target: { value: "17,50" } });
    const buttons = screen.getByRole("dialog").querySelectorAll("button");
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(markPaid).toHaveBeenCalledWith("b9", { method: "BIZUM", amountCents: 1750 }));
  });

  it("cobrar a un jugador de una inscripción: updatePayment con su lado, su id, método e importe", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    await screen.findByText("Reserva Pista 2");
    fireEvent.click(screen.getAllByRole("button", { name: /Cobrar/ })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Efectivo" }));
    const buttons = screen.getByRole("dialog").querySelectorAll("button");
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(updatePayment).toHaveBeenCalledWith("r9", {
        paid: true, paymentMethod: "CASH", paidAmountCents: 1000, player: "partner", playerId: "u-eva",
      }),
    );
  });

  it("nadie debe nada: lo dice", async () => {
    cashMock.debts.mockResolvedValue({ people: [], totalCents: 0 });
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    expect(await screen.findByText("Nadie debe nada al club.")).toBeInTheDocument();
  });
});
