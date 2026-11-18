/**
 * Precios de las pistas (R1-8, R2-12): el precio se teclea tal cual (antes,
 * al escribir «25» quedaba «2.01»), se guarda en céntimos, un precio mal
 * escrito no se manda, y en el móvil la tabla se desplaza de lado. Con
 * temporadas: el selector «Precios base / temporada» decide qué franjas se
 * cargan y se guardan; borrar una temporada avisa de que se borran sus precios.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/services/admin", () => ({
  adminService: { courts: { list: vi.fn().mockResolvedValue([{ id: "p1", name: "Pista 1", active: true }]) } },
}));

const svc = vi.hoisted(() => ({
  courtPricing: { list: vi.fn(), replace: vi.fn(), replaceMany: vi.fn() },
  courtDurations: { list: vi.fn() },
  operatingHours: { list: vi.fn() },
  seasons: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  priceOffers: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
const pricing = svc.courtPricing;
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});
// La pestaña «Bonos»: su catálogo y el acceso del rol (aquí, todo)
const voucherSvc = vi.hoisted(() => ({ types: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } }));
vi.mock("@/lib/services/club-vouchers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-vouchers")>("@/lib/services/club-vouchers");
  return { ...actual, clubVouchersService: voucherSvc };
});
const accessMock = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: accessMock.can }) }));

import PreciosPage from "../../../app/(admin)/mi-club/reservas/precios/page";

const SLOT = { id: "s1", courtId: "p1", dayOfWeek: 1, startTime: "09:00", endTime: "23:00", durationMinutes: 90 };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PreciosPage />
    </QueryClientProvider>,
  );
}

describe("Precios de las pistas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.can.mockReturnValue(true);
    pricing.list.mockResolvedValue([{ ...SLOT, priceCents: 1250 }]);
    pricing.replace.mockResolvedValue([]);
    svc.courtDurations.list.mockResolvedValue([{ id: "d1", courtId: "p1", minutes: 90, isDefault: true }]);
    svc.operatingHours.list.mockResolvedValue([]);
    svc.seasons.list.mockResolvedValue([]);
    svc.seasons.remove.mockResolvedValue(undefined);
    svc.priceOffers.list.mockResolvedValue([]);
  });

  it("se teclea «25» y se guarda 2500 céntimos", async () => {
    renderPage();
    const input = await screen.findByLabelText("Precio 90 min, franja 1 (€)");
    expect(input).toHaveValue("12.5");

    // Tecla a tecla, como en el navegador: cada cambio se queda como está
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "2" } });
    expect(input).toHaveValue("2");
    fireEvent.change(input, { target: { value: "25" } });
    expect(input).toHaveValue("25");

    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() =>
      expect(pricing.replace).toHaveBeenCalledWith("c1", "p1", {
        slots: [{ dayOfWeek: 1, startTime: "09:00", endTime: "23:00", durationMinutes: 90, priceCents: 2500 }],
      }),
    );
  });

  it("con coma también vale; un precio mal escrito no se manda", async () => {
    renderPage();
    const input = await screen.findByLabelText("Precio 90 min, franja 1 (€)");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("Franja 1"));
    expect(pricing.replace).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "12,50" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() =>
      expect(pricing.replace).toHaveBeenCalledWith("c1", "p1", {
        slots: [expect.objectContaining({ priceCents: 1250 })],
      }),
    );
  });

  it("la tabla se desplaza de lado si no cabe (móvil)", async () => {
    renderPage();
    await screen.findByLabelText("Precio 90 min, franja 1 (€)");
    const wrapper = screen.getByRole("table").parentElement!;
    expect(wrapper).toHaveClass("overflow-x-auto");
    expect(wrapper).not.toHaveClass("overflow-hidden");
  });

  it("sin temporada elegida, carga y guarda los precios base (sin seasonId)", async () => {
    renderPage();
    await screen.findByLabelText("Precio 90 min, franja 1 (€)");
    expect(pricing.list).toHaveBeenCalledWith("c1", "p1", null);
    fireEvent.click(screen.getByRole("button", { name: /Guardar$/ }));
    await waitFor(() => expect(pricing.replace).toHaveBeenCalled());
    expect(pricing.replace.mock.calls[0][2]).not.toHaveProperty("seasonId");
  });

  it("al elegir una temporada, carga y guarda solo las franjas de esa temporada", async () => {
    svc.seasons.list.mockResolvedValue([
      { id: "s1", clubId: "c1", name: "Verano", startDate: "2027-06-21T00:00:00.000Z", endDate: "2027-09-20T00:00:00.000Z" },
    ]);
    pricing.list.mockImplementation((_c: string, _p: string, seasonId: string | null) =>
      Promise.resolve(seasonId ? [{ ...SLOT, id: "s2", seasonId, priceCents: 3000 }] : [{ ...SLOT, priceCents: 1250 }]),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Verano" }));
    const input = await screen.findByDisplayValue("30");
    expect(pricing.list).toHaveBeenCalledWith("c1", "p1", "s1");

    fireEvent.change(input, { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar$/ }));
    await waitFor(() =>
      expect(pricing.replace).toHaveBeenCalledWith("c1", "p1", {
        seasonId: "s1",
        slots: [expect.objectContaining({ priceCents: 3200 })],
      }),
    );
  });

  it("borrar una temporada pide confirmar y avisa de que se borran sus precios", async () => {
    svc.seasons.list.mockResolvedValue([
      { id: "s1", clubId: "c1", name: "Verano", startDate: "2027-06-21T00:00:00.000Z", endDate: "2027-09-20T00:00:00.000Z" },
    ]);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Verano" }));
    expect(svc.seasons.remove).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/se borrarán también todos los precios de esa temporada/i);
    fireEvent.click(screen.getByRole("button", { name: "Borrar temporada" }));
    await waitFor(() => expect(svc.seasons.remove).toHaveBeenCalledWith("c1", "s1"));
  });

  it("crea una oferta con los datos del diálogo", async () => {
    svc.priceOffers.create.mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva oferta/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva oferta" });
    const inputs = dialog.querySelectorAll("input");
    fireEvent.change(dialog.querySelector('input[placeholder="Mañanas de agosto"]')!, { target: { value: "Mañanas de agosto" } });
    const dates = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0], { target: { value: "2027-08-01" } });
    fireEvent.change(dates[1], { target: { value: "2027-08-31" } });
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "20" } });
    expect(inputs.length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Guardar oferta" }));
    await waitFor(() =>
      expect(svc.priceOffers.create).toHaveBeenCalledWith("c1", {
        name: "Mañanas de agosto",
        startDate: "2027-08-01",
        endDate: "2027-08-31",
        daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
        startTime: "09:00",
        endTime: "14:00",
        courtIds: [],
        discountPercent: 20,
        membersOnly: false,
      }),
    );
  });

  it("la pestaña «Bonos» enseña el catálogo de bonos y «Precios» vuelve a las cuadrículas", async () => {
    voucherSvc.types.list.mockResolvedValue([
      { id: "t1", clubId: "c1", name: "Bono 10", sessions: 10, priceCents: 12000, validDays: 90, active: true },
    ]);
    renderPage();
    // Por defecto, los precios de siempre
    expect(await screen.findByLabelText("Precio 90 min, franja 1 (€)")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Precios" })).toHaveAttribute("aria-selected", "true");
    expect(voucherSvc.types.list).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Bonos" }));
    expect(await screen.findByText("Bono 10")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bonos" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Precio 90 min, franja 1 (€)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Precios" }));
    expect(await screen.findByLabelText("Precio 90 min, franja 1 (€)")).toBeInTheDocument();
  });

  it("una oferta sin descuento válido no se manda", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva oferta/ }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva oferta" });
    fireEvent.change(dialog.querySelector('input[placeholder="Mañanas de agosto"]')!, { target: { value: "X" } });
    const dates = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(dates[0], { target: { value: "2027-08-01" } });
    fireEvent.change(dates[1], { target: { value: "2027-08-31" } });
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar oferta" }));
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("entre 1 y 100"));
    expect(svc.priceOffers.create).not.toHaveBeenCalled();
  });

  describe("con un rol de solo lectura (Recepción lee la configuración)", () => {
    beforeEach(() => {
      accessMock.can.mockImplementation((_area: string, level = "read") => level === "read");
      svc.seasons.list.mockResolvedValue([
        { id: "s1", clubId: "c1", name: "Verano", startDate: "2027-06-01", endDate: "2027-09-15" },
      ]);
      svc.priceOffers.list.mockResolvedValue([
        { id: "o1", clubId: "c1", name: "Mañanas de agosto", startDate: "2027-08-01", endDate: "2027-08-31",
          daysOfWeek: [1, 2, 3], startTime: "09:00", endTime: "14:00", courtIds: [], discountPercent: 20, membersOnly: false },
      ]);
    });

    it("ve los precios, las temporadas y las ofertas, sin botones de guardar, añadir, editar ni borrar", async () => {
      renderPage();
      const price = await screen.findByLabelText("Precio 90 min, franja 1 (€)");
      expect(price).toHaveValue("12.5");
      expect(price).toBeDisabled();
      expect(await screen.findByText("Mañanas de agosto")).toBeInTheDocument();
      // En el selector y en la lista de temporadas
      expect(screen.getAllByText("Verano").length).toBeGreaterThan(0);

      for (const name of [
        /Guardar/, /Añadir franja/, /Aplicar a todas las pistas/, /Nueva temporada/, /Nueva oferta/,
        /Editar Verano/, /Borrar Verano/, /Editar Mañanas de agosto/, /Borrar Mañanas de agosto/, /Eliminar franja/,
      ]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
      // Los botones «L-V / S-D / Todos» de cada franja tampoco
      expect(screen.queryByRole("button", { name: "L-V" })).not.toBeInTheDocument();
    });

    it("con escritura están todos", async () => {
      accessMock.can.mockReturnValue(true);
      renderPage();
      await screen.findByLabelText("Precio 90 min, franja 1 (€)");
      for (const name of [/^Guardar$/, /Añadir franja/, /Nueva temporada/, /Nueva oferta/, /Editar Verano/, /Borrar Mañanas de agosto/]) {
        expect(await screen.findByRole("button", { name })).toBeInTheDocument();
      }
    });
  });
});
