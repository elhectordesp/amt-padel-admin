import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GenerateBracketDialog } from "../../../components/admin/generate-bracket-dialog";

// Mock adminService — controlamos previewBracket y generateBracket
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      previewBracket: vi.fn(),
      generateBracket: vi.fn(),
      regenerateBracket: vi.fn(),
      initBracketManual: vi.fn(),
      getBracketStats: vi.fn().mockResolvedValue({
        exists: false,
        totalMatches: 0,
        finishedMatches: 0,
        hasGroupResults: false,
        hasElimResults: false,
      }),
    },
  },
}));
import { adminService } from "@/lib/services/admin";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function baseProps(overrides = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    tournamentId: "tour-1",
    categoryId: "cat-1",
    categoryLabel: "Mixto 3ª",
    totalConfirmedPairs: 24,
    onGenerated: vi.fn(),
    ...overrides,
  };
}

describe("GenerateBracketDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminService.tournaments.previewBracket as ReturnType<typeof vi.fn>).mockResolvedValue({
      isGroups: true,
      groups: Array.from({ length: 6 }, (_, i) => ({
        name: `Grupo ${String.fromCharCode(65 + i)}`,
        pairs: Array.from({ length: 4 }),
      })),
      totalPairs: 24,
      totalMatches: 36,
    });
  });

  it("no renderiza cuando open=false", () => {
    const { container } = wrap(<GenerateBracketDialog {...baseProps({ open: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza título con categoría y opciones por defecto", () => {
    wrap(<GenerateBracketDialog {...baseProps()} />);
    expect(screen.getByText(/Generar cuadro — Mixto 3ª/)).toBeInTheDocument();
    expect(screen.getByText("Grupos + Eliminatoria")).toBeInTheDocument();
    expect(screen.getByText("Solo eliminatoria")).toBeInTheDocument();
  });

  it("muestra opciones distintas según formato", () => {
    wrap(<GenerateBracketDialog {...baseProps()} />);
    expect(screen.getByText("Distribución de grupos")).toBeInTheDocument();
    expect(screen.getByText("Pasan de cada grupo")).toBeInTheDocument();
    expect(screen.getByText("Ronda inicial eliminatoria")).toBeInTheDocument();
  });

  it("al cambiar a 'Solo eliminatoria' oculta opciones de grupos", () => {
    wrap(<GenerateBracketDialog {...baseProps()} />);
    fireEvent.click(screen.getByText("Solo eliminatoria"));
    expect(screen.queryByText("Distribución de grupos")).not.toBeInTheDocument();
    expect(screen.queryByText("Pasan de cada grupo")).not.toBeInTheDocument();
  });

  it("dispara previewBracket al abrir (con valores default)", async () => {
    wrap(<GenerateBracketDialog {...baseProps()} />);
    await waitFor(() => {
      expect(adminService.tournaments.previewBracket).toHaveBeenCalledWith(
        "tour-1",
        "cat-1",
        "grupos+eliminatoria",
        expect.objectContaining({
          topNPerGroup: 2,
          eliminationStartRound: undefined,
        }),
      );
    });
  });

  it("Top 1 cambia el param topNPerGroup enviado", async () => {
    wrap(<GenerateBracketDialog {...baseProps()} />);
    fireEvent.click(screen.getByText("Top 1"));
    await waitFor(() => {
      const calls = (adminService.tournaments.previewBracket as ReturnType<typeof vi.fn>).mock.calls;
      const last = calls[calls.length - 1];
      expect(last[3]).toEqual(expect.objectContaining({ topNPerGroup: 1 }));
    }, { timeout: 2000 });
  });

  it("botón Cancelar invoca onClose", () => {
    const onClose = vi.fn();
    wrap(<GenerateBracketDialog {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it("botón Generar cuadro dispara generateBracket con las opciones actuales", async () => {
    (adminService.tournaments.generateBracket as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
    });
    const onClose = vi.fn();
    wrap(<GenerateBracketDialog {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Generar cuadro$/ }));
    await waitFor(() => {
      expect(adminService.tournaments.generateBracket).toHaveBeenCalledWith(
        "tour-1",
        "cat-1",
        undefined,
        "grupos+eliminatoria",
        expect.objectContaining({ topNPerGroup: 2 }),
      );
    });
  });

  it("muestra error inline cuando generateBracket falla y NO cierra el modal", async () => {
    (adminService.tournaments.generateBracket as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { message: "Top 2 × 3 grupos = 6 plazas, no permite empezar en QF (requiere 8)." } },
    });
    const onClose = vi.fn();
    wrap(<GenerateBracketDialog {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Generar cuadro$/ }));
    await waitFor(() => {
      expect(screen.getByText(/no permite empezar en QF/)).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Bloque 2 ─────────────────────────────────────────────────────────────

  describe("Bloque 2 — empty states + read-only + REGENERAR", () => {
    it("0 parejas confirmadas → empty state sin botón Generar", () => {
      wrap(<GenerateBracketDialog {...baseProps({ totalConfirmedPairs: 0 })} />);
      expect(screen.getByText(/No hay parejas inscritas/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Generar cuadro$/ })).not.toBeInTheDocument();
    });

    it("<3 parejas → empty state explica el mínimo", () => {
      wrap(<GenerateBracketDialog {...baseProps({ totalConfirmedPairs: 2 })} />);
      expect(screen.getByText(/Solo tienes 2 parejas confirmadas/)).toBeInTheDocument();
      expect(screen.getByText(/mínimo de 3/)).toBeInTheDocument();
    });

    it("registrationsOpenReason → modo read-only, botón disabled", () => {
      wrap(
        <GenerateBracketDialog
          {...baseProps({
            registrationsOpenReason: "Las inscripciones siguen abiertas hasta 30 jun 18:00.",
          })}
        />,
      );
      expect(screen.getByText(/inscripciones siguen abiertas/i)).toBeInTheDocument();
      const btn = screen.getByRole("button", { name: /Generar cuadro$/ });
      expect(btn).toBeDisabled();
    });

    it("alreadyHasBracket + sin resultados → banner ámbar, botón habilitado", async () => {
      (adminService.tournaments.getBracketStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        exists: true,
        totalMatches: 12,
        finishedMatches: 0,
        hasGroupResults: false,
        hasElimResults: false,
      });
      wrap(<GenerateBracketDialog {...baseProps({ alreadyHasBracket: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/borrará 12 partidos \(ninguno con resultado\)/)).toBeInTheDocument();
      });
      const btn = screen.getByRole("button", { name: /Generar cuadro$/ });
      expect(btn).not.toBeDisabled();
    });

    it("alreadyHasBracket + con resultados → banner rojo + REGENERAR input + botón disabled hasta match", async () => {
      (adminService.tournaments.getBracketStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        exists: true,
        totalMatches: 18,
        finishedMatches: 5,
        hasGroupResults: true,
        hasElimResults: false,
      });
      wrap(<GenerateBracketDialog {...baseProps({ alreadyHasBracket: true })} />);
      await waitFor(() => {
        expect(screen.getByText(/ya tiene partidos jugados/)).toBeInTheDocument();
      });
      const input = screen.getByPlaceholderText("REGENERAR");
      const btn = screen.getByRole("button", { name: /Generar cuadro$/ });
      // Empieza disabled
      expect(btn).toBeDisabled();
      // Escribe algo distinto → sigue disabled
      fireEvent.change(input, { target: { value: "OTRA COSA" } });
      expect(btn).toBeDisabled();
      // Escribe REGENERAR exacto → se habilita
      fireEvent.change(input, { target: { value: "REGENERAR" } });
      expect(btn).not.toBeDisabled();
    });

    it("REGENERAR es case-insensitive y permite espacios alrededor", async () => {
      (adminService.tournaments.getBracketStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        exists: true,
        totalMatches: 5,
        finishedMatches: 2,
        hasGroupResults: true,
        hasElimResults: false,
      });
      wrap(<GenerateBracketDialog {...baseProps({ alreadyHasBracket: true })} />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText("REGENERAR")).toBeInTheDocument();
      });
      const input = screen.getByPlaceholderText("REGENERAR");
      const btn = screen.getByRole("button", { name: /Generar cuadro$/ });
      fireEvent.change(input, { target: { value: "  regenerar  " } });
      expect(btn).not.toBeDisabled();
    });
  });

  // ── Bloque 3 ─────────────────────────────────────────────────────────────

  describe("Bloque 3 — modo manual (crear grupos vacíos)", () => {
    it("aparece toggle Modo de generación con Automático seleccionado por defecto", () => {
      wrap(<GenerateBracketDialog {...baseProps()} />);
      expect(screen.getByText("Modo de generación")).toBeInTheDocument();
      expect(screen.getByText("Automático con opciones")).toBeInTheDocument();
      expect(screen.getByText("Crear grupos vacíos y asignar a mano")).toBeInTheDocument();
    });

    it("al cambiar a Manual: oculta opciones de auto, muestra solo nº grupos", () => {
      wrap(<GenerateBracketDialog {...baseProps()} />);
      fireEvent.click(screen.getByText("Crear grupos vacíos y asignar a mano"));

      // Manual visible
      expect(screen.getByText("Nº de grupos vacíos")).toBeInTheDocument();
      // Texto con span anidado — busco el "2 grupos vacíos" exacto del span
      expect(screen.getByText("2 grupos vacíos")).toBeInTheDocument();

      // Auto ocultos
      expect(screen.queryByText("Formato")).not.toBeInTheDocument();
      expect(screen.queryByText("Pasan de cada grupo")).not.toBeInTheDocument();
      expect(screen.queryByText("Ronda inicial eliminatoria")).not.toBeInTheDocument();
    });

    it("botón cambia a 'Crear grupos vacíos' en modo manual", () => {
      wrap(<GenerateBracketDialog {...baseProps()} />);
      fireEvent.click(screen.getByText("Crear grupos vacíos y asignar a mano"));
      expect(screen.getByRole("button", { name: /Crear grupos vacíos/ })).toBeInTheDocument();
    });

    it("al pulsar 'Crear grupos vacíos' llama a initBracketManual con el nº elegido", async () => {
      (adminService.tournaments.initBracketManual as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });
      wrap(<GenerateBracketDialog {...baseProps()} />);
      fireEvent.click(screen.getByText("Crear grupos vacíos y asignar a mano"));
      // Cambia a 5 grupos
      const input = screen.getByDisplayValue("2");
      fireEvent.change(input, { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: /Crear grupos vacíos/ }));
      await waitFor(() => {
        expect(adminService.tournaments.initBracketManual).toHaveBeenCalledWith(
          "tour-1",
          "cat-1",
          5,
        );
      });
    });
  });
});
