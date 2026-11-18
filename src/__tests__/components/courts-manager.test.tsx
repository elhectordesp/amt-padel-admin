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
const blocksListMock = vi.fn();
const blocksCreateMock = vi.fn();

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    courts: {
      list: (...a: unknown[]) => listMock(...a),
      create: (...a: unknown[]) => createMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      remove: vi.fn(),
      blocks: {
        list: (...a: unknown[]) => blocksListMock(...a),
        create: (...a: unknown[]) => blocksCreateMock(...a),
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

// La sesión (rol y club): sin esto el panel no sabe si es de un club, y el rol del equipo no cuenta
const useRoleMock = vi.hoisted(() => vi.fn(() => ({ role: null as string | null, clubId: null as string | null })));
vi.mock("@/lib/use-role", async () => {
  const actual = await vi.importActual<typeof import("@/lib/use-role")>("@/lib/use-role");
  return { ...actual, useRole: () => useRoleMock() };
});

import { CourtsManager } from "../../../components/admin/courts-manager";
import { ME_QUERY_KEY } from "@/lib/use-me";

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
    // AMT (sin rol de club): ve y hace todo, como cuando el componente va en /clubes
    useRoleMock.mockReturnValue({ role: null, clubId: null });
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue(makeCourt());
    updateMock.mockResolvedValue(makeCourt());
    blocksListMock.mockResolvedValue([]);
    blocksCreateMock.mockResolvedValue({});
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
  it("el bloqueo se crea con el tipo elegido y el listado dice el tipo", async () => {
    listMock.mockResolvedValue([makeCourt({ id: "c1", name: "Pista 1" })]);
    blocksListMock.mockResolvedValue([
      { id: "k1", courtId: "c1", kind: "CLASS", startDate: "2026-11-20", endDate: "2026-11-20", startTime: "10:00", endTime: "11:00", reason: "Iniciación", createdAt: "" },
      { id: "k2", courtId: "c1", startDate: "2026-11-21", endDate: "2026-11-21", createdAt: "" },
    ]);
    renderWithClient(<CourtsManager clubId="club-1" />);
    fireEvent.click(await screen.findByTitle("Gestionar bloqueos"));

    // Un bloqueo de antes de que hubiera tipos es «Otro»
    expect(await screen.findByText("Clase")).toBeInTheDocument();
    expect(screen.getByText("Otro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Añadir bloqueo/i }));
    fireEvent.change(screen.getByLabelText("Motivo del bloqueo"), { target: { value: "EVENT" } });
    const [from] = document.querySelectorAll('input[type="date"]');
    fireEvent.change(from, { target: { value: "2026-12-01" } });
    fireEvent.click(screen.getByRole("button", { name: /^Añadir$/ }));

    await waitFor(() =>
      expect(blocksCreateMock).toHaveBeenCalledWith("club-1", "c1", expect.objectContaining({ kind: "EVENT", startDate: "2026-12-01" })),
    );
  });

  describe("según el rol del equipo", () => {
    // Pistas = «settings»; bloqueos = «bookings». Recepción lee la configuración y escribe las
    // reservas: no toca las pistas, pero sí sus bloqueos. El Entrenador solo lee las reservas.
    const asRole = (role: string) => ({
      id: "staff", name: "Equipo", activeClubId: "club-1",
      clubs: [{ clubId: "club-1", clubName: "Club Centro", roles: [role] }],
    });
    function renderAs(role: string) {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      qc.setQueryData(ME_QUERY_KEY, asRole(role));
      return render(
        <QueryClientProvider client={qc}>
          <CourtsManager clubId="club-1" />
        </QueryClientProvider>,
      );
    }
    // El rol solo cuenta si la sesión es de un club
    beforeEach(() => {
      useRoleMock.mockReturnValue({ role: "club", clubId: "club-1" });
      listMock.mockResolvedValue([makeCourt({ id: "c1", name: "Pista 1" })]);
      blocksListMock.mockResolvedValue([
        { id: "k1", courtId: "c1", kind: "CLASS", startDate: "2026-11-20", endDate: "2026-11-20", reason: "Iniciación", createdAt: "" },
      ]);
    });

    it("Recepción: ni añadir, ni editar, ni borrar, ni subir/bajar pistas; sí gestionar sus bloqueos", async () => {
      renderAs("RECEPTION");
      await screen.findByText("Pista 1");
      for (const name of [/Añadir pista/i]) {
        expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
      }
      for (const title of ["Editar pista", "Eliminar pista", "Subir pista", "Bajar pista"]) {
        expect(screen.queryByTitle(title)).not.toBeInTheDocument();
      }
      fireEvent.click(screen.getByTitle("Gestionar bloqueos"));
      expect(await screen.findByText("Clase")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Añadir bloqueo/i })).toBeInTheDocument();
      expect(screen.getByTitle("Eliminar bloqueo")).toBeInTheDocument();
    });

    it("Entrenador: ve las pistas y sus bloqueos, sin poder cambiar nada", async () => {
      renderAs("COACH");
      await screen.findByText("Pista 1");
      expect(screen.queryByRole("button", { name: /Añadir pista/i })).not.toBeInTheDocument();
      fireEvent.click(screen.getByTitle("Ver bloqueos"));
      expect(await screen.findByText("Clase")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Añadir bloqueo/i })).not.toBeInTheDocument();
      expect(screen.queryByTitle("Eliminar bloqueo")).not.toBeInTheDocument();
    });

    it("Propietario: todo", async () => {
      renderAs("OWNER");
      await screen.findByText("Pista 1");
      expect(screen.getByRole("button", { name: /Añadir pista/i })).toBeInTheDocument();
      for (const title of ["Editar pista", "Eliminar pista", "Subir pista", "Bajar pista", "Gestionar bloqueos"]) {
        expect(screen.getByTitle(title)).toBeInTheDocument();
      }
    });
  });

  it("el bloqueo de una clase de la escuela es de solo lectura: se gestiona desde Escuela", async () => {
    listMock.mockResolvedValue([makeCourt({ id: "c1", name: "Pista 1" })]);
    blocksListMock.mockResolvedValue([
      { id: "k1", courtId: "c1", kind: "CLASS", startDate: "2026-11-23", endDate: "2026-11-23", startTime: "18:00", endTime: "19:00", reason: "Iniciación", schoolSessionId: "ses-1", createdAt: "" },
      { id: "k2", courtId: "c1", kind: "MAINTENANCE", startDate: "2026-11-24", endDate: "2026-11-24", reason: "Obras", createdAt: "" },
    ]);
    renderWithClient(<CourtsManager clubId="club-1" />);
    fireEvent.click(await screen.findByTitle("Gestionar bloqueos"));

    expect(await screen.findByText("Escuela")).toBeInTheDocument();
    // Solo el bloqueo normal se puede eliminar
    expect(screen.getAllByTitle("Eliminar bloqueo")).toHaveLength(1);
  });
});
