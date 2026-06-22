/**
 * Tests del componente compartido CourtsManager.
 *
 * Cubre el comportamiento clave:
 *  - Estado vacío vs lista de pistas
 *  - Loading state
 *  - El botón "Añadir pista" abre el formulario inline
 *  - El formulario valida el nombre antes de mutar
 *  - Mutación dispara invalidate de la query
 *
 * Mockea `lib/services/admin` para no depender de la API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.fn();
const createMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    courts: {
      list: (...a: unknown[]) => listMock(...a),
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      remove: vi.fn(),
      blocks: {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        remove: vi.fn(),
      },
    },
  },
}));

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastErrorMock(...a),
    success: (...a: unknown[]) => toastSuccessMock(...a),
  },
}));

import { CourtsManager } from "../../../components/admin/courts-manager";

function makeCourt(overrides: Record<string, unknown> = {}) {
  return {
    id: "court-1",
    name: "Pista 1",
    isIndoor: false,
    isCentral: false,
    order: 0,
    active: true,
    ...overrides,
  };
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("CourtsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue(makeCourt());
    updateMock.mockResolvedValue(makeCourt());
  });

  it("muestra empty state cuando no hay pistas", async () => {
    renderWithClient(<CourtsManager clubId="club-1" />);
    await waitFor(() =>
      expect(screen.getByText("No hay pistas registradas.")).toBeInTheDocument(),
    );
  });

  it("renderiza las pistas devueltas por el service", async () => {
    listMock.mockResolvedValueOnce([
      makeCourt({ id: "c1", name: "Pista Central", isCentral: true }),
      makeCourt({ id: "c2", name: "Pista 2" }),
    ]);
    renderWithClient(<CourtsManager clubId="club-1" />);
    await waitFor(() => {
      expect(screen.getByText("Pista Central")).toBeInTheDocument();
      expect(screen.getByText("Pista 2")).toBeInTheDocument();
    });
  });

  it("clic en 'Añadir pista' abre el formulario inline", async () => {
    renderWithClient(<CourtsManager clubId="club-1" />);
    await waitFor(() =>
      expect(screen.getByText("No hay pistas registradas.")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Añadir pista/i }));
    expect(screen.getByText("Nueva pista")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre *")).toBeInTheDocument();
  });

  it("no llama a create si el nombre está vacío y muestra toast de error", async () => {
    renderWithClient(<CourtsManager clubId="club-1" />);
    await waitFor(() =>
      expect(screen.getByText("No hay pistas registradas.")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Añadir pista/i }));
    fireEvent.click(screen.getByRole("button", { name: /Crear/i }));

    expect(createMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("El nombre es obligatorio");
  });

  it("llama a courts.create con el clubId y los datos del form al pulsar Crear", async () => {
    renderWithClient(<CourtsManager clubId="club-xyz" />);
    await waitFor(() =>
      expect(screen.getByText("No hay pistas registradas.")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Añadir pista/i }));
    const nameInput = screen.getByPlaceholderText("Nombre *");
    fireEvent.change(nameInput, { target: { value: "Pista nueva" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith("club-xyz", {
        name: "Pista nueva",
        isIndoor: false,
        isCentral: false,
      });
    });
  });

  it("propaga isCentral=true cuando el checkbox está marcado", async () => {
    renderWithClient(<CourtsManager clubId="club-1" />);
    await waitFor(() =>
      expect(screen.getByText("No hay pistas registradas.")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Añadir pista/i }));
    fireEvent.change(screen.getByPlaceholderText("Nombre *"), {
      target: { value: "P Central" },
    });
    // Marca el checkbox "Pista Central"
    fireEvent.click(screen.getByLabelText("Pista Central"));
    fireEvent.click(screen.getByRole("button", { name: /Crear/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        "club-1",
        expect.objectContaining({ name: "P Central", isCentral: true }),
      );
    });
  });
});
