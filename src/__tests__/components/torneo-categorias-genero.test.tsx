/**
 * Los cinco géneros de categoría en la ficha del torneo (D2): «Añadir» ofrece
 * masculina, femenina, mixta, general y junior y manda el elegido, y una
 * categoría mixta sale como tal (antes, todo lo que no era masculina era
 * «Fem.»).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));

const TOURNAMENT = {
  id: "t-1",
  name: "Open de otoño",
  club: { id: "club-1", name: "Club Madrid", city: "Madrid" },
  startDate: "2026-11-20T00:00:00.000Z",
  endDate: "2026-11-22T00:00:00.000Z",
  timezone: "Europe/Madrid",
  status: "OPEN",
  tier: "BRONZE",
  categories: [
    { id: "c-1", gender: "MX", level: "3a", totalSpots: 8, occupiedCount: 2, confirmedCount: 0, waitlistCount: 0, currentPhase: "REGISTRATION", price: 20 },
  ],
  schedule: [],
  courts: [],
};
const add = vi.fn(async () => ({}));
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: { adminDetail: async () => TOURNAMENT },
  categories:  { add },
};
vi.mock("@/lib/services/admin", () => ({
  adminService: new Proxy({}, {
    get: (_t, ns: string) =>
      new Proxy({}, { get: (_s, fn: string) => handlers[ns]?.[fn] ?? (async () => []) }),
  }),
  invalidateRegistrations: vi.fn(),
  registrationsQK: { list: (id: string) => ["registrations", id] },
}));

import TorneoDetailPage from "../../../app/(admin)/torneos/[id]/page";

describe("Ficha del torneo — género de las categorías", { timeout: 30_000 }, () => {
  it("la mixta sale como mixta y «Añadir» crea una general", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TorneoDetailPage />
      </QueryClientProvider>,
    );

    const box = (await screen.findByRole("heading", { name: "Categorías" }, WAIT)).closest("div")!.parentElement!;
    expect(within(box).getByText("Mixta 3ª")).toBeInTheDocument();
    expect(within(box).queryByText(/Fem\./)).not.toBeInTheDocument();

    fireEvent.click(within(box).getByRole("button", { name: /Añadir/ }));
    const gender = within(box).getByDisplayValue("Masculina") as HTMLSelectElement;
    expect([...gender.options].map((o) => o.text)).toEqual(["Masculina", "Femenina", "Mixta", "General", "Junior"]);
    fireEvent.change(gender, { target: { value: "G" } });
    fireEvent.click(within(box).getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(add).toHaveBeenCalledTimes(1), WAIT);
    expect(add).toHaveBeenCalledWith("t-1", expect.objectContaining({ gender: "G", level: "3a" }));
  });
});
