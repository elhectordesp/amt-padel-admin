/**
 * Inscripciones de la ficha del torneo: una fila sin pareja cuyo titular
 * invitó a alguien desde la app sale «Sin pareja» con la etiqueta
 * «invitada: … (pendiente)», y las filas sin pareja que no están canceladas
 * tienen «Poner pareja» (el modal de cambiar la pareja, que vacía la
 * invitación).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// La ficha es grande: con toda la suite a la vez puede tardar más del segundo
// por defecto de findBy
const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const TOURNAMENT = {
  id: "t-1",
  name: "Open Castellón",
  club: { id: "club-1", name: "Club Castellón", city: "Castellón" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "OPEN",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "F", level: "4a", totalSpots: 8, occupiedCount: 3, waitlistCount: 0, currentPhase: "REGISTRATION" },
  ],
  schedule: [],
  courts: [],
};

const row = (id: string, userId: string, name: string, extra: Record<string, unknown>) => ({
  id,
  tournamentId: "t-1",
  categoryId: "c-1",
  userId,
  user: { name, categoryLevel: "4a", spaPoints: null },
  category: { gender: "F", level: "4a", price: 30 },
  paid: false,
  createdAt: "2026-11-01T10:00:00.000Z",
  ...extra,
});
const REGISTRATIONS = [
  // Ana invitó a Bea desde la app; Bea aún no ha aceptado
  row("reg-ana", "u-ana", "Ana López", {
    status: "PENDING", partnerId: null, partner: null,
    invitedPartnerId: "u-bea", partnerInvitedAt: "2026-11-01T10:00:00.000Z", invitedPartner: { name: "Bea Ruiz" },
  }),
  // Sin pareja y sin invitación (o de un back que aún no la manda)
  row("reg-fani", "u-fani", "Fani Martín", { status: "PENDING", partnerId: null, partner: null }),
  row("reg-carla", "u-carla", "Carla Gil", {
    status: "CONFIRMED", partnerId: "u-dora", partner: { name: "Dora Sanz", categoryLevel: "4a", spaPoints: null },
    invitedPartnerId: null, partnerInvitedAt: null, invitedPartner: null,
  }),
  row("reg-elena", "u-elena", "Elena Pons", { status: "CANCELLED", partnerId: null, partner: null }),
  row("reg-gema", "u-gema", "Gema Vidal", { status: "WAITLIST", partnerId: null, partner: null }),
  // Inscrita por el admin con «Sin pareja»
  row("reg-ines", "u-ines", "Inés Mora", { status: "CONFIRMED", partnerId: null, partner: null, noPartner: true }),
];

const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments:   { adminDetail: async () => TOURNAMENT },
  registrations: { list: async () => REGISTRATIONS },
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

import TorneoDetailPage from "../../../app/(admin)/torneos/[id]/page";

async function openRegistrations() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TorneoDetailPage />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^Inscripciones/ }, WAIT));
  await screen.findByText("Ana López", {}, WAIT);
}

const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLElement;

describe("Inscripciones del torneo — invitación a la pareja", { timeout: 30_000 }, () => {
  it("la fila sin pareja con la invitación pendiente sale sin pareja y con «invitada: … (pendiente)»", async () => {
    await openRegistrations();

    const ana = rowOf("Ana López");
    expect(within(ana).getByText("Sin pareja")).toBeInTheDocument();
    expect(within(ana).getByText("invitada: Bea Ruiz (pendiente)")).toBeInTheDocument();
    // Sin invitación, o con pareja, no hay etiqueta
    expect(within(rowOf("Fani Martín")).queryByText(/invitada:/)).not.toBeInTheDocument();
    expect(within(rowOf("Carla Gil")).queryByText(/invitada:/)).not.toBeInTheDocument();
  });

  it("«Poner pareja» en las filas sin pareja que no están canceladas; «Cambiar pareja» solo con pareja", async () => {
    await openRegistrations();

    expect(within(rowOf("Ana López")).getByTitle("Poner pareja")).toBeInTheDocument();
    expect(within(rowOf("Fani Martín")).getByTitle("Poner pareja")).toBeInTheDocument();
    expect(within(rowOf("Gema Vidal")).getByTitle("Poner pareja")).toBeInTheDocument();
    expect(within(rowOf("Inés Mora")).getByTitle("Poner pareja")).toBeInTheDocument();
    expect(within(rowOf("Elena Pons")).queryByTitle("Poner pareja")).not.toBeInTheDocument();

    const carla = rowOf("Carla Gil");
    expect(within(carla).queryByTitle("Poner pareja")).not.toBeInTheDocument();
    expect(within(carla).getByTitle("Cambiar pareja")).toBeInTheDocument();
    expect(within(rowOf("Ana López")).queryByTitle("Cambiar pareja")).not.toBeInTheDocument();
  });

  it("«Poner pareja» abre el modal de la pareja, que avisa de que la invitación quedará sin efecto", async () => {
    await openRegistrations();

    fireEvent.click(within(rowOf("Ana López")).getByTitle("Poner pareja"));

    expect(await screen.findByRole("heading", { name: "Poner pareja" })).toBeInTheDocument();
    expect(screen.getByText(/quedará sin efecto/).textContent).toBe("La invitación a Bea Ruiz quedará sin efecto.");
  });
});
