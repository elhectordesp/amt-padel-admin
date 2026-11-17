/**
 * Listado de ligas (`/ligas`): es el de torneos con kind=LEAGUE. Cada pantalla
 * pide lo suyo y sus enlaces cuelgan de su raíz.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const nav = vi.hoisted(() => ({ pathname: "/ligas" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => nav.pathname,
}));
vi.mock("@/lib/use-role", () => ({ useRole: () => ({ role: "admin", clubId: null }) }));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/admin/deleted-tournaments", () => ({ DeletedTournaments: () => <p>papelera</p> }));

const base = {
  tier: "BRONZE",
  status: "DRAFT",
  club: { id: "c1", name: "Club Madrid", city: "Madrid" },
  startDate: "2099-12-01T00:00:00.000Z",
  endDate: "2100-03-01T00:00:00.000Z",
  categories: [],
};
const list = vi.fn(async () => [{ ...base, id: "t1", name: "Open de primavera", kind: "TOURNAMENT" }]);
const listLeagues = vi.fn(async () => [{ ...base, id: "l1", name: "Liga de invierno", kind: "LEAGUE" }]);
vi.mock("@/lib/services/admin", () => ({
  adminService: { tournaments: { list: () => list(), listLeagues: () => listLeagues(), duplicate: vi.fn() } },
}));

import TorneosPage from "../../../app/(admin)/torneos/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TorneosPage />
    </QueryClientProvider>,
  );
}

describe("Listado de ligas y de torneos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("/ligas lista las ligas, con su botón y sus enlaces en /ligas, y sin la papelera de torneos", async () => {
    nav.pathname = "/ligas";
    renderPage();
    expect((await screen.findAllByText("Liga de invierno")).length).toBeGreaterThan(0);
    expect(listLeagues).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
    expect(screen.getByText("Ligas")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Nueva liga/ })[0]).toHaveAttribute("href", "/ligas/nuevo");
    expect(screen.getAllByRole("link", { name: /Ver/ })[0]).toHaveAttribute("href", "/ligas/l1");
    expect(screen.queryByText("papelera")).toBeNull();
  });

  it("/torneos sigue listando solo torneos", async () => {
    nav.pathname = "/torneos";
    renderPage();
    expect((await screen.findAllByText("Open de primavera")).length).toBeGreaterThan(0);
    expect(list).toHaveBeenCalledTimes(1);
    expect(listLeagues).not.toHaveBeenCalled();
    expect(screen.getAllByRole("link", { name: /Nuevo torneo/ })[0]).toHaveAttribute("href", "/torneos/nuevo");
    expect(screen.getByText("papelera")).toBeInTheDocument();
  });
});
