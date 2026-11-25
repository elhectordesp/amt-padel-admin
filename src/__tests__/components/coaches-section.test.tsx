/**
 * «Entrenadores» (F8-C2): horas, devengado, pagado y deuda por mes; «Toca
 * pagar» y «Falta la tarifa»; pagar con lo que se debe ya puesto; detalle con
 * «Deshacer pago»; horas a mano y tarifas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
const coaches = vi.hoisted(() => ({
  overview: vi.fn(),
  detail: vi.fn(),
  pay: vi.fn(),
  rates: { list: vi.fn(), save: vi.fn(), remove: vi.fn() },
  extraHours: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/coaches", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/coaches")>()),
  coachesService: coaches,
}));
const ledger = vi.hoisted(() => ({ entries: { remove: vi.fn() } }));
vi.mock("@/lib/services/ledger", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/ledger")>()),
  ledgerService: ledger,
}));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: { partners: { list: vi.fn().mockResolvedValue([]) } },
}));

import { CoachesSection } from "@/components/admin/coaches-section";
import { toast } from "sonner";

const coach = (extra: Record<string, unknown> = {}) => ({
  coachStaffId: "c1", userId: "u1", name: "Marta", groupMinutes: 150, privateMinutes: 60, extraMinutes: 0,
  accruedCents: 6500, paidCents: 2000, owedCents: 4500, previousOwedCents: 0, missingRate: false, payDue: false, leftAt: null,
  ...extra,
});
const overview = (list: unknown[]) => ({
  month: "2026-11", coaches: list,
  totals: { accruedCents: 6500, paidCents: 2000, owedCents: 4500, previousOwedCents: 0 },
});

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <CoachesSection clubId="c1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  coaches.overview.mockResolvedValue(overview([coach()]));
  coaches.rates.list.mockResolvedValue([]);
  coaches.extraHours.list.mockResolvedValue([]);
});

describe("lista", () => {
  it("enseña horas, devengado, pagado y lo que debe", async () => {
    renderSection();
    expect(await screen.findByText("Marta")).toBeInTheDocument();
    expect(screen.getByText(/Grupo 2 h 30 min · Privadas 1 h · A mano 0 min/)).toBeInTheDocument();
    expect(screen.getByText(/Devengado 65,00 € · Pagado 20,00 €/)).toBeInTheDocument();
    expect(screen.getByText("Debe 45,00 €")).toBeInTheDocument();
  });

  it("«Toca pagar», «Falta la tarifa» y lo de meses anteriores", async () => {
    coaches.overview.mockResolvedValue(overview([coach({ payDue: true, missingRate: true, previousOwedCents: 1200 })]));
    renderSection();
    expect(await screen.findByText("Toca pagar")).toBeInTheDocument();
    // Aparece en la etiqueta y en el aviso de tarifas
    expect(screen.getAllByText(/Falta la tarifa/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("De meses anteriores: 12,00 €")).toBeInTheDocument();
  });

  it("«De baja» solo junto a quien tiene fecha de baja", async () => {
    coaches.overview.mockResolvedValue(overview([
      coach(),
      coach({ coachStaffId: "c2", name: "Raúl", leftAt: "2026-11-10T09:00:00.000Z" }),
    ]));
    renderSection();
    const raul = (await screen.findByText("Raúl")).closest("li")!;
    expect(within(raul).getByText("De baja")).toBeInTheDocument();
    expect(within(screen.getByText("Marta").closest("li")!).queryByText("De baja")).not.toBeInTheDocument();
  });

  it("sin entrenadores lo dice", async () => {
    coaches.overview.mockResolvedValue(overview([]));
    renderSection();
    expect(await screen.findByText(/No hay entrenadores en el equipo/)).toBeInTheDocument();
  });

  it("un saldo a favor se dice a su favor", async () => {
    coaches.overview.mockResolvedValue(overview([coach({ owedCents: -500 })]));
    renderSection();
    expect(await screen.findByText("Debe 5,00 € a su favor")).toBeInTheDocument();
  });
});

describe("pagar", () => {
  it("lleva ya puesto lo que se debe y manda el mes, el importe y el método", async () => {
    coaches.pay.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Pagar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Importe")).toHaveValue("45,00");
    fireEvent.click(within(dialog).getByRole("button", { name: "Caja" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar el pago" }));
    await waitFor(() => expect(coaches.pay).toHaveBeenCalled());
    const [club, id, body] = coaches.pay.mock.calls[0];
    expect([club, id]).toEqual(["c1", "c1"]);
    expect(body).toMatchObject({ amountCents: 4500, payment: "CASH", partnerId: null });
    expect(body.month).toMatch(/^\d{4}-\d{2}$/);
    expect(toast.success).toHaveBeenCalledWith("Pago a Marta apuntado");
  });

  it("pagar más de lo que se debe avisa, pero se puede", async () => {
    coaches.pay.mockResolvedValue({});
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Pagar/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("note")).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "60" } });
    expect(within(dialog).getByRole("note")).toHaveTextContent(/más de lo que se le debe/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar el pago" }));
    await waitFor(() => expect(coaches.pay).toHaveBeenCalled());
    expect(coaches.pay.mock.calls[0][2].amountCents).toBe(6000);
  });

  it("sin importe válido no manda nada", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Pagar/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "abc" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar el pago" }));
    expect(await within(dialog).findByText(/importe válido/)).toBeInTheDocument();
    expect(coaches.pay).not.toHaveBeenCalled();
  });
});

describe("detalle", () => {
  it("lista las clases con su tarifa y deshace un pago borrando el apunte", async () => {
    coaches.detail.mockResolvedValue({
      items: [
        { date: "2026-11-10", kind: "GROUP", label: "Infantil", minutes: 60, hourlyCents: 1500, cents: 1500, missingRate: false },
        { date: "2026-11-12", kind: "PRIVATE", label: "Clase privada", minutes: 60, hourlyCents: 0, cents: 0, missingRate: true },
      ],
      payments: [{ id: "p1", date: "2026-11-15", amountCents: 2000, payment: "BANK" }],
    });
    ledger.entries.remove.mockResolvedValue(undefined);
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Detalle" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Infantil/)).toBeInTheDocument();
    expect(within(dialog).getByText("15,00 € (15,00 €/h)")).toBeInTheDocument();
    expect(within(dialog).getByText("Falta la tarifa")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Deshacer pago" }));
    const confirm = (await screen.findAllByRole("dialog")).at(-1)!;
    fireEvent.click(within(confirm).getByRole("button", { name: "Deshacer pago" }));
    await waitFor(() => expect(ledger.entries.remove).toHaveBeenCalledWith("c1", "p1"));
  });
});

describe("horas a mano y tarifas", () => {
  it("apunta horas a mano de un entrenador", async () => {
    coaches.extraHours.create.mockResolvedValue({});
    renderSection();
    await screen.findByText("Marta");
    fireEvent.click(screen.getByRole("button", { name: /Añadir horas a mano/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Horas"), { target: { value: "1,5" } });
    fireEvent.change(within(dialog).getByLabelText("Nota"), { target: { value: "Sustitución" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(coaches.extraHours.create).toHaveBeenCalled());
    expect(coaches.extraHours.create.mock.calls[0][1]).toMatchObject({
      coachStaffId: "c1", minutes: 90, note: "Sustitución",
    });
  });

  it("quien está de baja no admite días desde su baja: tope en el día anterior y no guarda uno posterior", async () => {
    coaches.overview.mockResolvedValue(overview([coach({ leftAt: "2026-11-10T09:00:00.000Z" })]));
    coaches.extraHours.create.mockResolvedValue({});
    renderSection();
    await screen.findByText("Marta");
    fireEvent.click(screen.getByRole("button", { name: /Añadir horas a mano/ }));
    const dialog = await screen.findByRole("dialog");
    const day = within(dialog).getByLabelText("Día");
    expect(day).toHaveAttribute("max", "2026-11-09");
    expect(day).toHaveValue("2026-11-09");
    expect(within(dialog).getByRole("note")).toHaveTextContent(/Está de baja/);
    fireEvent.change(day, { target: { value: "2026-11-12" } });
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(day, { target: { value: "2026-11-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(coaches.extraHours.create).toHaveBeenCalled());
    expect(coaches.extraHours.create.mock.calls[0][1]).toMatchObject({ coachStaffId: "c1", date: "2026-11-05" });
  });

  it("quien sigue en el equipo no lleva tope de día", async () => {
    renderSection();
    await screen.findByText("Marta");
    fireEvent.click(screen.getByRole("button", { name: /Añadir horas a mano/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Día")).not.toHaveAttribute("max");
    expect(within(dialog).queryByRole("note")).not.toBeInTheDocument();
  });

  it("guarda la tarifa del club (sin entrenador) con su fecha", async () => {
    coaches.rates.save.mockResolvedValue({});
    renderSection();
    await screen.findByText("Marta");
    fireEvent.change(await screen.findByLabelText("€ por hora"), { target: { value: "18" } });
    fireEvent.change(screen.getByLabelText("Vale desde"), { target: { value: "2026-11-16" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar tarifa" }));
    await waitFor(() => expect(coaches.rates.save).toHaveBeenCalled());
    expect(coaches.rates.save.mock.calls[0][1]).toEqual({ coachStaffId: null, validFrom: "2026-11-16", hourlyCents: 1800 });
  });

  it("enseña el histórico del club y las propias", async () => {
    coaches.rates.list.mockResolvedValue([
      { id: "r1", coachStaffId: null, coachName: null, validFrom: "2026-11-16", hourlyCents: 2000 },
      { id: "r2", coachStaffId: "c1", coachName: "Marta", validFrom: "2026-01-01", hourlyCents: 3000 },
    ]);
    renderSection();
    expect(await screen.findByText(/Marta: desde el/)).toBeInTheDocument();
    expect(screen.getByText(/20,00 €\/h/)).toBeInTheDocument();
  });
});
