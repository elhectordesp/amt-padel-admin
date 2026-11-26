/**
 * «Socios del club» (Ajustes de Cuentas): con la tesorería encendida, desactivar
 * a un socio que guarda dinero del club, tiene dinero suyo o al que el club le
 * debe pide confirmación antes (se salda después desde Tesorería). Sin saldo, o
 * con la tesorería apagada, se desactiva como siempre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const accounts = vi.hoisted(() => ({ partners: { list: vi.fn(), create: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));
const treasury = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("@/lib/services/treasury", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/treasury")>()),
  treasuryService: treasury,
}));
// Las partes del reparto tienen sus propios tests
vi.mock("@/components/admin/accounts-partner-shares", () => ({ AccountsPartnerShares: () => null }));

import { AccountsPartnersSection } from "@/components/admin/accounts-partners-section";
import { toast } from "sonner";

const summary = (partners: { partnerId: string; name: string; active: boolean; heldCents: number; accountCents: number }[]) => ({
  started: true, startDate: "2026-11-01", today: "2026-11-25", places: [], totalCents: 0, partners,
  unplaced: { count: 0, cents: 0 }, fundCents: 0,
});

function renderSection(treasuryOn: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AccountsPartnersSection clubId="c1" treasuryOn={treasuryOn} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  accounts.partners.list.mockResolvedValue([
    { id: "s1", name: "Marta", active: true },
    { id: "s2", name: "Luis", active: true },
    { id: "s3", name: "Antiguo", active: false },
  ]);
  accounts.partners.update.mockResolvedValue({});
  treasury.summary.mockResolvedValue(summary([
    { partnerId: "s1", name: "Marta", active: true, heldCents: 20000, accountCents: 0 },
    { partnerId: "s2", name: "Luis", active: true, heldCents: 0, accountCents: 0 },
    { partnerId: "s3", name: "Antiguo", active: false, heldCents: 0, accountCents: 5000 },
  ]));
});

/** El botón «Desactivar» de la fila de un socio, ya cargado el resumen. */
const deactivateOf = async (name: string) => {
  const row = (await screen.findByText(name)).closest("li") as HTMLElement;
  return within(row).getByRole("button", { name: "Desactivar" });
};

describe("desactivar con la tesorería encendida", () => {
  it("pide el resumen de Tesorería y, si guarda dinero del club, pide confirmación antes de desactivar", async () => {
    renderSection(true);
    const button = await deactivateOf("Marta");
    await waitFor(() => expect(button).toBeEnabled());
    expect(treasury.summary).toHaveBeenCalledWith("c1");
    fireEvent.click(button);
    const dialog = await screen.findByRole("dialog", { name: "¿Desactivar a Marta?" });
    expect(dialog).toHaveTextContent("Marta guarda 200,00 € del club. Podrás saldarlo después desde Tesorería.");
    expect(accounts.partners.update).not.toHaveBeenCalled();

    // Cancelar no toca nada
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(accounts.partners.update).not.toHaveBeenCalled();

    // Confirmar sí
    fireEvent.click(await deactivateOf("Marta"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s1", { active: false }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Tesorería se entera de la baja: el resumen se vuelve a pedir
    await waitFor(() => expect(treasury.summary).toHaveBeenCalledTimes(2));
  });

  it("dice con palabras si tiene dinero del club o si el club le debe", async () => {
    treasury.summary.mockResolvedValue(summary([
      { partnerId: "s1", name: "Marta", active: true, heldCents: 0, accountCents: 12000 },
      { partnerId: "s2", name: "Luis", active: true, heldCents: 0, accountCents: -8000 },
    ]));
    renderSection(true);
    const marta = await deactivateOf("Marta");
    await waitFor(() => expect(marta).toBeEnabled());
    fireEvent.click(marta);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Marta tiene 120,00 € del club. Podrás saldarlo");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(await deactivateOf("Luis"));
    expect(await screen.findByRole("dialog")).toHaveTextContent("El club le debe 80,00 € a Luis. Podrás saldarlo");
  });

  it("cuenta las dos cosas cuando las hay", async () => {
    treasury.summary.mockResolvedValue(summary([
      { partnerId: "s1", name: "Marta", active: true, heldCents: 20000, accountCents: -8000 },
    ]));
    renderSection(true);
    const marta = await deactivateOf("Marta");
    await waitFor(() => expect(marta).toBeEnabled());
    fireEvent.click(marta);
    expect(await screen.findByRole("dialog")).toHaveTextContent("Marta guarda 200,00 € del club y el club le debe 80,00 €.");
  });

  it("sin saldo se desactiva directamente, sin preguntar", async () => {
    renderSection(true);
    const luis = await deactivateOf("Luis");
    await waitFor(() => expect(luis).toBeEnabled());
    fireEvent.click(luis);
    await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s2", { active: false }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("con la tesorería sin empezar tampoco hay nada que avisar", async () => {
    treasury.summary.mockResolvedValue({ started: false });
    renderSection(true);
    const marta = await deactivateOf("Marta");
    await waitFor(() => expect(marta).toBeEnabled());
    fireEvent.click(marta);
    await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s1", { active: false }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hasta que llega el resumen no se puede desactivar: el aviso depende de él", async () => {
    treasury.summary.mockReturnValue(new Promise(() => {}));
    renderSection(true);
    const marta = await deactivateOf("Marta");
    expect(marta).toBeDisabled();
    fireEvent.click(marta);
    expect(accounts.partners.update).not.toHaveBeenCalled();
  });

  it("activar a un socio de baja no pregunta nada, aunque tenga saldo", async () => {
    renderSection(true);
    const row = (await screen.findByText("Antiguo")).closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s3", { active: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("si el back rechaza la baja, lo dice y cierra la pregunta", async () => {
    accounts.partners.update.mockRejectedValue(Object.assign(new Error("No se pudo"), { code: "ACCOUNTS_PARTNER_NOT_FOUND" }));
    renderSection(true);
    const marta = await deactivateOf("Marta");
    await waitFor(() => expect(marta).toBeEnabled());
    fireEvent.click(marta);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("desactivar con la tesorería apagada", () => {
  it("no pide el resumen y desactiva como siempre", async () => {
    renderSection(false);
    const marta = await deactivateOf("Marta");
    expect(marta).toBeEnabled();
    fireEvent.click(marta);
    await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s1", { active: false }));
    expect(treasury.summary).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
