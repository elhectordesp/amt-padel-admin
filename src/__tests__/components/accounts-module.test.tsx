/**
 * Módulo «Cuentas» (M1) fuera de la hoja de cobro: el interruptor de AMT, el
 * Bizum con receptor del cobro suelto, el bono ya elegido si es el único, los
 * puntos de las partes en el calendario y el menú «Cuentas».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const accounts = vi.hoisted(() => ({ setEnabled: vi.fn() }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
const vouchers = vi.hoisted(() => ({ booking: { usable: vi.fn(), use: vi.fn() } }));
vi.mock("@/lib/services/club-vouchers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-vouchers")>()),
  clubVouchersService: vouchers,
}));

import { ClubAccountsToggle } from "@/components/admin/club-accounts-toggle";
import CollectModal from "@/components/admin/collect-modal";
import { PayWithVoucherModal } from "@/components/admin/pay-with-voucher-modal";
import { ReservasDayGrid } from "@/components/admin/reservas-day-grid";
import { navForRole } from "@/components/admin/sidebar";
import { toast } from "sonner";
import type { Booking } from "@/types/bookings";
import type { Court } from "@/types";

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("interruptor del módulo (AMT)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("apagado, al pulsarlo lo enciende en ese club y lo avisa", async () => {
    accounts.setEnabled.mockResolvedValue({ accountsEnabled: true });
    withQuery(<ClubAccountsToggle clubId="club-9" enabled={false} />);
    const toggle = screen.getByRole("switch", { name: "Módulo Cuentas" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    await waitFor(() => expect(accounts.setEnabled).toHaveBeenCalledWith("club-9", true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Módulo Cuentas activado"));
  });

  it("encendido, al pulsarlo lo apaga", async () => {
    accounts.setEnabled.mockResolvedValue({ accountsEnabled: false });
    withQuery(<ClubAccountsToggle clubId="club-9" enabled />);
    const toggle = screen.getByRole("switch", { name: "Módulo Cuentas" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    await waitFor(() => expect(accounts.setEnabled).toHaveBeenCalledWith("club-9", false));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Módulo Cuentas desactivado"));
  });

  it("si el back lo rechaza, enseña el error y no dice que está hecho", async () => {
    accounts.setEnabled.mockRejectedValue(new Error("Solo AMT"));
    withQuery(<ClubAccountsToggle clubId="club-9" enabled={false} />);
    fireEvent.click(screen.getByRole("switch", { name: "Módulo Cuentas" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Solo AMT"));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("cobro de un importe con Bizum (CollectModal)", () => {
  const partners = [{ id: "s1", name: "Marta", active: true }];
  const open = (extra: object = {}) => {
    const onSubmit = vi.fn().mockResolvedValue({});
    render(
      <CollectModal title="Cobrar" subtitle="AMT-1" defaultCents={1800} onSubmit={onSubmit} onDone={vi.fn()} onClose={vi.fn()} {...extra} />,
      { wrapper: ({ children }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider> },
    );
    return onSubmit;
  };
  const save = () => {
    const buttons = screen.getByRole("dialog").querySelectorAll("button");
    return buttons[buttons.length - 1];
  };

  it("sin el módulo, Bizum se cobra como siempre, sin preguntar el móvil", async () => {
    const onSubmit = open();
    fireEvent.click(screen.getByRole("button", { name: "Bizum" }));
    expect(screen.queryByText(/¿A qué móvil llegó el Bizum\?/)).not.toBeInTheDocument();
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("BIZUM", 1800));
  });

  it("con el módulo, Bizum no se guarda sin elegir móvil y manda el socio elegido", async () => {
    const onSubmit = open({ bizumReceivers: partners });
    fireEvent.click(screen.getByRole("button", { name: "Bizum" }));
    expect(save()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Marta" }));
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("BIZUM", 1800, "s1"));
  });

  it("con el módulo, «Club» manda null; y otro método no manda receptor", async () => {
    let onSubmit = open({ bizumReceivers: partners });
    fireEvent.click(screen.getByRole("button", { name: "Bizum" }));
    fireEvent.click(screen.getByRole("button", { name: "Club" }));
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("BIZUM", 1800, null));
    document.body.innerHTML = "";
    onSubmit = open({ bizumReceivers: partners });
    fireEvent.click(screen.getByRole("button", { name: "Efectivo" }));
    fireEvent.click(save());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("CASH", 1800));
  });
});

describe("pagar con bono (F9)", () => {
  const v = (id: string, name: string) => ({
    id, name, clubId: "c1", typeId: "t", clubCustomerId: "cc1", sessions: 10, priceCents: 12000, paymentMethod: "CASH",
    paidAt: "2026-11-18T09:00:00.000Z", expiresAt: null, cancelledAt: null, refundAmountCents: null, cancelNotes: null,
    soldById: "u", createdAt: "2026-11-18T09:00:00.000Z", paid: true, usedSessions: 3, remainingSessions: 7,
    status: "ACTIVE", uses: [], kind: "COURT",
  });
  const open = () =>
    withQuery(
      <PayWithVoucherModal clubId="c1" bookingId="b1" subtitle="AMT-1" timeZone="Europe/Madrid" onDone={vi.fn()} onClose={vi.fn()} />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    vouchers.booking.use.mockResolvedValue({});
  });

  it("con un solo bono que sirve, sale ya elegido y se paga sin más", async () => {
    vouchers.booking.usable.mockResolvedValue([v("v1", "Bono 10")]);
    open();
    const radio = await screen.findByLabelText(/Bono 10/);
    expect(radio).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: /Pagar con bono/ }));
    await waitFor(() => expect(vouchers.booking.use).toHaveBeenCalledWith("c1", "b1", "v1"));
  });

  it("con varios, no elige por el gestor", async () => {
    vouchers.booking.usable.mockResolvedValue([v("v1", "Bono 10"), v("v2", "Bono 5")]);
    open();
    await screen.findByLabelText(/Bono 10/);
    expect(screen.getByLabelText(/Bono 10/)).not.toBeChecked();
    expect(screen.getByLabelText(/Bono 5/)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Pagar con bono/ })).toBeDisabled();
  });
});

describe("calendario: puntos de las partes", () => {
  const COURTS = [{ id: "p1", name: "Pista 1", active: true }] as unknown as Court[];
  const booking = (patch: object): Booking =>
    ({
      id: "b1", shortCode: "AMT-1", startsAt: "2026-11-20T09:00:00.000Z", endsAt: "2026-11-20T10:30:00.000Z",
      durationMinutes: 90, courtId: "p1", matchMode: "PRIVATE_AMT", status: "CONFIRMED", priceCents: 2000,
      paymentMethod: "PENDING", participants: [], ...patch,
    }) as unknown as Booking;
  const render_ = (bookings: Booking[]) =>
    render(
      <ReservasDayGrid date="2026-11-20" timeZone="Europe/Madrid" courts={COURTS} bookings={bookings} window={{ openTime: "09:00", closeTime: "23:00" }} />,
    );

  it("una reserva con partes lleva un punto por parte y la leyenda de colores", () => {
    render_([booking({ partsSummary: { count: 4, paid: 2, pending: 1, debt: 1, invited: 0 } })]);
    expect(screen.getAllByText("2 cobradas, 1 debe, 1 sin cobrar").length).toBeGreaterThan(0);
    const legend = screen.getByRole("list", { name: "Leyenda" });
    for (const text of ["Parte cobrada", "Parte a deber", "Parte invitada", "Parte sin cobrar"]) {
      expect(within(legend).getByText(text)).toBeInTheDocument();
    }
  });

  it("sin partes en el día, la rejilla queda como siempre: ni puntos ni leyenda de partes", () => {
    render_([booking({ partsSummary: null })]);
    expect(screen.queryByText(/Parte cobrada/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin cobrar$/)).not.toBeInTheDocument();
  });
});

describe("menú «Cuentas»", () => {
  const labels = (accountsEnabled?: boolean) =>
    navForRole("club", { can: () => true }, accountsEnabled).map((i) => i.label);

  it("sale solo con el módulo encendido", () => {
    expect(labels(true)).toContain("Cuentas");
    expect(labels(false)).not.toContain("Cuentas");
    expect(labels()).not.toContain("Cuentas");
  });

  it("solo propietario y gestor lo ven", () => {
    const only = (areas: string[]) => ({ can: (area: string) => areas.includes(area) });
    // El área «accounts» la dan propietario y gestor (lib/club-permissions); recepción no
    expect(navForRole("club", only(["accounts"]), true).map((i) => i.label)).toContain("Cuentas");
    expect(navForRole("club", only(["cash", "bookings"]), true).map((i) => i.label)).not.toContain("Cuentas");
  });
});
