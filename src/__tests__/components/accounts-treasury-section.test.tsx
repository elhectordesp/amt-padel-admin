/**
 * «Tesorería» de Cuentas (fase 3, S1): sin empezar, las tarjetas de saldos y las
 * cuentas de los socios, «Mover dinero» con sus atajos, «Cuadrar» con lo
 * calculado y la diferencia antes de confirmar, el extracto y las listas con
 * borrar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const access = vi.hoisted(() => ({ write: true }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: (_a: string, level = "read") => (level === "write" ? access.write : true) }),
}));
const svc = vi.hoisted(() => ({
  summary: vi.fn(),
  statement: vi.fn(),
  transfers: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
  counts: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/treasury", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/treasury")>()),
  treasuryService: svc,
}));

import { AccountsTreasurySection } from "@/components/admin/accounts-treasury-section";
import { toast } from "sonner";

const place = (p: string, partnerId: string | null, label: string, balanceCents: number, lastCount: object | null = null) => ({
  place: p, partnerId, label, balanceCents, lastCount,
});
const SUMMARY = {
  started: true,
  startDate: "2026-11-01",
  today: "2026-11-25",
  places: [
    place("CASH", null, "Caja", 35000, { id: "k1", upTo: "2026-11-20", countedCents: 30000, createdAt: "2026-11-21T10:00:00Z" }),
    place("BANK", null, "Banco", 120000),
    place("PARTNER_HELD", "s1", "Guardado por Marta", 20000),
    place("PARTNER_HELD", "s2", "Guardado por Antiguo", 0),
    place("PARTNER_ACCOUNT", "s1", "Cuenta de Marta con el club", 12000),
    place("PARTNER_ACCOUNT", "s2", "Cuenta de Antiguo con el club", 0),
  ],
  totalCents: 175000,
  partners: [
    { partnerId: "s1", name: "Marta", active: true, heldCents: 20000, accountCents: 12000 },
    { partnerId: "s2", name: "Antiguo", active: false, heldCents: 0, accountCents: 0 },
  ],
  unplaced: { count: 0, cents: 0 },
  fundCents: 15000,
};
const TRANSFER = {
  id: "t1", date: "2026-11-24", amountCents: 20000,
  from: { place: "CASH", partnerId: null, label: "Caja" }, to: { place: "BANK", partnerId: null, label: "Banco" },
  note: "Ingreso", createdAt: "2026-11-24T10:00:00Z", createdByName: "Héctor",
};
const COUNT = {
  id: "k1", place: "CASH", partnerId: null, label: "Caja", upTo: "2026-11-20", countedCents: 30000,
  note: null, createdAt: "2026-11-21T10:00:00Z", createdByName: "Héctor",
};

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AccountsTreasurySection clubId="c1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  access.write = true;
  svc.summary.mockResolvedValue(SUMMARY);
  svc.statement.mockResolvedValue({ started: true, openingCents: 1000, rows: [], closingCents: 1000 });
  svc.transfers.list.mockResolvedValue({ started: true, transfers: [TRANSFER] });
  svc.transfers.create.mockResolvedValue(TRANSFER);
  svc.transfers.remove.mockResolvedValue(undefined);
  svc.counts.list.mockResolvedValue({ started: true, counts: [COUNT] });
  svc.counts.create.mockResolvedValue({ ...COUNT, computedCents: 35000, diffCents: -5000 });
  svc.counts.remove.mockResolvedValue(undefined);
});

describe("sin empezar", () => {
  it("explica qué es y lleva a Ajustes, sin pedir nada más", async () => {
    svc.summary.mockResolvedValue({ started: false });
    renderSection();
    expect(await screen.findByText(/dónde está el dinero del club/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Ajustes" })).toHaveAttribute("href", "/mi-club/cuentas?tab=ajustes");
    expect(screen.queryByRole("button", { name: /Mover dinero/ })).not.toBeInTheDocument();
    expect(svc.transfers.list).not.toHaveBeenCalled();
  });
});

describe("empezada", () => {
  it("enseña las tarjetas con su último cuadre, el total y la cuenta de cada socio con palabras", async () => {
    renderSection();
    const saldos = await screen.findByRole("region", { name: "Saldos" });
    expect(within(saldos).getByText("Caja")).toBeInTheDocument();
    expect(saldos).toHaveTextContent("Último cuadre: hasta el 20 nov, 300,00");
    // El banco sin cuadre avisa; el total suma caja, banco y lo guardado
    expect(saldos).toHaveTextContent("Sin cuadrar: cuenta lo que hay de verdad");
    expect(saldos).toHaveTextContent("Guardado por Marta");
    expect(saldos).toHaveTextContent("1750,00");
    // Un socio de baja sin saldo no sale como tarjeta
    expect(saldos).not.toHaveTextContent("Guardado por Antiguo");
    const cuentas = screen.getByRole("region", { name: "Cuentas de los socios" });
    expect(cuentas).toHaveTextContent("Tiene 120,00");
    // Un socio de baja sin saldo no se lista; y nunca se enseña un signo
    expect(cuentas).not.toHaveTextContent("Antiguo");
    expect(cuentas).not.toHaveTextContent("-");
  });

  it("enseña el fondo aparte, como lo que no se reparte", async () => {
    renderSection();
    const saldos = await screen.findByRole("region", { name: "Saldos" });
    expect(saldos).toHaveTextContent("Fondo (no se reparte)");
    expect(saldos).toHaveTextContent("150,00");
  });

  it("avisa del dinero sin lugar", async () => {
    svc.summary.mockResolvedValue({ ...SUMMARY, unplaced: { count: 2, cents: 4500 } });
    renderSection();
    expect(await screen.findByRole("note")).toHaveTextContent("2 movimientos sin lugar (45,00");
  });

  it("sin permiso de escritura no hay botones de mover, cuadrar ni borrar", async () => {
    access.write = false;
    renderSection();
    await screen.findByRole("region", { name: "Saldos" });
    expect(screen.queryByRole("button", { name: /Mover dinero/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cuadrar" })).not.toBeInTheDocument();
    await screen.findByText(/Ingreso/);
    expect(screen.queryByRole("button", { name: /Borrar el traspaso/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Borrar el cuadre/ })).not.toBeInTheDocument();
  });
});

describe("Mover dinero", () => {
  const open = async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Mover dinero/ }));
    return screen.findByRole("dialog", { name: "Mover dinero" });
  };

  it("el atajo por defecto lleva la caja al banco", async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "200" } });
    expect(within(dialog).getByRole("status")).toHaveTextContent("Pasan 200,00");
    expect(within(dialog).getByRole("status")).toHaveTextContent("de Caja a Banco");
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar traspaso" }));
    await waitFor(() => expect(svc.transfers.create).toHaveBeenCalledWith("c1", {
      date: "2026-11-25", amountCents: 20000, from: { place: "CASH" }, to: { place: "BANK" },
    }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Traspaso apuntado"));
  });

  it("«un socio devuelve lo guardado» rellena de lo que guarda a la caja y avisa de cuánto guarda", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Un socio devuelve lo guardado" }));
    expect(within(dialog).getByText(/Ese socio guarda ahora 200,00/)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "50" } });
    fireEvent.change(within(dialog).getByLabelText("Nota del traspaso"), { target: { value: "Devolución" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar traspaso" }));
    await waitFor(() => expect(svc.transfers.create).toHaveBeenCalledWith("c1", {
      date: "2026-11-25", amountCents: 5000,
      from: { place: "PARTNER_HELD", partnerId: "s1" }, to: { place: "CASH" }, note: "Devolución",
    }));
  });

  it("«pasar al banco el Bizum de un socio» saca de su cuenta y mete en el banco", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Pasar al banco el Bizum de un socio" }));
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "30,50" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar traspaso" }));
    await waitFor(() => expect(svc.transfers.create).toHaveBeenCalledWith("c1", {
      date: "2026-11-25", amountCents: 3050,
      from: { place: "PARTNER_ACCOUNT", partnerId: "s1" }, to: { place: "BANK" },
    }));
  });

  it("no guarda sin importe y no ofrece al socio de baja", async () => {
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar traspaso" }));
    expect(svc.transfers.create).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Escribe un importe válido/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Un socio guarda efectivo" }));
    fireEvent.click(within(dialog).getByText("Marta"));
    expect(within(dialog).queryByText("Antiguo")).not.toBeInTheDocument();
  });

  it("si el back lo rechaza, enseña su texto y no dice que está hecho", async () => {
    svc.transfers.create.mockRejectedValue(Object.assign(new Error("x"), { code: "TREASURY_HELD_INSUFFICIENT" }));
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Un socio devuelve lo guardado" }));
    fireEvent.change(within(dialog).getByLabelText("Importe"), { target: { value: "900" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Apuntar traspaso" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("no puede devolver más efectivo")));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("Cuadrar", () => {
  const open = async () => {
    renderSection();
    await screen.findByRole("region", { name: "Saldos" });
    await screen.findByText(/Ingreso/);
    // El botón de arriba (no el de una tarjeta)
    const buttons = screen.getAllByRole("button", { name: /Cuadrar/ });
    fireEvent.click(buttons[0]);
    return screen.findByRole("dialog", { name: "Cuadrar" });
  };

  it("hasta hoy enseña lo calculado y la diferencia antes de confirmar, y no guarda sin confirmar", async () => {
    const dialog = await open();
    expect(within(dialog).getByRole("button", { name: "Confirmar cuadre" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Lo que hay de verdad"), { target: { value: "300" } });
    const status = within(dialog).getByRole("status");
    expect(status).toHaveTextContent("Calculado por el panel");
    expect(status).toHaveTextContent("350,00");
    expect(status).toHaveTextContent("Lo que has contado");
    expect(status).toHaveTextContent("−50,00");
    expect(status).toHaveTextContent("Faltan 50,00");
    expect(svc.counts.create).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Nota del cuadre"), { target: { value: "Arqueo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cuadre" }));
    await waitFor(() => expect(svc.counts.create).toHaveBeenCalledWith("c1", {
      place: "CASH", upTo: "2026-11-25", countedCents: 30000, note: "Arqueo",
    }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("−50,00")));
  });

  it("hasta ayer pide el saldo de ese día al extracto", async () => {
    svc.statement.mockResolvedValue({ started: true, openingCents: 0, rows: [], closingCents: 34000 });
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hasta ayer" }));
    await waitFor(() => expect(svc.statement).toHaveBeenCalledWith("c1", { place: "CASH", from: "2026-11-24", to: "2026-11-24" }));
    fireEvent.change(within(dialog).getByLabelText("Lo que hay de verdad"), { target: { value: "340" } });
    expect(await within(dialog).findByText("Coincide: no hay diferencia.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar cuadre" }));
    await waitFor(() => expect(svc.counts.create).toHaveBeenCalledWith("c1", {
      place: "CASH", upTo: "2026-11-24", countedCents: 34000,
    }));
  });

  it("la caja no admite negativos", async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText("Lo que hay de verdad"), { target: { value: "-5" } });
    expect(within(dialog).getByText("Aquí no puede haber menos de 0 €")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirmar cuadre" })).toBeDisabled();
  });
});

describe("extracto y listas", () => {
  it("el extracto pide el lugar elegido con las fechas y enseña el saldo corriendo", async () => {
    svc.statement.mockResolvedValue({
      started: true, openingCents: 1000,
      rows: [
        { day: "2026-11-24", source: "SALE", refId: "s1", concept: "Venta de bolas", amountCents: 600 },
        { day: "2026-11-25", source: "COUNT", refId: "k2", concept: "Cuadre", amountCents: -100 },
      ],
      closingCents: 1500,
    });
    renderSection();
    const extracto = await screen.findByRole("region", { name: "Extracto" });
    await waitFor(() => expect(svc.statement).toHaveBeenCalledWith("c1", { place: "CASH", from: "2026-11-01", to: "2026-11-25" }));
    expect(await within(extracto).findByText("Venta de bolas")).toBeInTheDocument();
    expect(extracto).toHaveTextContent("+6,00");
    expect(extracto).toHaveTextContent("−1,00");
    expect(extracto).toHaveTextContent("Saldo al acabar");
    // Un rango con días futuros no pide nada y lo dice
    svc.statement.mockClear();
    fireEvent.change(within(extracto).getByLabelText("Extracto desde"), { target: { value: "2026-11-01" } });
    fireEvent.change(within(extracto).getByLabelText("Extracto hasta"), { target: { value: "2026-11-30" } });
    expect(await within(extracto).findByRole("alert")).toHaveTextContent("futuros");
  });

  it("borrar un traspaso pide confirmación y borra el elegido", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Borrar el traspaso de 200,00/ }));
    const confirm = await screen.findByRole("dialog");
    expect(confirm).toHaveTextContent("de Caja a Banco");
    expect(svc.transfers.remove).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole("button", { name: "Borrar traspaso" }));
    await waitFor(() => expect(svc.transfers.remove).toHaveBeenCalledWith("c1", "t1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Traspaso borrado"));
  });

  it("borrar un cuadre pide confirmación y, si falla, enseña el error", async () => {
    svc.counts.remove.mockRejectedValue(Object.assign(new Error("x"), { code: "TREASURY_COUNT_NOT_FOUND" }));
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /Borrar el cuadre de Caja/ }));
    const confirm = await screen.findByRole("dialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Borrar cuadre" }));
    await waitFor(() => expect(svc.counts.remove).toHaveBeenCalledWith("c1", "k1"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Ese cuadre ya no existe. Recarga la pantalla."));
  });
});
