/**
 * Catálogo de bonos (pestaña «Bonos» de Precios, B14): alta y edición con el
 * precio escrito en euros y guardado en céntimos, sin caducidad si los días
 * van vacíos, baja y reactivación, y borrado con confirmación. Sin permiso de
 * escritura en la configuración, solo se lee.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const accessMock = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: accessMock.can }) }));

const svc = vi.hoisted(() => ({
  types: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/services/club-vouchers", async (orig) => ({
  ...(await orig<typeof import("@/lib/services/club-vouchers")>()),
  clubVouchersService: svc,
}));

import { VoucherTypesSection } from "@/components/admin/voucher-types-section";
import { toast } from "sonner";

const T1 = { id: "t1", clubId: "c1", name: "Bono 10", kind: "COURT", sessions: 10, priceCents: 12000, validDays: 90, active: true };
const T2 = { id: "t2", clubId: "c1", name: "Bono 5", kind: "PRIVATE_CLASS", sessions: 5, priceCents: 6500, validDays: null, active: false };

function renderSection() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <VoucherTypesSection clubId="c1" />
    </QueryClientProvider>,
  );
}

async function fillAndSave(values: { name?: string; sessions?: string; price?: string; validDays?: string }) {
  const dialog = within(await screen.findByRole("dialog"));
  if (values.name !== undefined) fireEvent.change(dialog.getByLabelText("Nombre"), { target: { value: values.name } });
  if (values.sessions !== undefined) fireEvent.change(dialog.getByLabelText("Sesiones (reservas)"), { target: { value: values.sessions } });
  if (values.price !== undefined) fireEvent.change(dialog.getByLabelText("Precio del bono (€)"), { target: { value: values.price } });
  if (values.validDays !== undefined) fireEvent.change(dialog.getByLabelText("Días de validez desde la venta"), { target: { value: values.validDays } });
  fireEvent.click(dialog.getByRole("button", { name: "Guardar bono" }));
}

describe("VoucherTypesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessMock.can.mockReturnValue(true);
    svc.types.list.mockResolvedValue([T1, T2]);
    svc.types.create.mockResolvedValue(T1);
    svc.types.update.mockResolvedValue(T1);
    svc.types.remove.mockResolvedValue(undefined);
  });

  it("lista los tipos con sesiones, precio y validez; el dado de baja, marcado", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    expect(screen.getByText(/10 sesiones · 120,00 € · 90 días/)).toBeInTheDocument();
    expect(screen.getByText(/5 sesiones · 65,00 € · Sin caducidad/)).toBeInTheDocument();
    expect(screen.getByText("De baja")).toBeInTheDocument();
  });

  it("cada tipo dice para qué se gasta: reservas de pista o clases privadas", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    expect(screen.getByText(/Reservas de pista · 10 sesiones/)).toBeInTheDocument();
    expect(screen.getByText(/Clases privadas · 5 sesiones/)).toBeInTheDocument();
  });

  it("un bono de clases privadas: el tipo elegido va en lo que se manda", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo bono/ }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Tipo de bono"), { target: { value: "PRIVATE_CLASS" } });
    // Con el tipo, la etiqueta de las sesiones pasa a ser de clases
    fireEvent.change(dialog.getByLabelText("Sesiones (clases)"), { target: { value: "8" } });
    fireEvent.change(dialog.getByLabelText("Nombre"), { target: { value: "Bono 8 clases" } });
    fireEvent.change(dialog.getByLabelText("Precio del bono (€)"), { target: { value: "200" } });
    fireEvent.click(dialog.getByRole("button", { name: "Guardar bono" }));
    await waitFor(() =>
      expect(svc.types.create).toHaveBeenCalledWith("c1", {
        name: "Bono 8 clases",
        kind: "PRIVATE_CLASS",
        sessions: 8,
        priceCents: 20000,
        validDays: null,
      }),
    );
  });

  it("un bono nuevo: el precio en euros sale en céntimos y los días vacíos, sin caducidad", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo bono/ }));
    await fillAndSave({ name: "Bono 20", sessions: "20", price: "210,50", validDays: "" });
    await waitFor(() =>
      expect(svc.types.create).toHaveBeenCalledWith("c1", { name: "Bono 20", kind: "COURT", sessions: 20, priceCents: 21050, validDays: null }),
    );
    expect(toast.success).toHaveBeenCalledWith("Bono creado");
  });

  it("un dato mal escrito no se manda y se dice cuál", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByRole("button", { name: /Nuevo bono/ }));
    await fillAndSave({ name: "Bono", sessions: "101", price: "50" });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("entre 1 y 100")));
    expect(svc.types.create).not.toHaveBeenCalled();
  });

  it("editar carga los valores del tipo y manda el cambio a ese tipo", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByRole("button", { name: "Editar Bono 10" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText("Precio del bono (€)")).toHaveValue("120");
    expect(dialog.getByLabelText("Días de validez desde la venta")).toHaveValue(90);
    await fillAndSave({ price: "99" });
    await waitFor(() =>
      expect(svc.types.update).toHaveBeenCalledWith("c1", "t1", { name: "Bono 10", kind: "COURT", sessions: 10, priceCents: 9900, validDays: 90 }),
    );
  });

  it("dar de baja y reactivar", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    await waitFor(() => expect(svc.types.update).toHaveBeenCalledWith("c1", "t1", { active: false }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));
    await waitFor(() => expect(svc.types.update).toHaveBeenCalledWith("c1", "t2", { active: true }));
  });

  it("borrar pide confirmación y avisa de que lo vendido se conserva", async () => {
    renderSection();
    await screen.findByText("Bono 10");
    fireEvent.click(screen.getByRole("button", { name: "Borrar Bono 10" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/Los bonos ya vendidos conservan su nombre, sesiones, precio y saldo/)).toBeInTheDocument();
    expect(svc.types.remove).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Borrar bono" }));
    await waitFor(() => expect(svc.types.remove).toHaveBeenCalledWith("c1", "t1"));
  });

  it("sin permiso de escritura en la configuración, se lee pero no hay botones", async () => {
    accessMock.can.mockImplementation((_area: string, level = "read") => level === "read");
    renderSection();
    await screen.findByText("Bono 10");
    expect(screen.queryByRole("button", { name: /Nuevo bono/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dar de baja" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Bono 10" })).not.toBeInTheDocument();
    expect(accessMock.can).toHaveBeenCalledWith("settings", "write");
  });
});
