/**
 * Ficha de un cliente del club: quien escribe los clientes la edita (contacto de
 * quien no tiene la app, socio, etiquetas, notas) y la archiva; quien solo los
 * lee (Torneos) la ve entera, sin formularios ni botones.
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
// Los bonos tienen sus propios tests: aquí solo importa la ficha
vi.mock("@/components/admin/customer-vouchers-section", () => ({ CustomerVouchersSection: () => null }));
const service = vi.hoisted(() => ({ detail: vi.fn(), tags: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn() }));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: service };
});

import ClienteDetailPage from "../../../app/(admin)/mi-club/clientes/[id]/page";
import { ME_QUERY_KEY } from "@/lib/use-me";

const ANA = {
  id: "cc-1", clubId: "c1", userId: null, hasAccount: false, name: "Ana Pérez", phone: "600111222", email: null,
  isMember: true, memberNumber: "042", memberSince: "2026-01-10", notes: "Prefiere las tardes", tags: ["profe"],
  source: "MANUAL", archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", messagesOptOutAt: null,
  bookings: [], registrations: [],
};

const asRole = (role: string) => ({
  id: "staff", name: "Equipo", activeClubId: "c1",
  clubs: [{ clubId: "c1", clubName: "Club Centro", roles: [role] }],
});

async function renderPage(me: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(ME_QUERY_KEY, me);
  await act(async () => {
    render(
      <QueryClientProvider client={qc}>
        <Suspense fallback={null}>
          <ClienteDetailPage params={Promise.resolve({ id: "cc-1" })} />
        </Suspense>
      </QueryClientProvider>,
    );
  });
}

describe("Ficha de un cliente del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.detail.mockResolvedValue(ANA);
    service.tags.mockResolvedValue(["profe"]);
  });

  it("con escritura (Recepción): archivar y guardar contacto, socio y notas, y se editan las etiquetas", async () => {
    await renderPage(asRole("RECEPTION"));
    expect(await screen.findByRole("button", { name: /Archivar cliente/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar contacto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar socio/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar notas/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Añadir etiqueta")).toBeInTheDocument();
  });

  it("con un rol de solo lectura (Torneos): ve el contacto, el socio, las etiquetas y las notas, sin botones ni formularios", async () => {
    await renderPage(asRole("TOURNAMENTS"));
    // Lo que se lee (el nombre sale en la cabecera y en el contacto)
    expect(await screen.findByText("600111222")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Pérez")).toHaveLength(2);
    expect(screen.getByText("042")).toBeInTheDocument();
    expect(screen.getByText("10/1/2026")).toBeInTheDocument();
    expect(screen.getByText("profe")).toBeInTheDocument();
    expect(screen.getByText("Prefiere las tardes")).toBeInTheDocument();
    // Lo que escribe, fuera
    for (const name of [/Archivar cliente|Recuperar cliente/, /Guardar contacto/, /Guardar socio/, /Guardar notas/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Añadir etiqueta")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Notas privadas del club")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Es socio/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sin notas, quien solo lee lo dice", async () => {
    service.detail.mockResolvedValue({ ...ANA, notes: null });
    await renderPage(asRole("TOURNAMENTS"));
    expect(await screen.findByText("Sin notas.")).toBeInTheDocument();
  });
});
