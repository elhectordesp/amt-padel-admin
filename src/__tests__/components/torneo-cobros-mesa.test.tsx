/**
 * Cobros de torneo para la mesa (B4) en la ficha del torneo: el filtro «Sin
 * pagar» con su contador, lo pagado sobre el total de cada pareja, los cobros
 * del torneo sin las canceladas y el 400 PAYMENT_REQUIRED_TO_CONFIRM al
 * confirmar (una o en lote), que se enseña tal cual y sin «Forzar».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

// La ficha es grande: con toda la suite a la vez puede tardar más del segundo
// por defecto de findBy
const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const TOURNAMENT = {
  id: "t-1",
  name: "Open Castellón",
  club: { id: "club-1", name: "Club Castellón", city: "Castellón" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "OPEN",
  tier: "BRONZE",
  requirePaymentToConfirm: true,
  categories: [
    { id: "c-1", gender: "F", level: "4a", totalSpots: 8, occupiedCount: 3, waitlistCount: 1, currentPhase: "REGISTRATION" },
    { id: "c-2", gender: "F", level: "3a", totalSpots: 8, occupiedCount: 0, waitlistCount: 0, currentPhase: "REGISTRATION" },
  ],
  schedule: [],
  courts: [],
};

const row = (id: string, name: string, extra: Record<string, unknown>) => ({
  id,
  tournamentId: "t-1",
  categoryId: "c-1",
  userId: `u-${id}`,
  user: { name, categoryLevel: "4a", spaPoints: null },
  partnerId: null,
  partner: null,
  category: { gender: "F", level: "4a", price: 30 },
  status: "CONFIRMED",
  paid: false,
  createdAt: "2026-11-01T10:00:00.000Z",
  ...extra,
});
const withPartner = (name: string, partnerPaid: boolean) => ({
  partnerId: `u-${name}`, partner: { name, categoryLevel: "4a", spaPoints: null }, partnerPayment: { paid: partnerPaid },
});
const REGISTRATIONS = [
  // Pagada entera: 30 de 30
  row("reg-ana", "Ana López", { paid: true, ...withPartner("Bea Ruiz", true) }),
  // Falta el compañero: 15 de 30
  row("reg-carla", "Carla Gil", { status: "PENDING", paid: true, ...withPartner("Dora Sanz", false) }),
  // Sin pareja y sin pagar, en otra categoría más barata: 0 de 20
  row("reg-elena", "Elena Pons", { status: "WAITLIST", categoryId: "c-2", category: { gender: "F", level: "3a", price: 20 } }),
  // Cancelada: ni cuenta en «Sin pagar» ni en los totales
  row("reg-fani", "Fani Martín", { status: "CANCELLED", ...withPartner("Gema Vidal", false) }),
  // Sin pareja y con el titular pagado: no le falta nadie por pagar (15 de 30)
  row("reg-ines", "Inés Mora", { paid: true }),
];

const bulkStatus = vi.fn();
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments:   { adminDetail: async () => TOURNAMENT },
  registrations: { list: async () => REGISTRATIONS, bulkStatus },
};
// El resto de llamadas de la ficha: listas vacías
vi.mock("@/lib/services/admin", () => ({
  adminService: new Proxy({}, {
    get: (_t, ns: string) =>
      new Proxy({}, { get: (_s, fn: string) => handlers[ns]?.[fn] ?? (async () => []) }),
  }),
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import { invalidateRegistrations } from "@/lib/services/admin";
import TorneoDetailPage from "../../../app/(admin)/torneos/[id]/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TorneoDetailPage />
    </QueryClientProvider>,
  );
}

async function openRegistrations() {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: /^Inscripciones/ }, WAIT));
  await screen.findByText("Ana López", {}, WAIT);
}

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

describe("Inscripciones del torneo — cobros para la mesa (B4)", { timeout: 30_000 }, () => {
  beforeEach(() => vi.clearAllMocks());

  it("«Sin pagar (2)»: las no canceladas a las que les falta pagar a alguno de sus jugadores", async () => {
    await openRegistrations();

    fireEvent.click(screen.getByRole("button", { name: "Sin pagar (2)" }));

    await waitFor(() => expect(screen.queryByText("Ana López")).not.toBeInTheDocument(), WAIT);
    expect(screen.getByText("Carla Gil")).toBeInTheDocument();
    expect(screen.getByText("Elena Pons")).toBeInTheDocument();
    expect(screen.queryByText("Fani Martín")).not.toBeInTheDocument();
    expect(screen.queryByText("Inés Mora")).not.toBeInTheDocument();
  });

  it("cada pareja lleva lo pagado sobre su total y arriba van los cobros del torneo sin las canceladas", async () => {
    await openRegistrations();

    const amountOf = (name: string) => within(rowOf(name)).getByTitle("Pagado / total de la pareja");
    expect(amountOf("Ana López")).toHaveTextContent("30,00 € / 30,00 €");
    expect(amountOf("Carla Gil")).toHaveTextContent("15,00 € / 30,00 €");
    expect(amountOf("Elena Pons")).toHaveTextContent("0,00 € / 20,00 €");
    expect(amountOf("Inés Mora")).toHaveTextContent("15,00 € / 30,00 €");

    const totals = screen.getByRole("group", { name: "Cobros del torneo" });
    expect(totals).toHaveTextContent("Cobrado 60,00 €");
    expect(totals).toHaveTextContent("Pendiente 50,00 €");
    expect(totals).toHaveTextContent("Total 110,00 €");
  });

  it("confirmar una que no ha pagado: el 400 del back tal cual, sin «Forzar»", async () => {
    const message = "El torneo exige el pago para confirmar. Falta por pagar: Dora Sanz.";
    bulkStatus.mockRejectedValueOnce(new ApiError(message, 400, "PAYMENT_REQUIRED_TO_CONFIRM"));
    await openRegistrations();

    fireEvent.click(within(rowOf("Carla Gil")).getByTitle("Confirmar pareja"));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(message), WAIT);
    expect(bulkStatus).toHaveBeenCalledWith(["reg-carla"], "CONFIRMED", undefined);
    // El aforo se puede forzar; el pago no
    expect(screen.queryByText("¿Forzar el cambio?")).not.toBeInTheDocument();
    expect(bulkStatus).toHaveBeenCalledTimes(1);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(invalidateRegistrations).not.toHaveBeenCalled();
    expect(within(rowOf("Carla Gil")).getByTitle("Confirmar pareja")).toBeEnabled();
  });

  it("en lote: el 400 nombra a quién falta, no se confirma ninguna y no ofrece «Forzar»", async () => {
    const message = "El torneo exige el pago para confirmar. Falta por pagar: Dora Sanz; Elena Pons. No se ha confirmado ninguna.";
    bulkStatus.mockRejectedValueOnce(new ApiError(message, 400, "PAYMENT_REQUIRED_TO_CONFIRM"));
    await openRegistrations();

    // La casilla de cada fila es el primer botón de la fila
    fireEvent.click(within(rowOf("Carla Gil")).getAllByRole("button")[0]);
    fireEvent.click(within(rowOf("Elena Pons")).getAllByRole("button")[0]);
    const bulkBar = screen.getByText("2 pareja(s) seleccionada(s)").parentElement!;
    fireEvent.click(within(bulkBar).getByRole("button", { name: "Confirmar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, confirmar" }, WAIT));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(message), WAIT);
    expect(bulkStatus).toHaveBeenCalledWith(["reg-carla", "reg-elena"], "CONFIRMED", undefined);
    expect(bulkStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Forzar el cambio?")).not.toBeInTheDocument();
    expect(invalidateRegistrations).not.toHaveBeenCalled();
  });
});
