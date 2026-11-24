/**
 * /caja: la caja del día (totales por método y movimientos) y lo pendiente de
 * cobro por persona, con el cobro que guarda método e importe.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
const setVoucherPayment = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/club-vouchers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-vouchers")>()),
  clubVouchersService: { setPayment: setVoucherPayment },
}));
const markPaid = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/bookings", () => ({ bookingsService: { bookings: { markPaid } } }));
const updatePayment = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/admin", () => ({ adminService: { registrations: { updatePayment } } }));
const school = vi.hoisted(() => ({ feeCollect: vi.fn(), classPay: vi.fn(), classVouchers: vi.fn() }));
vi.mock("@/lib/services/school-billing", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school-billing")>();
  return {
    ...actual,
    schoolBillingService: {
      ...actual.schoolBillingService,
      fees: { ...actual.schoolBillingService.fees, collect: school.feeCollect },
      privateClasses: { ...actual.schoolBillingService.privateClasses, pay: school.classPay, vouchers: school.classVouchers },
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CajaPage from "../../../app/(admin)/caja/page";
import { ME_QUERY_KEY } from "@/lib/use-me";

const asRole = (role: string) => ({
  id: "staff", name: "Equipo", activeClubId: "club-1",
  clubs: [{ clubId: "club-1", clubName: "Club Centro", roles: [role] }],
});

// me: la cuenta del equipo con sus roles en el club (en la caché, como la deja el panel al entrar)
function renderPage(me?: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (me) qc.setQueryData(ME_QUERY_KEY, me);
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

  it("pendiente de cobro con un rol sin escritura en caja ni reservas (Entrenador): ve lo que se debe, sin «Cobrar»", async () => {
    renderPage(asRole("COACH"));
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    expect(await screen.findByText("Reserva Pista 2")).toBeInTheDocument();
    expect(screen.getByText("Inscripción Open")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
  });

  it("pendiente de cobro con Recepción: un «Cobrar» por cada deuda", async () => {
    renderPage(asRole("RECEPTION"));
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    await screen.findByText("Reserva Pista 2");
    expect(screen.getAllByRole("button", { name: /Cobrar/ })).toHaveLength(2);
  });

  describe("escuela", () => {
    const SCHOOL_DEBTS = {
      totalCents: 7500,
      people: [
        {
          key: "customer:cc9", name: "Marta", userId: null, customerId: "cc9", totalCents: 7500,
          items: [
            { source: "SCHOOL_FEE", refId: "f9", concept: "Cuota Iniciación · 2026-11", date: "2026-10-31T23:00:00.000Z", amountCents: 4500 },
            { source: "PRIVATE_CLASS", refId: "st9", concept: "Clase privada Pista 2", date: "2026-11-09T16:00:00.000Z", amountCents: 3000, privateClassId: "pc9" },
          ],
        },
      ],
    };

    beforeEach(() => {
      cashMock.debts.mockResolvedValue(SCHOOL_DEBTS);
      school.feeCollect.mockResolvedValue([]);
      school.classPay.mockResolvedValue({});
      school.classVouchers.mockResolvedValue([]);
    });

    it("las cuotas y las clases privadas sin cobrar salen en lo pendiente de su persona", async () => {
      renderPage();
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      expect(await screen.findByText("Cuota Iniciación · 2026-11")).toBeInTheDocument();
      expect(screen.getByText("Clase privada Pista 2")).toBeInTheDocument();
      expect(screen.getAllByText(/75,00/).length).toBeGreaterThan(0);
    });

    it("la caja del día enseña lo cobrado en la escuela, con bono a 0", async () => {
      cashMock.day.mockResolvedValue({
        ...DAY,
        movements: [
          { source: "SCHOOL_FEE", refId: "f1", at: "2026-11-10T09:30:00.000Z", concept: "Cuota Iniciación · 2026-11", person: "Marta", method: "CASH", amountCents: 4500 },
          { source: "PRIVATE_CLASS", refId: "st1", at: "2026-11-10T10:00:00.000Z", concept: "Clase privada · 2026-11-10 17:00", person: "Pablo", method: "VOUCHER", amountCents: 0 },
        ],
        totalsByMethod: { CASH: 4500, VOUCHER: 0 },
        totalCents: 4500,
      });
      renderPage();
      expect(await screen.findByText("Cuota Iniciación · 2026-11")).toBeInTheDocument();
      const row = screen.getByText("Clase privada · 2026-11-10 17:00").closest("tr") as HTMLElement;
      // Pagada con bono: método «Bono» e importe 0 (el dinero entró con la venta del bono)
      expect(within(row).getByText("Bono")).toBeInTheDocument();
      expect(row).toHaveTextContent("0,00");
      expect(screen.getByText("Total del día").nextElementSibling).toHaveTextContent("45,00");
    });

    it("D3: un bono vendido sin cobrar sale en lo pendiente y se cobra con su método", async () => {
      cashMock.debts.mockResolvedValue({
        totalCents: 9000,
        people: [{
          key: "customer:cc9", name: "Marta", userId: null, customerId: "cc9", totalCents: 9000,
          items: [{ source: "VOUCHER", refId: "v9", concept: "Bono Bono 10", date: "2026-11-01T10:00:00.000Z", amountCents: 9000 }],
        }],
      });
      setVoucherPayment.mockResolvedValue({});
      renderPage();
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Bono Bono 10");
      fireEvent.click(screen.getByRole("button", { name: /Cobrar/ }));
      const dialog = await screen.findByRole("dialog", { name: "Cobrar bono" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Tarjeta" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
      await waitFor(() => expect(setVoucherPayment).toHaveBeenCalledWith("club-1", "v9", "CARD"));
    });

    it("cobrar una cuota: lo que falta por defecto, en el servicio de la escuela y con el alumno de la persona", async () => {
      renderPage();
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Cuota Iniciación · 2026-11");
      fireEvent.click(screen.getAllByRole("button", { name: /Cobrar/ })[0]);
      const dialog = await screen.findByRole("dialog", { name: "Cobrar cuota" });
      expect(within(dialog).getByLabelText("Importe cobrado")).toHaveValue("45,00");
      fireEvent.click(within(dialog).getByRole("button", { name: "Efectivo" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
      await waitFor(() =>
        expect(school.feeCollect).toHaveBeenCalledWith("club-1", {
          clubCustomerId: "cc9", amountCents: 4500, paymentMethod: "CASH", feeIds: ["f9"],
        }),
      );
      expect(markPaid).not.toHaveBeenCalled();
      expect(updatePayment).not.toHaveBeenCalled();
    });

    it("cobrar una parte de una cuota: el importe se puede bajar y no pasar de lo que falta", async () => {
      renderPage();
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Cuota Iniciación · 2026-11");
      fireEvent.click(screen.getAllByRole("button", { name: /Cobrar/ })[0]);
      const dialog = await screen.findByRole("dialog", { name: "Cobrar cuota" });
      const amount = within(dialog).getByLabelText("Importe cobrado");
      fireEvent.click(within(dialog).getByRole("button", { name: "Tarjeta" }));
      fireEvent.change(amount, { target: { value: "46" } });
      expect(within(dialog).getByRole("button", { name: "Cobrar" })).toBeDisabled();
      fireEvent.change(amount, { target: { value: "10" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
      await waitFor(() =>
        expect(school.feeCollect).toHaveBeenCalledWith("club-1", {
          clubCustomerId: "cc9", amountCents: 1000, paymentMethod: "CARD", feeIds: ["f9"],
        }),
      );
    });

    it("cobrar a un alumno de una clase privada: con su clase y su alumno, en el servicio de la escuela", async () => {
      renderPage();
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Clase privada Pista 2");
      fireEvent.click(screen.getAllByRole("button", { name: /Cobrar/ })[1]);
      const dialog = await screen.findByRole("dialog", { name: "Cobrar clase privada" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Tarjeta" }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Cobrar" }));
      await waitFor(() =>
        expect(school.classPay).toHaveBeenCalledWith("club-1", "pc9", "st9", { paymentMethod: "CARD" }),
      );
      expect(markPaid).not.toHaveBeenCalled();
    });

    it("el cobro de la escuela es del área «school»: la Recepción (con escritura) cobra las dos", async () => {
      renderPage(asRole("RECEPTION"));
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Cuota Iniciación · 2026-11");
      expect(screen.getAllByRole("button", { name: /Cobrar/ })).toHaveLength(2);
    });

    it("un rol sin la escuela (Torneos) ve lo que se debe sin «Cobrar»", async () => {
      renderPage(asRole("TOURNAMENTS"));
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Cuota Iniciación · 2026-11");
      expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
    });

    it("un entrenador (lee la escuela, no la escribe) ve lo que se debe sin «Cobrar»", async () => {
      renderPage(asRole("COACH"));
      fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
      await screen.findByText("Cuota Iniciación · 2026-11");
      expect(screen.queryByRole("button", { name: /Cobrar/ })).not.toBeInTheDocument();
    });
  });

  it("nadie debe nada: lo dice", async () => {
    cashMock.debts.mockResolvedValue({ people: [], totalCents: 0 });
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Pendiente de cobro" }));
    expect(await screen.findByText("Nadie debe nada al club.")).toBeInTheDocument();
  });
});
