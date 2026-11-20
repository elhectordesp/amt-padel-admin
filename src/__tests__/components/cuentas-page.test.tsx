/**
 * /mi-club/cuentas (módulo Cuentas): solo con el módulo encendido; «Socios del
 * club» (alta, renombrar, activar y desactivar) y «Precios especiales» (franjas
 * validadas, activar y desactivar, y borrar con el aviso de «ya usado»).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string | null) => r === "club",
}));
const clubState = vi.hoisted(() => ({ value: { on: true, known: true, isError: false, refetch: vi.fn() } }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useClubAccounts: () => clubState.value }));
const accounts = vi.hoisted(() => ({
  partners: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
  partPrices: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/accounts", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/accounts")>()),
  accountsService: accounts,
}));

import CuentasPage from "../../../app/(admin)/mi-club/cuentas/page";
import { toast } from "sonner";

const PRICES = [
  {
    id: "pp1", name: "Alumno", kind: "STUDENT", perCourt: false, active: true, displayOrder: 0,
    slots: [
      { daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "14:00", priceCents: 500 },
      { daysOfWeek: [1, 2, 3, 4, 5], startTime: "14:00", endTime: "22:00", priceCents: 550 },
    ],
  },
];

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <CuentasPage />
    </QueryClientProvider>,
  );
}

describe("página Cuentas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubState.value = { on: true, known: true, isError: false, refetch: vi.fn() };
    accounts.partners.list.mockResolvedValue([
      { id: "s1", name: "Marta", active: true },
      { id: "s2", name: "Antiguo", active: false },
    ]);
    accounts.partners.create.mockResolvedValue({ id: "s3", name: "Luis", active: true });
    accounts.partners.update.mockResolvedValue({});
    accounts.partPrices.list.mockResolvedValue(PRICES);
    accounts.partPrices.create.mockResolvedValue({});
    accounts.partPrices.update.mockResolvedValue({});
    accounts.partPrices.remove.mockResolvedValue(undefined);
  });

  it("con el módulo apagado, lo dice y no pide nada", async () => {
    clubState.value = { on: false, known: true, isError: false, refetch: vi.fn() };
    renderPage();
    expect(screen.getByText(/no está activado en tu club/)).toBeInTheDocument();
    expect(accounts.partners.list).not.toHaveBeenCalled();
    expect(accounts.partPrices.list).not.toHaveBeenCalled();
  });

  it("mientras no sabe si está activado, no dice que no lo esté", () => {
    clubState.value = { on: false, known: false, isError: false, refetch: vi.fn() };
    renderPage();
    expect(screen.queryByText(/no está activado/)).not.toBeInTheDocument();
  });

  describe("socios del club", () => {
    it("explica para qué sirven y lista activos y desactivados", async () => {
      renderPage();
      expect(await screen.findByText("Marta")).toBeInTheDocument();
      expect(screen.getByText(/a cuyo móvil llega un Bizum/)).toBeInTheDocument();
      expect(screen.getByText("Antiguo")).toBeInTheDocument();
      expect(screen.getByText("Desactivado")).toBeInTheDocument();
    });

    it("da de alta un socio con su nombre", async () => {
      renderPage();
      await screen.findByText("Marta");
      const add = screen.getByRole("button", { name: /Añadir socio/ });
      expect(add).toBeDisabled();
      fireEvent.change(screen.getByLabelText("Nombre del nuevo socio"), { target: { value: "  Luis  " } });
      fireEvent.click(add);
      await waitFor(() => expect(accounts.partners.create).toHaveBeenCalledWith("c1", "Luis"));
    });

    it("renombra y desactiva o activa; no se borra", async () => {
      renderPage();
      await screen.findByText("Marta");
      fireEvent.click(screen.getByRole("button", { name: "Renombrar a Marta" }));
      fireEvent.change(screen.getByLabelText("Nuevo nombre del socio"), { target: { value: "Marta R." } });
      fireEvent.click(screen.getByRole("button", { name: "Guardar el nombre" }));
      await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s1", { name: "Marta R." }));

      const partners = within(screen.getByText("Socios del club").closest("section") as HTMLElement);
      fireEvent.click(partners.getByRole("button", { name: "Desactivar" }));
      await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s1", { active: false }));
      fireEvent.click(partners.getByRole("button", { name: "Activar" }));
      await waitFor(() => expect(accounts.partners.update).toHaveBeenCalledWith("c1", "s2", { active: true }));
      expect(screen.queryByRole("button", { name: /Borrar Marta/ })).not.toBeInTheDocument();
    });
  });

  describe("precios especiales", () => {
    const section = async () => within((await screen.findByText("Precios especiales")).closest("section") as HTMLElement);

    it("lista cada precio con su tipo, cómo se aplica y sus franjas", async () => {
      renderPage();
      const prices = await section();
      // El nombre y la etiqueta de su tipo
      expect(await prices.findAllByText("Alumno")).toHaveLength(2);
      expect(prices.getByText("Por jugador")).toBeInTheDocument();
      expect(prices.getByText("Lun–Vie · 09:00–14:00 · 5,00 €")).toBeInTheDocument();
      expect(prices.getByText("Lun–Vie · 14:00–22:00 · 5,50 €")).toBeInTheDocument();
    });

    it("un precio nuevo no se guarda sin nombre ni franja válida, y al guardar manda las franjas en céntimos", async () => {
      renderPage();
      const prices = await section();
      await prices.findByRole("button", { name: "Editar Alumno" });
      fireEvent.click(prices.getByRole("button", { name: /Nuevo precio/ }));
      const dialog = within(screen.getByRole("dialog", { name: "Nuevo precio" }));
      const save = dialog.getByRole("button", { name: "Guardar" });
      expect(save).toBeDisabled();

      fireEvent.change(dialog.getByLabelText("Nombre del precio"), { target: { value: "Amigo del club" } });
      expect(save).toBeDisabled();
      expect(dialog.getByRole("alert")).toHaveTextContent("elige al menos un día");
      fireEvent.click(dialog.getByRole("button", { name: "Lun" }));
      fireEvent.click(dialog.getByRole("button", { name: "Mié" }));
      fireEvent.change(dialog.getByLabelText("Desde de la franja 1"), { target: { value: "16:00" } });
      fireEvent.change(dialog.getByLabelText("Hasta de la franja 1"), { target: { value: "12:00" } });
      expect(dialog.getByRole("alert")).toHaveTextContent("anterior a la de fin");
      fireEvent.change(dialog.getByLabelText("Hasta de la franja 1"), { target: { value: "20:00" } });
      fireEvent.change(dialog.getByLabelText("Precio de la franja 1"), { target: { value: "4,5" } });
      expect(dialog.queryByRole("alert")).not.toBeInTheDocument();

      fireEvent.change(dialog.getByLabelText("Cómo se aplica el precio"), { target: { value: "court" } });
      fireEvent.click(save);
      await waitFor(() =>
        expect(accounts.partPrices.create).toHaveBeenCalledWith("c1", {
          name: "Amigo del club", kind: "SPECIAL", perCourt: true,
          slots: [{ daysOfWeek: [1, 3], startTime: "16:00", endTime: "20:00", priceCents: 450 }],
        }),
      );
    });

    it("editar sustituye las franjas y conserva si está activo y su orden", async () => {
      renderPage();
      const prices = await section();
      fireEvent.click(await prices.findByRole("button", { name: "Editar Alumno" }));
      const dialog = within(screen.getByRole("dialog", { name: "Editar precio" }));
      expect(dialog.getByLabelText("Precio de la franja 2")).toHaveValue("5,50");
      fireEvent.click(dialog.getByRole("button", { name: "Quitar la franja 2" }));
      fireEvent.click(dialog.getByRole("button", { name: "Guardar" }));
      await waitFor(() =>
        expect(accounts.partPrices.update).toHaveBeenCalledWith("c1", "pp1", {
          name: "Alumno", kind: "STUDENT", perCourt: false, active: true, displayOrder: 0,
          slots: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "14:00", priceCents: 500 }],
        }),
      );
    });

    it("desactivar un precio lo manda inactivo con todo lo demás igual", async () => {
      renderPage();
      const prices = await section();
      fireEvent.click(await prices.findByRole("button", { name: "Desactivar" }));
      await waitFor(() =>
        expect(accounts.partPrices.update).toHaveBeenCalledWith(
          "c1", "pp1", expect.objectContaining({ active: false, name: "Alumno", slots: PRICES[0].slots }),
        ),
      );
    });

    it("borrar uno sin usar lo borra tras confirmar", async () => {
      renderPage();
      const prices = await section();
      fireEvent.click(await prices.findByRole("button", { name: "Borrar Alumno" }));
      fireEvent.click(await screen.findByRole("button", { name: "Sí, borrar" }));
      await waitFor(() => expect(accounts.partPrices.remove).toHaveBeenCalledWith("c1", "pp1"));
    });

    it("si ya se usó (ACCOUNTS_IN_USE) no se borra: ofrece desactivarlo", async () => {
      accounts.partPrices.remove.mockRejectedValue(Object.assign(new Error("En uso"), { code: "ACCOUNTS_IN_USE", status: 409 }));
      renderPage();
      const prices = await section();
      fireEvent.click(await prices.findByRole("button", { name: "Borrar Alumno" }));
      fireEvent.click(await screen.findByRole("button", { name: "Sí, borrar" }));
      fireEvent.click(await screen.findByRole("button", { name: "Desactivarlo" }));
      await waitFor(() =>
        expect(accounts.partPrices.update).toHaveBeenCalledWith("c1", "pp1", expect.objectContaining({ active: false })),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
