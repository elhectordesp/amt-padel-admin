/**
 * Pestaña Administradores (D4): todos ven la lista; invitar, cambiar el rol y
 * revocar solo el Super Admin, y nunca sobre sí mismo. Si el back no dice el
 * rol (versión anterior), los botones salen y decide el back.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

const adminMock = vi.hoisted(() => ({
  me: vi.fn(),
  admins: {
    list:       vi.fn(),
    invite:     vi.fn(),
    updateRole: vi.fn(),
    revoke:     vi.fn(),
  },
}));
vi.mock("@/lib/services/admin", () => ({ adminService: adminMock }));

import { AdminsTab } from "../../../components/admin/admins-tab";

const ADMINS = [
  { id: "super-1", name: "Sara Super", email: "sara@x.com", role: "SUPERADMIN", createdAt: "2026-01-01", pendingActivation: false },
  { id: "admin-1", name: "Ana Admin",  email: "ana@x.com",  role: "ADMIN",      createdAt: "2026-02-01", pendingActivation: true  },
];

function renderTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AdminsTab />
    </QueryClientProvider>,
  );
}

const rowOf = (name: string) => screen.getByText(name).closest("tr")!;

describe("AdminsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock.admins.list.mockResolvedValue(ADMINS);
  });

  it("un Admin ve la lista pero no puede invitar, cambiar el rol ni revocar", async () => {
    adminMock.me.mockResolvedValue({ id: "admin-1", name: "Ana Admin", role: "ADMIN" });
    renderTab();

    expect(await screen.findByText(/Solo un Super Admin puede/)).toBeInTheDocument();
    expect(screen.getByText("Sara Super")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Invitar administrador/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cambiar rol/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revocar/ })).not.toBeInTheDocument();
    // La etiqueta de quien aún no ha puesto su contraseña
    expect(within(rowOf("Ana Admin")).getByText("(pendiente de activar)")).toBeInTheDocument();
  });

  it("el Super Admin gestiona a los demás, pero no a sí mismo", async () => {
    adminMock.me.mockResolvedValue({ id: "super-1", name: "Sara Super", role: "SUPERADMIN" });
    renderTab();

    expect(await screen.findByRole("button", { name: /Invitar administrador/ })).toBeInTheDocument();
    await waitFor(() => expect(within(rowOf("Ana Admin")).getByRole("button", { name: /Revocar/ })).toBeInTheDocument());
    expect(within(rowOf("Ana Admin")).getByRole("button", { name: /Cambiar rol/ })).toBeInTheDocument();
    const ownRow = rowOf("Sara Super");
    expect(within(ownRow).getByText("(tú)")).toBeInTheDocument();
    expect(within(ownRow).queryByRole("button", { name: /Revocar/ })).not.toBeInTheDocument();
    expect(within(ownRow).queryByRole("button", { name: /Cambiar rol/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Solo un Super Admin puede/)).not.toBeInTheDocument();
  });

  it("si el back no dice el rol (versión anterior), salen los botones y decide el back", async () => {
    adminMock.me.mockResolvedValue({ id: "admin-1", name: "Ana Admin" });
    renderTab();

    expect(await screen.findByRole("button", { name: /Invitar administrador/ })).toBeInTheDocument();
    expect(screen.queryByText(/Solo un Super Admin puede/)).not.toBeInTheDocument();
  });

  it("«Cambiar rol» manda el rol destino y el aviso usa el que devuelve el back", async () => {
    adminMock.me.mockResolvedValue({ id: "super-1", name: "Sara Super", role: "SUPERADMIN" });
    adminMock.admins.updateRole.mockResolvedValue({ id: "admin-1", role: "SUPERADMIN" });
    renderTab();

    fireEvent.click(await within(await waitFor(() => rowOf("Ana Admin"))).findByRole("button", { name: /Cambiar rol/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Pasar a Super Admin" }));

    await waitFor(() => expect(adminMock.admins.updateRole).toHaveBeenCalledWith("admin-1", "SUPERADMIN"));
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Ana Admin ahora es Super Admin"));
  });

  it("reinvitar a un admin pendiente con otro rol avisa de que se queda con el suyo", async () => {
    adminMock.me.mockResolvedValue({ id: "super-1", name: "Sara Super", role: "SUPERADMIN" });
    adminMock.admins.invite.mockResolvedValue({ id: "admin-1", name: "Ana Admin", email: "ana@x.com", role: "ADMIN" });
    renderTab();

    fireEvent.click(await screen.findByRole("button", { name: /Invitar administrador/ }));
    fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByPlaceholderText("Apellidos"), { target: { value: "Admin" } });
    fireEvent.change(screen.getByPlaceholderText("admin@email.com"), { target: { value: "ana@x.com" } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "SUPERADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: /^Invitar$/ }));

    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith(expect.stringContaining("ya era Admin")));
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
