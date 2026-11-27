import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/services/admin", () => ({ adminService: { players: { search: vi.fn() } } }));
const svc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), markGuardianConsent: vi.fn() }));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: svc };
});

import { ClubCustomerCreateDialog } from "@/components/admin/club-customer-create-dialog";

const SARA = { id: "k1", name: "Sara Díaz", phone: "600 11 22 33", email: "sara@x.es" };

function renderDialog(onDone = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ClubCustomerCreateDialog open clubId="c1" onClose={() => {}} onDone={onDone} />
    </QueryClientProvider>,
  );
  return onDone;
}

function fill(name: string, phone: string) {
  fireEvent.change(document.querySelector("input:not([type])")!, { target: { value: name } });
  fireEvent.change(document.querySelector('input[type="tel"]')!, { target: { value: phone } });
  fireEvent.click(screen.getByRole("button", { name: "Añadir cliente" }));
}

describe("Nuevo cliente: duplicados", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.create.mockResolvedValue({ id: "nuevo", name: "Sara" });
  });

  it("con el mismo teléfono avisa, no crea y deja abrir la ficha existente", async () => {
    svc.list.mockResolvedValue({ items: [SARA], total: 1, page: 1, pageSize: 20 });
    const onDone = renderDialog();
    fill("Sara Alumna", "600112233");
    expect(await screen.findByText(/Ya hay un cliente con ese teléfono o email/)).toBeInTheDocument();
    expect(svc.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha" }));
    expect(onDone).toHaveBeenCalledWith(SARA);
  });

  it("«Crear de todos modos» sí lo crea", async () => {
    svc.list.mockResolvedValue({ items: [SARA], total: 1, page: 1, pageSize: 20 });
    renderDialog();
    fill("Sara Alumna", "600112233");
    fireEvent.click(await screen.findByRole("button", { name: "Crear de todos modos" }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
  });

  it("sin coincidencia exacta crea sin avisar", async () => {
    svc.list.mockResolvedValue({ items: [{ ...SARA, phone: "699000000" }], total: 1, page: 1, pageSize: 20 });
    renderDialog();
    fill("Sara Alumna", "600112233");
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
  });
});

describe("Nuevo cliente sin teléfono ni email: duplicados por nombre", () => {
  const SARA_SIN_CONTACTO = { id: "k2", name: "Sara Díaz", phone: null, email: null };

  beforeEach(() => {
    vi.clearAllMocks();
    svc.create.mockResolvedValue({ id: "nuevo", name: "Sara" });
  });

  it("con el mismo nombre (sin mirar tildes, mayúsculas ni espacios) avisa, no crea y busca por ese nombre", async () => {
    svc.list.mockResolvedValue({ items: [SARA_SIN_CONTACTO], total: 1, page: 1, pageSize: 20 });
    const onDone = renderDialog();
    fill("  sara   DIAZ ", "");
    expect(await screen.findByText("Ya hay un cliente con ese nombre:")).toBeInTheDocument();
    expect(screen.queryByText(/ese teléfono o email/)).not.toBeInTheDocument();
    expect(svc.list).toHaveBeenCalledWith("c1", { q: "sara diaz", pageSize: 20 });
    expect(svc.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha" }));
    expect(onDone).toHaveBeenCalledWith(SARA_SIN_CONTACTO);
  });

  it("«Crear de todos modos» sí lo crea", async () => {
    svc.list.mockResolvedValue({ items: [SARA_SIN_CONTACTO], total: 1, page: 1, pageSize: 20 });
    renderDialog();
    fill("Sara Díaz", "");
    fireEvent.click(await screen.findByRole("button", { name: "Crear de todos modos" }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith("c1", { name: "Sara Díaz", phone: undefined, email: undefined }));
  });

  it("un nombre solo parecido (el buscador también devuelve los que lo contienen) crea sin avisar", async () => {
    svc.list.mockResolvedValue({
      items: [{ ...SARA_SIN_CONTACTO, name: "Sara Díaz Pérez" }, { ...SARA_SIN_CONTACTO, id: "k3", name: "Rosa Sara Díaz" }],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    renderDialog();
    fill("Sara Díaz", "");
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(screen.queryByText(/Ya hay un cliente/)).not.toBeInTheDocument();
  });

  it("si cambia el nombre, el aviso desaparece y se vuelve a comprobar con el nuevo", async () => {
    svc.list.mockResolvedValue({ items: [SARA_SIN_CONTACTO], total: 1, page: 1, pageSize: 20 });
    renderDialog();
    fill("Sara Díaz", "");
    await screen.findByText("Ya hay un cliente con ese nombre:");
    fireEvent.change(document.querySelector("input:not([type])")!, { target: { value: "Sara Díaz López" } });
    expect(screen.queryByText(/Ya hay un cliente/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Añadir cliente" }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.list).toHaveBeenLastCalledWith("c1", { q: "sara diaz lopez", pageSize: 20 });
  });

  it("si la comprobación falla, no bloquea el alta", async () => {
    svc.list.mockRejectedValue(new Error("sin conexión"));
    renderDialog();
    fill("Sara Díaz", "");
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
  });

  it("con teléfono sigue avisando por el teléfono, no por el nombre", async () => {
    svc.list.mockResolvedValue({ items: [SARA], total: 1, page: 1, pageSize: 20 });
    renderDialog();
    fill("Sara Díaz", "600112233");
    expect(await screen.findByText(/Ya hay un cliente con ese teléfono o email/)).toBeInTheDocument();
    expect(screen.queryByText("Ya hay un cliente con ese nombre:")).not.toBeInTheDocument();
  });
});
