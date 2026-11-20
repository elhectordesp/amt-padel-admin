import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const me = vi.fn();
const getToken = vi.fn();
vi.mock("@/lib/api", () => ({ getToken: () => getToken() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { me: () => me() } }));

import { useMe } from "@/lib/use-me";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useMe", () => {
  beforeEach(() => { me.mockReset().mockResolvedValue({ id: "u1" }); getToken.mockReset(); });

  it("sin sesión no pide /auth/me (su 401 recargaba /login en bucle)", async () => {
    getToken.mockReturnValue(null);
    renderHook(() => useMe(), { wrapper });
    await new Promise((r) => setTimeout(r, 30));
    expect(me).not.toHaveBeenCalled();
  });

  it("con sesión sí lo pide", async () => {
    getToken.mockReturnValue("tok");
    renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(me).toHaveBeenCalled());
  });
});
