/**
 * Precios de las pistas (R1-8, R2-12): el precio se teclea tal cual (antes,
 * al escribir «25» quedaba «2.01»), se guarda en céntimos, un precio mal
 * escrito no se manda, y en el móvil la tabla se desplaza de lado.
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

const pricing = vi.hoisted(() => ({ list: vi.fn(), replace: vi.fn() }));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: { courtPricing: pricing } };
});

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
    pricing.list.mockResolvedValue([{ ...SLOT, priceCents: 1250 }]);
    pricing.replace.mockResolvedValue([]);
  });

  it("se teclea «25» y se guarda 2500 céntimos", async () => {
    renderPage();
    const input = await screen.findByLabelText("Precio de la fila 1 (€)");
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
    const input = await screen.findByLabelText("Precio de la fila 1 (€)");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("Fila 1"));
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
    await screen.findByLabelText("Precio de la fila 1 (€)");
    const wrapper = screen.getByRole("table").parentElement!;
    expect(wrapper).toHaveClass("overflow-x-auto");
    expect(wrapper).not.toHaveClass("overflow-hidden");
  });
});
