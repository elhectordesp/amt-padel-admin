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
