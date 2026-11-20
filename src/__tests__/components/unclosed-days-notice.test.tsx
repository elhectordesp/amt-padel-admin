/**
 * «Días sin cerrar» de la portada: los días con cobros y sin cierre de caja,
 * con enlace a la caja de cada uno. Solo con el módulo «Cuentas» y con acceso a
 * la caja.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ enabled: true, canCash: true }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => access.enabled }));
vi.mock("@/lib/use-club-access", () => ({
  useClubAccess: () => ({ roles: ["OWNER"], can: () => access.canCash }),
}));
const unclosed = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/cash-closure", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/cash-closure")>()),
  cashClosureService: { unclosed },
}));

import { UnclosedDaysNotice } from "@/components/admin/unclosed-days-notice";

function renderNotice() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <UnclosedDaysNotice clubId="club-1" />
    </QueryClientProvider>,
  );
}

describe("UnclosedDaysNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.enabled = true;
    access.canCash = true;
  });

  it("lista los días sin cerrar con su total y el enlace a la caja de ese día", async () => {
    unclosed.mockResolvedValue([
      { date: "2026-11-19", totalCents: 5000 },
      { date: "2026-11-16", totalCents: 700 },
    ]);
    renderNotice();
    expect(await screen.findByText("Días sin cerrar")).toBeInTheDocument();
    expect(unclosed).toHaveBeenCalledWith("club-1", 14);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/caja?dia=2026-11-19", "/caja?dia=2026-11-16"]);
    expect(links[0]).toHaveTextContent("Jueves, 19 de noviembre");
    expect(links[0]).toHaveTextContent("50,00 € cobrados");
  });

  it("sin días pendientes no sale", async () => {
    unclosed.mockResolvedValue([]);
    renderNotice();
    await vi.waitFor(() => expect(unclosed).toHaveBeenCalled());
    expect(screen.queryByText("Días sin cerrar")).not.toBeInTheDocument();
  });

  it("sin el módulo o sin acceso a la caja, no pide nada", () => {
    access.enabled = false;
    renderNotice();
    access.enabled = true;
    access.canCash = false;
    renderNotice();
    expect(unclosed).not.toHaveBeenCalled();
    expect(screen.queryByText("Días sin cerrar")).not.toBeInTheDocument();
  });
});
