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
});
