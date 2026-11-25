/**
 * «Socios y reparto» de Cuentas (fase 3, S2): sin empezar, las tarjetas de los
 * socios, el disponible desglosado, la tabla de meses, «Repartir» en tres pasos
 * (importes sugeridos, resumen y confirmación) y la lista de repartos con
 * borrar; y las partes de los socios en Ajustes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const access = vi.hoisted(() => ({ write: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: (_a: string, level = "read") => (level === "write" ? access.write : true) }),
}));
const tre = vi.hoisted(() => ({ summary: vi.fn(), statement: vi.fn() }));
vi.mock("@/lib/services/treasury", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/treasury")>()),
  treasuryService: { ...tre, transfers: { create: vi.fn() }, counts: {} },
}));
const prof = vi.hoisted(() => ({
  summary: vi.fn(),
  shares: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
  partnerShares: { get: vi.fn(), set: vi.fn() },
}));
vi.mock("@/lib/services/profit", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/profit")>()),
  profitService: prof,
}));
const acc = vi.hoisted(() => ({ partners: vi.fn() }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: { partners: { list: acc.partners } },
}));
vi.mock("@/lib/use-club-time-zone", () => ({ useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }) }));

import { AccountsProfitSection } from "@/components/admin/accounts-profit-section";
import { AccountsPartnerShares } from "@/components/admin/accounts-partner-shares";
import { toast } from "sonner";

const place = (p: string, partnerId: string | null, label: string, balanceCents: number) => ({
  place: p, partnerId, label, balanceCents, lastCount: null,
});
const TREASURY = {
  started: true,
  startDate: "2026-09-01",
  today: "2026-11-25",
  places: [
    place("CASH", null, "Caja", 50000),
    place("BANK", null, "Banco", 200000),
    place("PARTNER_HELD", "a", "Guardado por Ana", 10000),
    place("PARTNER_ACCOUNT", "a", "Cuenta de Ana con el club", 12000),
    place("PARTNER_HELD", "b", "Guardado por Bea", 0),
    place("PARTNER_ACCOUNT", "b", "Cuenta de Bea con el club", -8000),
  ],
  totalCents: 260000,
  partners: [
    { partnerId: "a", name: "Ana", active: true, heldCents: 10000, accountCents: 12000 },
    { partnerId: "b", name: "Bea", active: true, heldCents: 0, accountCents: -8000 },
  ],
  unplaced: { count: 0, cents: 0 },
  fundCents: 5000,
};
const PROFIT = {
  started: true,
  year: 2026,
  months: [
    {
      period: "2026-10", ended: true, resultCents: 100000,
      parts: [
        { partnerId: "a", name: "Ana", active: true, partCents: 50000, sharedCents: 10000, pendingCents: 40000, overSharedCents: 0, suggestedCents: 40000 },
        { partnerId: "b", name: "Bea", active: true, partCents: 50000, sharedCents: 0, pendingCents: 50000, overSharedCents: 0, suggestedCents: 30000 },
      ],
    },
    {
      period: "2026-11", ended: false, resultCents: 20000,
      parts: [
        { partnerId: "a", name: "Ana", active: true, partCents: 10000, sharedCents: 0, pendingCents: 10000, overSharedCents: 0, suggestedCents: 0 },
        { partnerId: "b", name: "Bea", active: true, partCents: 10000, sharedCents: 0, pendingCents: 10000, overSharedCents: 0, suggestedCents: 0 },
      ],
    },
  ],
  partners: [
    { partnerId: "a", name: "Ana", active: true },
    { partnerId: "b", name: "Bea", active: true },
  ],
  available: {
    cashCents: 50000, bankCents: 200000, heldCents: 10000, partnerAccountsCents: 4000,
    coachesOwedCents: 20000, unpaidExpensesCents: 10000, fundCents: 5000, reserveCents: 100000, availableCents: 129000,
  },
  sharesValid: true,
  warnings: [],
};
const SHARE = {
  id: "r1", period: "2026-10", date: "2026-11-02", partnerId: "a", partnerName: "Ana", amountCents: 10000,
  fromPlace: "BANK", note: "Primer reparto", createdAt: "2026-11-02T10:00:00Z", createdByName: "Héctor",
};

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  access.write = true;
  tre.summary.mockResolvedValue(TREASURY);
  tre.statement.mockResolvedValue({ started: true, openingCents: 0, rows: [], closingCents: 0 });
  prof.summary.mockResolvedValue(PROFIT);
  prof.shares.list.mockResolvedValue({ started: true, shares: [SHARE] });
  prof.shares.create.mockResolvedValue({ shares: [SHARE] });
  prof.shares.remove.mockResolvedValue(undefined);
  prof.partnerShares.get.mockResolvedValue({
    sets: [{
      fromMonth: "2026-09",
      shares: [{ partnerId: "a", name: "Ana", active: true, shareBps: 5000 }, { partnerId: "b", name: "Bea", active: true, shareBps: 5000 }],
    }],
    lockedUntil: "2026-10",
  });
  prof.partnerShares.set.mockResolvedValue(undefined);
  acc.partners.mockResolvedValue([{ id: "a", name: "Ana", active: true }, { id: "b", name: "Bea", active: true }]);
});

describe("Socios y reparto", () => {
  it("sin empezar la tesorería, explica y lleva a Ajustes sin pedir el reparto", async () => {
    tre.summary.mockResolvedValue({ started: false });
    wrap(<AccountsProfitSection clubId="c1" />);
    expect(await screen.findByRole("link", { name: "Ir a Ajustes" })).toHaveAttribute("href", "/mi-club/cuentas?tab=ajustes");
    expect(prof.summary).not.toHaveBeenCalled();
  });

  it("cada socio con lo que guarda, su cuenta en frase y lo repartido en el año", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    const ana = await screen.findByRole("group", { name: "Ana" });
    expect(ana).toHaveTextContent("100,00");
    expect(ana).toHaveTextContent("Tiene 120,00");
    await waitFor(() => expect(ana).toHaveTextContent("Repartido en 2026: 100,00"));
    expect(screen.getByRole("group", { name: "Bea" })).toHaveTextContent("El club le debe 80,00");
    expect(prof.summary).toHaveBeenCalledWith("c1", "2026");
  });

  it("el disponible enseña de dónde sale cada resta", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    const disponible = await screen.findByRole("region", { name: "Dinero disponible" });
    expect(disponible).toHaveTextContent("Debido a entrenadores");
    expect(disponible).toHaveTextContent("Fondo (no se reparte)");
    expect(disponible).toHaveTextContent("Colchón");
    expect(disponible).toHaveTextContent("1290,00");
  });

  it("la tabla de meses da el pendiente de cada socio y solo deja repartir un mes acabado", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    const tabla = await screen.findByRole("region", { name: "Beneficio por meses" });
    expect(tabla).toHaveTextContent("octubre de 2026");
    expect(tabla).toHaveTextContent(/de 500,00.+ · repartido 100,00/);
    expect(tabla).toHaveTextContent("En curso");
    expect(within(tabla).getAllByRole("button", { name: "Repartir" })).toHaveLength(1);
  });

  it("Repartir: sugiere los importes, resume y pide una segunda confirmación", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Repartir" }));
    const dialog = await screen.findByRole("dialog", { name: "Repartir octubre de 2026" });
    expect(within(dialog).getByRole("textbox", { name: "Importe de Ana" })).toHaveValue("400,00");
    expect(within(dialog).getByRole("textbox", { name: "Importe de Bea" })).toHaveValue("300,00");

    fireEvent.change(within(dialog).getByRole("textbox", { name: "Importe de Bea" }), { target: { value: "200" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar" }));
    const resumen = await screen.findByRole("list", { name: "Resumen del reparto" });
    expect(resumen).toHaveTextContent("600,00");
    expect(prof.shares.create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apuntar reparto" }));
    // Aún no se ha apuntado: falta la confirmación
    expect(prof.shares.create).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Sí, apuntar" }));

    await waitFor(() => expect(prof.shares.create).toHaveBeenCalledWith("c1", {
      period: "2026-10",
      date: "2026-11-25",
      fromPlace: "CASH",
      lines: [{ partnerId: "a", amountCents: 40000 }, { partnerId: "b", amountCents: 20000 }],
    }));
    expect(toast.success).toHaveBeenCalledWith("Reparto apuntado");
  });

  it("un importe que pasa de lo pendiente no deja revisar", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Repartir" }));
    const dialog = await screen.findByRole("dialog", { name: "Repartir octubre de 2026" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Importe de Ana" }), { target: { value: "400,01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Revisar" }));
    expect(await within(dialog).findByText(/No puede pasar de lo pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Resumen del reparto" })).not.toBeInTheDocument();
  });

  it("con las partes rotas avisa y no deja repartir", async () => {
    prof.summary.mockResolvedValue({ ...PROFIT, sharesValid: false, warnings: ["Las partes no suman 100 %"] });
    wrap(<AccountsProfitSection clubId="c1" />);
    expect(await screen.findByRole("note")).toHaveTextContent("Las partes no suman 100 %");
    expect(screen.getByRole("button", { name: "Repartir" })).toBeDisabled();
  });

  it("la lista de repartos se puede borrar con confirmación", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Borrar el reparto de 100,00/ }));
    expect(prof.shares.remove).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Borrar reparto" }));
    await waitFor(() => expect(prof.shares.remove).toHaveBeenCalledWith("c1", "r1"));
  });

  it("sin permiso de escritura no hay Repartir, Mover dinero ni borrar", async () => {
    access.write = false;
    wrap(<AccountsProfitSection clubId="c1" />);
    await screen.findByRole("region", { name: "Beneficio por meses" });
    await screen.findByText(/Primer reparto/);
    expect(screen.queryByRole("button", { name: "Repartir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mover dinero" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Borrar el reparto/ })).not.toBeInTheDocument();
  });

  it("«Mover dinero» de un socio abre el diálogo con el socio ya puesto", async () => {
    wrap(<AccountsProfitSection clubId="c1" />);
    const bea = await screen.findByRole("group", { name: "Bea" });
    fireEvent.click(within(bea).getByRole("button", { name: "Mover dinero" }));
    const dialog = await screen.findByRole("dialog", { name: "Mover dinero" });
    expect(dialog).toHaveTextContent("Guardado por Bea");
  });
});

describe("partes de los socios en Ajustes", () => {
  it("propone empezar el mes siguiente al último repartido y enseña los juegos de antes", async () => {
    wrap(<AccountsPartnerShares clubId="c1" />);
    expect(await screen.findByLabelText("Desde el mes")).toHaveValue("2026-11");
    expect(screen.getByText(/Ya hay repartos hasta octubre de 2026/)).toBeInTheDocument();
    const previas = screen.getByRole("region", { name: "Partes anteriores" });
    expect(previas).toHaveTextContent("Desde septiembre de 2026");
    expect(previas).toHaveTextContent("Ana 50 % · Bea 50 %");
  });

  it("a partes iguales se guarda con los puntos básicos y el mes", async () => {
    prof.partnerShares.get.mockResolvedValue({ sets: [], lockedUntil: null });
    acc.partners.mockResolvedValue([
      { id: "a", name: "Ana", active: true }, { id: "b", name: "Bea", active: true }, { id: "c", name: "Cai", active: true },
    ]);
    wrap(<AccountsPartnerShares clubId="c1" />);
    expect(await screen.findByLabelText(/A partes iguales/)).toBeChecked();
    fireEvent.change(screen.getByLabelText("Desde el mes"), { target: { value: "2026-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar partes" }));
    await waitFor(() => expect(prof.partnerShares.set).toHaveBeenCalledWith("c1", {
      fromMonth: "2026-12",
      shares: [{ partnerId: "a", shareBps: 3334 }, { partnerId: "b", shareBps: 3333 }, { partnerId: "c", shareBps: 3333 }],
    }));
    expect(toast.success).toHaveBeenCalledWith("Partes guardadas");
  });

  it("un mes que no pasa del último repartido no deja guardar", async () => {
    wrap(<AccountsPartnerShares clubId="c1" />);
    fireEvent.change(await screen.findByLabelText("Desde el mes"), { target: { value: "2026-10" } });
    expect(screen.getAllByText(/las partes solo pueden empezar después/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Guardar partes" })).toBeDisabled();
  });

  it("si ya hay un juego desde ese mes avisa de que se sustituye", async () => {
    prof.partnerShares.get.mockResolvedValue({
      sets: [{ fromMonth: "2026-12", shares: [{ partnerId: "a", name: "Ana", active: true, shareBps: 5000 }] }],
      lockedUntil: null,
    });
    wrap(<AccountsPartnerShares clubId="c1" />);
    fireEvent.change(await screen.findByLabelText("Desde el mes"), { target: { value: "2026-12" } });
    expect(screen.getByRole("note")).toHaveTextContent("al guardar se sustituyen");
  });

  it("el 409 de repartos hechos sale con su frase", async () => {
    prof.partnerShares.set.mockRejectedValue(Object.assign(new Error("x"), { code: "PROFIT_SHARES_LOCKED" }));
    wrap(<AccountsPartnerShares clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Guardar partes" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/solo pueden empezar después del último mes repartido/)));
  });

  it("un socio de baja sigue en la lista de juegos con su etiqueta", async () => {
    prof.partnerShares.get.mockResolvedValue({
      sets: [{
        fromMonth: "2026-09",
        shares: [{ partnerId: "a", name: "Ana", active: true, shareBps: 5000 }, { partnerId: "z", name: "Zoe", active: false, shareBps: 5000 }],
      }],
      lockedUntil: null,
    });
    wrap(<AccountsPartnerShares clubId="c1" />);
    expect(await screen.findByRole("region", { name: "Partes anteriores" })).toHaveTextContent("Zoe (de baja) 50 %");
  });

  it("con porcentajes tienen que sumar 100 y se guardan en puntos básicos", async () => {
    wrap(<AccountsPartnerShares clubId="c1" />);
    fireEvent.click(await screen.findByLabelText("Con porcentajes"));
    fireEvent.change(screen.getByRole("textbox", { name: "Porcentaje de Ana" }), { target: { value: "60" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Porcentaje de Bea" }), { target: { value: "30" } });
    expect(screen.getByText(/suman 90 %/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar partes" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Porcentaje de Bea" }), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar partes" }));
    await waitFor(() => expect(prof.partnerShares.set).toHaveBeenCalledWith("c1", {
      fromMonth: "2026-11",
      shares: [{ partnerId: "a", shareBps: 6000 }, { partnerId: "b", shareBps: 4000 }],
    }));
  });
});

describe("partes con fecha en el reparto", () => {
  const MONTH_LATE = {
    ...PROFIT.months[0],
    parts: [
      { ...PROFIT.months[0].parts[0], overSharedCents: 2500 },
      { ...PROFIT.months[0].parts[1], active: false },
    ],
  };

  it("la tabla marca al socio de baja y lo repartido de más", async () => {
    prof.summary.mockResolvedValue({ ...PROFIT, months: [MONTH_LATE, PROFIT.months[1]] });
    wrap(<AccountsProfitSection clubId="c1" />);
    const tabla = await screen.findByRole("region", { name: "Beneficio por meses" });
    expect(within(tabla).getByRole("columnheader", { name: "Bea (de baja)" })).toBeInTheDocument();
    expect(tabla).toHaveTextContent("Repartido de más: 25,00");
  });

  it("el diálogo de repartir marca al socio de baja y lo repartido de más", async () => {
    prof.summary.mockResolvedValue({ ...PROFIT, months: [MONTH_LATE, PROFIT.months[1]] });
    wrap(<AccountsProfitSection clubId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Repartir" }));
    const dialog = await screen.findByRole("dialog", { name: "Repartir octubre de 2026" });
    expect(dialog).toHaveTextContent("Bea (de baja)");
    expect(dialog).toHaveTextContent("Repartido de más en octubre de 2026: 25,00");
  });
});
