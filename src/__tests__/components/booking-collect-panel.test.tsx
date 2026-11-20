/**
 * La «hoja de papel» del club para cobrar una reserva (módulo Cuentas, M1):
 * «Cobrar todo» con sus cinco botones, el reparto por jugadores, los atajos,
 * el aviso de alumno, el Bizum con su receptor y los totales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const parts = vi.hoisted(() => ({
  view: vi.fn(), split: vi.fn(), removeAll: vi.fn(), update: vi.fn(), pay: vi.fn(),
  invite: vi.fn(), debt: vi.fn(), undo: vi.fn(), refund: vi.fn(),
}));
vi.mock("@/lib/services/booking-parts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/booking-parts")>()),
  bookingPartsService: parts,
}));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
const markPaid = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/bookings", () => ({ bookingsService: { bookings: { markPaid } } }));

import { BookingCollectPanel } from "@/components/admin/booking-collect-panel";
import { toast } from "sonner";
import type { Booking } from "@/types/bookings";
import type { BookingPart, BookingPartsView } from "@/lib/services/booking-parts";

const part = (n: number, patch: Partial<BookingPart> = {}): BookingPart => ({
  id: `p${n}`, position: n, kind: "NORMAL", partPriceId: null, partPriceName: null, priceCents: 500, reason: null,
  status: "PENDING", clubCustomerId: null, customerName: null, label: null, isStudent: false, isMember: false,
  paymentMethod: null, bizumPartnerId: null, bizumPartnerName: null, paidAt: null, paidByName: null,
  refundedAt: null, refundAmountCents: null, debtId: null, debtStatus: null, ...patch,
});

const TOTALS = { partsCents: 2000, discountCents: 0, collectedCents: 0, pendingCents: 2000, debtCents: 0, invitedCents: 0 };

const view = (patch: Partial<BookingPartsView> = {}): BookingPartsView => ({
  bookingId: "b1", priceCents: 2000, courtType: "DOUBLES", defaultCount: 4, status: "CONFIRMED",
  startsAt: "2026-11-21T09:00:00.000Z",
  parts: [part(1), part(2), part(3), part(4)],
  totals: TOTALS,
  priceOptions: [{ partPriceId: "pp-alumno", name: "Alumno", kind: "STUDENT", perCourt: false, priceCents: 350 }],
  member: { discountPercent: 10, offered: true },
  ...patch,
});

const BOOKING = { id: "b1", shortCode: "AMT-1", priceCents: 2000, court: { name: "Pista 1" }, partsSummary: null } as unknown as Booking;
const WITH_PARTS = { ...BOOKING, partsSummary: { count: 4, paid: 0, pending: 4, debt: 0, invited: 0 } } as unknown as Booking;

const onChanged = vi.fn();

function renderPanel(booking: Booking = WITH_PARTS, accountsOn = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BookingCollectPanel clubId="c1" booking={booking} accountsOn={accountsOn} onChanged={onChanged} />
    </QueryClientProvider>,
  );
}

const row = (n: number) => screen.getByRole("listitem", { name: `Parte ${n}` });

describe("BookingCollectPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parts.view.mockResolvedValue(view());
    parts.pay.mockImplementation(async () => view());
    parts.update.mockImplementation(async () => view());
    parts.split.mockImplementation(async () => view());
    parts.debt.mockImplementation(async () => view());
    parts.invite.mockImplementation(async () => view());
    parts.undo.mockImplementation(async () => view());
    parts.removeAll.mockImplementation(async () => view({ parts: [] }));
    accounts.partners.list.mockResolvedValue([
      { id: "s1", name: "Marta", active: true },
      { id: "s2", name: "Antiguo", active: false },
    ]);
    markPaid.mockResolvedValue({ id: "b1" });
  });

  it("con partes, enseña una fila por parte y los totales de la reserva", async () => {
    parts.view.mockResolvedValue(view({
      totals: { partsCents: 1800, discountCents: 200, collectedCents: 500, pendingCents: 1000, debtCents: 200, invitedCents: 100 },
    }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const totals = screen.getByLabelText("Totales de la reserva");
    expect(within(totals).getByText("Precio de la reserva").nextSibling).toHaveTextContent("20,00 €");
    expect(within(totals).getByText("Suma de las partes").nextSibling).toHaveTextContent("18,00 €");
    expect(within(totals).getByText("Descuento").nextSibling).toHaveTextContent("2,00 €");
    expect(within(totals).getByText("Cobrado").nextSibling).toHaveTextContent("5,00 €");
    expect(within(totals).getByText("Pendiente").nextSibling).toHaveTextContent("10,00 €");
    expect(within(totals).getByText("A deber").nextSibling).toHaveTextContent("2,00 €");
    expect(within(totals).getByText("Invitado").nextSibling).toHaveTextContent("1,00 €");
  });

  it("«Todos efectivo» y «Todos tarjeta» cobran todas las pendientes de golpe", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(screen.getByRole("button", { name: "Todos efectivo" }));
    await waitFor(() => expect(parts.pay).toHaveBeenCalledWith("c1", "b1", { method: "CASH" }));
    fireEvent.click(screen.getByRole("button", { name: "Todos tarjeta" }));
    await waitFor(() => expect(parts.pay).toHaveBeenCalledWith("c1", "b1", { method: "CARD" }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("sin nada pendiente, los atajos no se pueden pulsar", async () => {
    parts.view.mockResolvedValue(view({ parts: [part(1, { status: "PAID", paymentMethod: "CASH" })] }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    expect(screen.getByRole("button", { name: "Todos efectivo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Todos tarjeta" })).toBeDisabled();
  });

  it("efectivo en una parte cobra solo esa parte", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 2" });
    fireEvent.click(within(row(2)).getByRole("button", { name: "Efectivo" }));
    await waitFor(() => expect(parts.pay).toHaveBeenCalledWith("c1", "b1", { partIds: ["p2"], method: "CASH" }));
  });

  it("Bizum en una parte pregunta a qué móvil llegó (socios activos y «Club») y lo manda", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(within(row(1)).getByRole("button", { name: "Bizum" }));
    const dialog = await screen.findByRole("dialog", { name: "Bizum" });
    expect(within(dialog).getByRole("button", { name: "Marta" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Antiguo" })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Marta" }));
    await waitFor(() =>
      expect(parts.pay).toHaveBeenCalledWith("c1", "b1", { partIds: ["p1"], method: "BIZUM", bizumPartnerId: "s1" }),
    );
  });

  it("Bizum al «Club» manda null como receptor", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(within(row(1)).getByRole("button", { name: "Bizum" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Bizum" })).getByRole("button", { name: "Club" }));
    await waitFor(() =>
      expect(parts.pay).toHaveBeenCalledWith("c1", "b1", { partIds: ["p1"], method: "BIZUM", bizumPartnerId: null }),
    );
  });

  it("una parte de un alumno avisa y, con un toque, aplica el precio de alumno", async () => {
    parts.view.mockResolvedValue(view({ parts: [part(1, { isStudent: true, customerName: "Lucía" }), part(2)] }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    expect(within(row(2)).queryByText(/Es alumno de la escuela/)).not.toBeInTheDocument();
    expect(within(row(1)).getByText(/Es alumno de la escuela/)).toBeInTheDocument();
    fireEvent.click(within(row(1)).getByRole("button", { name: /Aplicar precio de alumno \(3,50 €\)/ }));
    await waitFor(() =>
      expect(parts.update).toHaveBeenCalledWith("c1", "b1", "p1", { kind: "SPECIAL", partPriceId: "pp-alumno" }),
    );
  });

  it("el precio Socio solo se ofrece si el back lo ofrece", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    expect(within(row(1)).getByRole("option", { name: /Socio \(−10 %\)/ })).toBeInTheDocument();
    expect(within(row(1)).getByRole("option", { name: /Alumno · 3,50 €/ })).toBeInTheDocument();
  });

  it("«Otro precio» pide importe y motivo, y no se aplica sin motivo", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.change(within(row(1)).getByLabelText("Precio de la parte 1"), { target: { value: "custom" } });
    const apply = within(row(1)).getByRole("button", { name: "Aplicar" });
    expect(apply).toBeDisabled();
    fireEvent.change(within(row(1)).getByLabelText("Importe del otro precio"), { target: { value: "3,25" } });
    fireEvent.change(within(row(1)).getByLabelText("Motivo del otro precio"), { target: { value: "Cuadre" } });
    fireEvent.click(apply);
    await waitFor(() =>
      expect(parts.update).toHaveBeenCalledWith("c1", "b1", "p1", { kind: "CUSTOM", priceCents: 325, reason: "Cuadre" }),
    );
  });

  it("«Debe» en una parte con nombre apunta la deuda sin preguntar", async () => {
    parts.view.mockResolvedValue(view({ parts: [part(1, { customerName: "Ana", clubCustomerId: "cc1" })] }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(within(row(1)).getByRole("button", { name: "Debe" }));
    await waitFor(() => expect(parts.debt).toHaveBeenCalledWith("c1", "b1", "p1", {}));
  });

  it("«Debe» en una parte sin nadie pide quién debe", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(within(row(1)).getByRole("button", { name: "Debe" }));
    expect(parts.debt).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "¿Quién debe esta parte?" });
    const confirm = within(dialog).getByRole("button", { name: "Apuntar la deuda" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Nombre de quien debe"), { target: { value: "Pepe" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(parts.debt).toHaveBeenCalledWith("c1", "b1", "p1", { personName: "Pepe" }));
  });

  it("«Invitado» pide el motivo (3 caracteres como mínimo)", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(within(row(1)).getByRole("button", { name: "Invitado" }));
    const confirm = await screen.findByRole("button", { name: "Marcar como invitada" });
    fireEvent.change(screen.getByLabelText("Motivo de la invitación"), { target: { value: "ab" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de la invitación"), { target: { value: "Cumpleaños" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(parts.invite).toHaveBeenCalledWith("c1", "b1", "p1", "Cumpleaños"));
  });

  it("deshacer una parte cobrada pide confirmación antes", async () => {
    parts.view.mockResolvedValue(view({
      parts: [part(1, { status: "PAID", paymentMethod: "BIZUM", bizumPartnerName: "Marta", paidByName: "Recepción" })],
    }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    expect(within(row(1)).getByText(/Bizum a Marta/)).toBeInTheDocument();
    fireEvent.click(within(row(1)).getByRole("button", { name: "Deshacer" }));
    expect(parts.undo).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Sí, deshacer" }));
    await waitFor(() => expect(parts.undo).toHaveBeenCalledWith("c1", "b1", "p1"));
  });

  it("si todas están sin cobrar, se puede volver a cobrar la reserva entera (con confirmación)", async () => {
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(screen.getByRole("button", { name: "Volver a cobrar entera" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, cobrar entera" }));
    await waitFor(() => expect(parts.removeAll).toHaveBeenCalledWith("c1", "b1"));
  });

  it("con una parte ya cobrada no se ofrece volver a cobrar entera", async () => {
    parts.view.mockResolvedValue(view({ parts: [part(1, { status: "PAID", paymentMethod: "CASH" }), part(2)] }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    expect(screen.queryByRole("button", { name: "Volver a cobrar entera" })).not.toBeInTheDocument();
  });

  it("un error del back se enseña con su mensaje en castellano", async () => {
    parts.pay.mockRejectedValue(Object.assign(new Error("x"), { code: "BOOKING_PARTS_LOCKED" }));
    renderPanel();
    await screen.findByRole("listitem", { name: "Parte 1" });
    fireEvent.click(within(row(1)).getByRole("button", { name: "Tarjeta" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Deshazla primero/)));
  });

  describe("con el módulo apagado y partes ya creadas", () => {
    it("la hoja sigue ahí y se puede cobrar, pero no repartir de nuevo ni pedir socios", async () => {
      renderPanel(WITH_PARTS, false);
      await screen.findByRole("listitem", { name: "Parte 1" });
      expect(screen.getByRole("tab", { name: "Por jugadores" })).toHaveAttribute("aria-selected", "true");
      expect(screen.queryByLabelText("Número de partes")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cambiar el reparto" })).not.toBeInTheDocument();
      expect(accounts.partners.list).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Todos efectivo" }));
      await waitFor(() => expect(parts.pay).toHaveBeenCalledWith("c1", "b1", { method: "CASH" }));
    });

    it("quitar el reparto sigue permitido y, sin partes, ya no se ofrece «Por jugadores»", async () => {
      renderPanel(WITH_PARTS, false);
      await screen.findByRole("listitem", { name: "Parte 1" });
      parts.view.mockResolvedValue(view({ parts: [], totals: { ...TOTALS, partsCents: 0, pendingCents: 0 } }));
      fireEvent.click(screen.getByRole("button", { name: "Volver a cobrar entera" }));
      fireEvent.click(await screen.findByRole("button", { name: "Sí, cobrar entera" }));
      await waitFor(() => expect(parts.removeAll).toHaveBeenCalledWith("c1", "b1"));
      await waitFor(() => expect(screen.queryByRole("tab", { name: "Por jugadores" })).not.toBeInTheDocument());
      expect(screen.getByRole("tab", { name: "Cobrar todo" })).toBeInTheDocument();
    });
  });
  describe("sin partes (cobrar todo)", () => {
    beforeEach(() => {
      parts.view.mockResolvedValue(view({ parts: [], totals: { ...TOTALS, partsCents: 0, pendingCents: 0 } }));
    });

    it("«Cobrar todo» tiene los cinco métodos y cobra la reserva entera", async () => {
      renderPanel(BOOKING);
      const all = await screen.findByRole("tab", { name: "Cobrar todo" });
      expect(all).toHaveAttribute("aria-selected", "true");
      for (const name of ["Efectivo", "Tarjeta", "Bizum", "Transferencia", "Otro"]) {
        expect(screen.getByRole("button", { name })).toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole("button", { name: "Tarjeta" }));
      await waitFor(() => expect(markPaid).toHaveBeenCalledWith("b1", { method: "CARD" }));
    });

    it("Bizum pregunta a qué móvil llegó y lo manda con el cobro", async () => {
      renderPanel(BOOKING);
      fireEvent.click(await screen.findByRole("button", { name: "Bizum" }));
      fireEvent.click(within(await screen.findByRole("dialog", { name: "Bizum" })).getByRole("button", { name: "Marta" }));
      await waitFor(() => expect(markPaid).toHaveBeenCalledWith("b1", { method: "BIZUM", bizumPartnerId: "s1" }));
    });

    it("«Por jugadores» reparte en 4 partes por defecto y se puede cambiar el número", async () => {
      renderPanel(BOOKING);
      fireEvent.click(await screen.findByRole("tab", { name: "Por jugadores" }));
      expect(screen.getByLabelText("Número de partes")).toHaveValue(4);
      fireEvent.change(screen.getByLabelText("Número de partes"), { target: { value: "3" } });
      fireEvent.click(screen.getByRole("button", { name: "Repartir por jugadores" }));
      await waitFor(() => expect(parts.split).toHaveBeenCalledWith("c1", "b1", 3));
    });

    it("no deja repartir en más de 8 ni en 0", async () => {
      renderPanel(BOOKING);
      fireEvent.click(await screen.findByRole("tab", { name: "Por jugadores" }));
      fireEvent.change(screen.getByLabelText("Número de partes"), { target: { value: "9" } });
      expect(screen.getByRole("button", { name: "Repartir por jugadores" })).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Número de partes"), { target: { value: "0" } });
      expect(screen.getByRole("button", { name: "Repartir por jugadores" })).toBeDisabled();
    });
  });
});
