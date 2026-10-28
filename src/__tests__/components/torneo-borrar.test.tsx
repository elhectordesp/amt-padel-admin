/**
 * Borrar en la ficha del torneo (D12, H02-H04):
 * - el aviso de borrar el torneo ya no dice «no se puede deshacer»: AMT lo
 *   restaura (también con «Deshacer» en el aviso) y un club se lo pide a AMT;
 * - borrar una categoría con datos lo pregunta en el panel con lo que dice el
 *   back que se borra, no con un confirm del navegador.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

const WAIT = { timeout: 5000 };

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/components/admin/header", () => ({ Header: () => null }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
const roleMock = vi.hoisted(() => ({ role: "admin" as "admin" | "club" }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: roleMock.role, clubId: roleMock.role === "club" ? "club-1" : null }),
  isClub: (r: string) => r === "club",
}));

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
    { id: "c-1", gender: "M", level: "4a", totalSpots: 8, occupiedCount: 1, confirmedCount: 0, waitlistCount: 0, currentPhase: "REGISTRATION", price: 20 },
  ],
  schedule: [],
  courts: [],
};
const remove = vi.fn();
const restore = vi.fn().mockResolvedValue({ success: true });
// Los rechazos, sin pasar por vi.fn: con mockRejectedValue vitest daba el
// test por fallido con el propio error, aunque la ficha lo recoge
const removeCategoryCalls: unknown[][] = [];
let removeCategoryError: Error | null = null;
const handlers: Record<string, Record<string, (...args: unknown[]) => unknown>> = {
  tournaments: {
    adminDetail: async () => TOURNAMENT,
    delete: (...args: unknown[]) => remove(...args),
    restore: (...args: unknown[]) => restore(...args),
  },
  categories: {
    remove: (...args: unknown[]) => {
      removeCategoryCalls.push(args);
      const err = removeCategoryError;
      removeCategoryError = null;
      return err ? Promise.reject(err) : Promise.resolve({ success: true });
    },
  },
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TorneoDetailPage />
    </QueryClientProvider>,
  );
}

describe("Ficha del torneo — borrar y restaurar", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleMock.role = "admin";
    removeCategoryCalls.length = 0;
  });

  it("AMT: el aviso dice dónde restaurarlo y, tras borrar, «Deshacer» lo restaura", async () => {
    remove.mockResolvedValue({ success: true });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar torneo" }, WAIT));
    expect(screen.getByText(/Podrás restaurarlo desde Torneos → Eliminados/)).toBeInTheDocument();
    expect(screen.queryByText(/no se puede deshacer/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Torneo eliminado", expect.anything()), WAIT);
    const options = toastMock.success.mock.calls[0][1] as { action: { label: string; onClick: () => void } };
    expect(options.action.label).toBe("Deshacer");
    options.action.onClick();
    await waitFor(() => expect(restore).toHaveBeenCalledWith("t-1"), WAIT);
  });

  it("un club: solo AMT puede restaurarlo, y sin «Deshacer»", async () => {
    roleMock.role = "club";
    remove.mockResolvedValue({ success: true });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar torneo" }, WAIT));
    expect(screen.getByText(/Solo AMT puede restaurarlo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Torneo eliminado", undefined), WAIT);
  });

  it("una categoría con partidos: lo que se borra con ella se confirma en el panel", async () => {
    const message = "La categoría tiene partidos generados. Confirma para borrarla igualmente (se eliminan grupos y partidos con sus resultados).";
    removeCategoryError = new ApiError(message, 400);
    const confirmSpy = vi.spyOn(window, "confirm");
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Eliminar categoría" }, WAIT));
    fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

    expect(await screen.findByText("La categoría tiene datos", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Borrar todo" }));

    await waitFor(() => expect(removeCategoryCalls.at(-1)).toEqual(["t-1", "c-1", true]), WAIT);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
