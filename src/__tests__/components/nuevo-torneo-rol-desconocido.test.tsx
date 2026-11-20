import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/torneos/nuevo",
}));
// El rol sale del token tras el primer pintado: al principio es null
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: null, clubId: null }),
  isClub: (r: string | null) => r === "club",
}));
vi.mock("@/components/admin/header", () => ({ Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/admin/tournament-image-uploader", () => ({ TournamentImageUploader: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const list = vi.fn(async () => []);
vi.mock("@/lib/services/admin", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/admin")>("@/lib/services/admin");
  return {
    ...actual,
    adminService: {
      tournaments: { create: vi.fn() },
      clubs: { list: () => list(), findOne: vi.fn() },
      clubTournamentConfig: { get: vi.fn() },
    },
  };
});

import NuevoTorneoPage from "../../../app/(admin)/torneos/nuevo/page";

describe("Nuevo torneo: antes de conocer el rol", () => {
  it("no pide el listado de clubes de AMT (un club recibía un 403)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NuevoTorneoPage />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(list).not.toHaveBeenCalled();
  });
});
