/**
 * Portada: la línea «Cuentas: N avisos». Solo con el módulo y `accounts`; no
 * cuenta lo que la portada ya enseña (deudas que avisan, días sin cerrar, poco
 * stock) y lleva al «Resumen».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const access = vi.hoisted(() => ({ can: vi.fn(), accounts: { value: true } }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: access.can }) }));
vi.mock("@/lib/use-accounts-enabled", () => ({ useAccountsEnabled: () => access.accounts.value }));
const svc = vi.hoisted(() => ({ attention: vi.fn() }));
vi.mock("@/lib/services/club-reports", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-reports")>()),
  reportsService: svc,
}));

import { AccountsAttentionLine } from "@/components/admin/accounts-attention-line";

const item = (key: string) => ({
  key, severity: "normal", title: key, count: 1, amountCents: null, href: "/x", details: [],
});

function renderLine() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AccountsAttentionLine clubId="c1" />
    </QueryClientProvider>,
  );
}

describe("AccountsAttentionLine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.can.mockReturnValue(true);
    access.accounts.value = true;
  });

  it("cuenta los avisos que la portada no repite y lleva a «Resumen»", async () => {
    svc.attention.mockResolvedValue({
      items: [
        item("DEBTS_WARN"), item("UNCLOSED_DAYS"), item("LOW_STOCK"),
        item("OVERDUE_FEES"), item("MISSING_RECEIPTS"), item("COACHES_PAY_DUE"),
      ],
    });
    renderLine();
    const link = await screen.findByRole("link", { name: /Cuentas: 3 avisos/ });
    expect(link).toHaveAttribute("href", "/mi-club/cuentas?tab=resumen");
  });

  it("en singular con un solo aviso", async () => {
    svc.attention.mockResolvedValue({ items: [item("OPEN_ACCOUNTS")] });
    renderLine();
    const link = await screen.findByRole("link", { name: /Cuentas: 1 aviso/ });
    expect(link).not.toHaveTextContent("avisos");
  });

  it("si solo hay avisos que la portada ya enseña, no sale", async () => {
    svc.attention.mockResolvedValue({ items: [item("DEBTS_WARN"), item("LOW_STOCK")] });
    renderLine();
    await waitFor(() => expect(svc.attention).toHaveBeenCalled());
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sin el módulo, ni se pide", () => {
    access.accounts.value = false;
    renderLine();
    expect(svc.attention).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("sin el área «accounts» (recepción), ni se pide", () => {
    access.can.mockImplementation((area: string) => area !== "accounts");
    renderLine();
    expect(svc.attention).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
