/**
 * Importar clientes: elegir el CSV lanza la vista previa (dry-run) sin guardar,
 * y solo «Importar» confirma. Los errores del servidor se enseñan.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const service = vi.hoisted(() => ({ importCsv: vi.fn() }));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: service };
});

import { ClubCustomerImportDialog } from "@/components/admin/club-customer-import-dialog";

const PREVIEW = {
  total: 4, toCreate: 2, created: 0,
  duplicates: [{ line: 3, reason: "Ya existe un cliente con ese email" }],
  errors: [{ line: 5, message: "El email no es válido" }],
};
const WAIT = { timeout: 5000 };

function renderDialog(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ClubCustomerImportDialog open clubId="c1" onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}
const pick = (name: string) =>
  fireEvent.change(screen.getByLabelText("Fichero CSV"), {
    target: { files: [new File(["nombre;email\nAna;a@b.es"], name, { type: "text/csv" })] },
  });

beforeEach(() => vi.resetAllMocks());

describe("ClubCustomerImportDialog", () => {
  it("vista previa con dry-run y confirmación aparte", async () => {
    service.importCsv.mockResolvedValueOnce(PREVIEW).mockResolvedValueOnce({ ...PREVIEW, created: 2 });
    renderDialog();
    pick("clientes.csv");

    await screen.findByText("2 de 4 filas entrarán.", {}, WAIT);
    expect(service.importCsv).toHaveBeenCalledTimes(1);
    expect(service.importCsv.mock.calls[0][2]).toBe(true);
    expect(screen.getByText(/Línea 3: Ya existe un cliente/)).toBeTruthy();
    expect(screen.getByText(/Línea 5: El email no es válido/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Importar 2 clientes/ }));
    await screen.findByText("Importación terminada: 2 clientes añadidos.", {}, WAIT);
    expect(service.importCsv.mock.calls[1][2]).toBe(false);
  });

  it("un fichero que no es .csv ni llega al servidor", () => {
    renderDialog();
    pick("clientes.xlsx");
    expect(screen.getByRole("alert").textContent).toMatch(/\.csv/);
    expect(service.importCsv).not.toHaveBeenCalled();
  });

  it("enseña el error del servidor", async () => {
    service.importCsv.mockRejectedValueOnce(new Error("Falta la columna «nombre» en la cabecera"));
    renderDialog();
    pick("clientes.csv");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/nombre/), WAIT);
  });
});
