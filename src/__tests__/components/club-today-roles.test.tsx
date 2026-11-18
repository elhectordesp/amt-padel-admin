/**
 * «Hoy en el club» (portada del equipo): el atajo «Nueva reserva» es de quien
 * escribe las reservas; quien solo las lee (Entrenador) ve el resto de accesos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const accessMock = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: accessMock.can }) }));
// Los datos del día no importan aquí: que no lleguen no quita los accesos de arriba
const pending = vi.hoisted(() => () => new Promise(() => {}));
vi.mock("@/lib/services/admin", () => ({
  adminService: { clubs: { findOne: vi.fn(pending) }, courts: { list: vi.fn(pending) } },
}));
vi.mock("@/lib/services/bookings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookings")>("@/lib/services/bookings");
  return {
    ...actual,
    bookingsService: {
      operatingHours: { list: vi.fn(pending) },
      exceptions: { list: vi.fn(pending) },
      bookings: { listAll: vi.fn(pending), list: vi.fn(pending) },
      occupations: { list: vi.fn(pending) },
    },
  };
});

import { ClubToday } from "@/components/admin/club-today";

function renderToday() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClubToday clubId="c1" />
    </QueryClientProvider>,
  );
}

describe("Hoy en el club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.can.mockReturnValue(true);
  });

  it("con escritura en reservas: «Nueva reserva» lleva al calendario con el alta abierta", () => {
    renderToday();
    expect(screen.getByRole("link", { name: /Nueva reserva/ })).toHaveAttribute(
      "href",
      "/mi-club/reservas/calendario?nueva=1",
    );
  });

  it("solo lectura: sin «Nueva reserva», pero sí el calendario y la caja", () => {
    accessMock.can.mockImplementation((_area: string, level = "read") => level === "read");
    renderToday();
    expect(screen.queryByRole("link", { name: /Nueva reserva/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir calendario/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Caja del día/ })).toBeInTheDocument();
  });
});
