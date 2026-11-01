/**
 * Horarios del club (R2-5): un club que cierra a medianoche lo marca con
 * «Medianoche» y se guarda «24:00» (un campo de hora no puede escribirlo, y
 * con 23:59 la última franja no se ofrecía).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));

const svc = vi.hoisted(() => ({
  operatingHours: { list: vi.fn(), replace: vi.fn() },
  exceptions: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return { ...actual, bookingsService: svc };
});

import HorariosPage from "../../../app/(admin)/mi-club/reservas/horarios/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HorariosPage />
    </QueryClientProvider>,
  );
}

describe("Horarios: cierre a medianoche", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.operatingHours.list.mockResolvedValue([
      { id: "h1", clubId: "c1", dayOfWeek: 1, openTime: "09:00", closeTime: "23:00", active: true },
      { id: "h5", clubId: "c1", dayOfWeek: 5, openTime: "09:00", closeTime: "24:00", active: true },
    ]);
    svc.operatingHours.replace.mockResolvedValue([]);
    svc.exceptions.list.mockResolvedValue([]);
    svc.exceptions.create.mockResolvedValue({});
  });

  it("marcar «Medianoche» guarda el cierre como 24:00", async () => {
    renderPage();
    fireEvent.click(await screen.findByLabelText("Cierra a medianoche (Lunes)"));
    expect(screen.queryByLabelText("Cierre de Lunes")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Guardar/ })[0]);

    await waitFor(() =>
      expect(svc.operatingHours.replace).toHaveBeenCalledWith("c1", {
        hours: [
          { dayOfWeek: 1, openTime: "09:00", closeTime: "24:00", active: true },
          { dayOfWeek: 5, openTime: "09:00", closeTime: "24:00", active: true },
        ],
      }),
    );
  });

  it("un día guardado a medianoche sale marcado; desmarcarlo vuelve a una hora", async () => {
    renderPage();
    const friday = await screen.findByLabelText("Cierra a medianoche (Viernes)");
    expect(friday).toBeChecked();
    fireEvent.click(friday);
    expect(screen.getByLabelText("Cierre de Viernes")).toHaveValue("23:00");
  });

  it("una excepción también puede cerrar a medianoche", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Añadir/ }));
    fireEvent.click(screen.getByLabelText("Cierra a medianoche (la excepción)"));
    fireEvent.click(screen.getAllByRole("button", { name: "Guardar" }).at(-1)!);

    await waitFor(() =>
      expect(svc.exceptions.create).toHaveBeenCalledWith("c1", expect.objectContaining({ customClose: "24:00" })),
    );
  });
});
