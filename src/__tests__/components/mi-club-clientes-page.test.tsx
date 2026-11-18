/**
 * Clientes del club (A5): el listado pide al servidor lo que se busca y filtra,
 * "Nuevo cliente" da de alta a quien no tiene la app, y las etiquetas se
 * añaden sin repetir.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const service = vi.hoisted(() => ({
  list: vi.fn(),
  tags: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: service };
});

import ClientesPage from "../../../app/(admin)/mi-club/clientes/page";
import { TagInput } from "@/components/admin/tag-input";
import { ME_QUERY_KEY } from "@/lib/use-me";

const asRole = (role: string) => ({
  id: "staff", name: "Equipo", activeClubId: "c1",
  clubs: [{ clubId: "c1", clubName: "Club Centro", roles: [role] }],
});

const ANA = {
  id: "cc-1", clubId: "c1", userId: null, hasAccount: false, name: "Ana Pérez", phone: "600111222", email: null,
  isMember: true, memberNumber: "042", memberSince: "2026-01-10", notes: null, tags: ["profe"],
  source: "MANUAL", archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z",
};

// me: la cuenta del equipo con sus roles en el club (en la caché, como la deja el panel al entrar)
function renderPage(me?: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (me) qc.setQueryData(ME_QUERY_KEY, me);
  return render(
    <QueryClientProvider client={qc}>
      <ClientesPage />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };

describe("Clientes del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.list.mockResolvedValue({ items: [ANA], total: 1, page: 1, pageSize: 50 });
    service.tags.mockResolvedValue(["profe"]);
    service.create.mockResolvedValue({ ...ANA, id: "cc-2" });
  });

  it("lista los clientes con su socio y etiquetas, y la búsqueda se pide al servidor", async () => {
    renderPage();
    expect(await screen.findByText("Ana Pérez", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Socio 042")).toBeInTheDocument();
    expect(service.list).toHaveBeenCalledWith("c1", expect.objectContaining({ page: 1 }));

    fireEvent.change(screen.getByLabelText("Buscar clientes"), { target: { value: "ana" } });
    await waitFor(() => expect(service.list).toHaveBeenCalledWith("c1", expect.objectContaining({ q: "ana", page: 1 })), WAIT);
  });

  it("Nuevo cliente: sin teléfono ni email no se manda; con nombre y teléfono, se da de alta", async () => {
    renderPage();
    await screen.findByText("Ana Pérez", {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Nuevo cliente/ }));

    const dialog = screen.getByRole("dialog", { name: "Nuevo cliente" });
    const [name, phone] = within(dialog).getAllByRole("textbox");
    const submit = () => fireEvent.click(within(dialog).getByRole("button", { name: "Añadir cliente" }));

    fireEvent.change(name, { target: { value: "  Luis Gómez " } });
    submit();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("teléfono o un email");
    expect(service.create).not.toHaveBeenCalled();

    fireEvent.change(phone, { target: { value: " 699000111 " } });
    submit();
    await waitFor(() => expect(service.create).toHaveBeenCalledWith("c1", { name: "Luis Gómez", phone: "699000111", email: undefined }), WAIT);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/mi-club/clientes/cc-2"), WAIT);
  });

  it("con un rol de solo lectura (Torneos) se ven los clientes, sin «Nuevo cliente» ni «Importar»", async () => {
    renderPage(asRole("TOURNAMENTS"));
    expect(await screen.findByText("Ana Pérez", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nuevo cliente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Importar/ })).not.toBeInTheDocument();
  });

  it("con escritura (Recepción) están «Nuevo cliente» e «Importar»", async () => {
    renderPage(asRole("RECEPTION"));
    await screen.findByText("Ana Pérez", {}, WAIT);
    expect(screen.getByRole("button", { name: /Nuevo cliente/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar/ })).toBeInTheDocument();
  });
});

describe("TagInput", () => {
  it("añade con Intro, no repite sin distinguir mayúsculas y quita con la x", () => {
    const onChange = vi.fn();
    const { rerender } = render(<TagInput tags={["profe"]} suggestions={["nivel 3"]} onChange={onChange} />);
    const input = screen.getByLabelText("Añadir etiqueta");

    fireEvent.change(input, { target: { value: "Profe" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "  nivel   3 " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["profe", "nivel 3"]);

    rerender(<TagInput tags={["profe"]} suggestions={["nivel 3"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "nivel 3" }));
    expect(onChange).toHaveBeenLastCalledWith(["profe", "nivel 3"]);

    fireEvent.click(screen.getByRole("button", { name: "Quitar la etiqueta profe" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("de solo lectura enseña las etiquetas sin quitarlas, sin campo y sin sugerencias", () => {
    render(<TagInput tags={["profe"]} suggestions={["nivel 3"]} onChange={vi.fn()} readOnly />);
    expect(screen.getByText("profe")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Quitar la etiqueta/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Añadir etiqueta")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "nivel 3" })).not.toBeInTheDocument();
  });
});
