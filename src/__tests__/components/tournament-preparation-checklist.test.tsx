/**
 * Preparación del torneo: pasos con su %, la acción de cada uno y «Publicar
 * y avisar». Mockea el servicio para no depender de la API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { TournamentPreparation, PreparationCategory } from "@/types/preparation";

const preparationMock = vi.fn();
const publishMock = vi.fn();
const updateMock = vi.fn();
const publishAndNotifyMock = vi.fn();

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      preparation: (...a: unknown[]) => preparationMock(...a),
      publish: (...a: unknown[]) => publishMock(...a),
      update: (...a: unknown[]) => updateMock(...a),
      publishAndNotify: (...a: unknown[]) => publishAndNotifyMock(...a),
    },
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { TournamentPreparationChecklist } from "../../../components/admin/tournament-preparation-checklist";

const KEYS = ["CATEGORIES", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "DRAW", "SCHEDULE", "PUBLISH"] as const;

function cat(o: Partial<PreparationCategory> = {}): PreparationCategory {
  return {
    categoryId: "c1", gender: "M", level: "4a", confirmedPairs: 8,
    hasDraw: true, canDraw: true, unscheduled: 0, conflicts: 0, published: false,
    ...o,
  };
}

function prep(status: TournamentPreparation["status"], doneCount: number, o: Partial<TournamentPreparation> = {}): TournamentPreparation {
  return {
    status,
    registrationDeadline: null,
    percent: Math.round((doneCount / 6) * 100),
    steps: KEYS.map((key, i) => ({ key, done: i < doneCount })),
    nextStep: doneCount < 6 ? KEYS[doneCount] : null,
    categories: [cat()],
    ...o,
  };
}

function renderChecklist(onNavigate = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TournamentPreparationChecklist tournamentId="t1" onNavigate={onNavigate} />
    </QueryClientProvider>,
  );
  return { onNavigate, qc };
}

describe("TournamentPreparationChecklist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("muestra el % y los pasos, con el siguiente marcado", async () => {
    preparationMock.mockResolvedValue(prep("OPEN", 2));
    renderChecklist();
    expect(await screen.findByRole("img", { name: "Preparación al 33 %" })).toBeInTheDocument();
    expect(screen.getByText(/Siguiente paso: Inscripciones cerradas/)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(within(items[0]).getByText("(hecho)")).toBeInTheDocument();
    expect(within(items[2]).getByText("(pendiente)")).toBeInTheDocument();
  });

  it("borrador: «Abrir inscripciones» pide confirmación y llama a PATCH /publish", async () => {
    preparationMock.mockResolvedValue(prep("DRAFT", 1, { categories: [cat({ hasDraw: false, canDraw: false })] }));
    publishMock.mockResolvedValue({});
    renderChecklist();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir inscripciones" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir y avisar" }));
    await waitFor(() => expect(publishMock).toHaveBeenCalledWith("t1"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("abierto: «Cerrar inscripciones» pasa el torneo a Sorteo", async () => {
    preparationMock.mockResolvedValue(prep("OPEN", 2));
    updateMock.mockResolvedValue({});
    renderChecklist();
    // El botón del paso y el de confirmar se llaman igual
    fireEvent.click(await screen.findByRole("button", { name: "Cerrar inscripciones" }));
    const buttons = screen.getAllByRole("button", { name: "Cerrar inscripciones" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith("t1", { status: "DRAW" }));
  });

  it("cuadro y horarios llevan a su pestaña", async () => {
    preparationMock.mockResolvedValue(prep("DRAW", 3, { categories: [cat({ hasDraw: false })] }));
    const { onNavigate } = renderChecklist();
    fireEvent.click(await screen.findByRole("button", { name: "Ir al cuadro" }));
    expect(onNavigate).toHaveBeenCalledWith("cuadro");
    fireEvent.click(screen.getByRole("button", { name: "Ir a horarios" }));
    expect(onNavigate).toHaveBeenCalledWith("horarios");
    // Qué categorías faltan por sortear
    expect(screen.getByText(/Sin cuadro: Masc\. 4ª/)).toBeInTheDocument();
  });

  it("«Publicar y avisar» no se puede con las inscripciones abiertas", async () => {
    preparationMock.mockResolvedValue(prep("OPEN", 2, { registrationDeadline: new Date(Date.now() + 86_400_000).toISOString() }));
    renderChecklist();
    expect(await screen.findByRole("button", { name: "Publicar y avisar" })).toBeDisabled();
  });

  it("«Publicar y avisar» publica, avisa y enseña lo que no se pudo publicar, con «Publicar igualmente»", async () => {
    preparationMock.mockResolvedValue(prep("DRAW", 5));
    publishAndNotifyMock
      .mockResolvedValueOnce({
        results: [
          { categoryId: "c1", gender: "M", level: "4a", alreadyPublished: false, published: true, conflicts: [] },
          {
            categoryId: "c2", gender: "F", level: "3a", alreadyPublished: false, published: false,
            conflicts: [{ type: "COURT_OVERLAP", matchId: "m1", description: "" }],
          },
        ],
        publishedCount: 1,
        total: 2,
        status: "DRAW",
      })
      .mockResolvedValueOnce({ results: [], publishedCount: 1, total: 2, status: "SCHEDULED" });
    renderChecklist();

    fireEvent.click(await screen.findByRole("button", { name: "Publicar y avisar" }));
    const confirm = screen.getAllByRole("button", { name: "Publicar y avisar" });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(publishAndNotifyMock).toHaveBeenCalledWith("t1", false));
    expect(await screen.findByText("Sin publicar")).toBeInTheDocument();
    expect(screen.getByText(/1 conflicto de horario/)).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("1 categoría publicada"));

    fireEvent.click(screen.getByRole("button", { name: "Publicar igualmente las que solo tienen conflictos" }));
    fireEvent.click(screen.getByRole("button", { name: "Publicar igualmente" }));
    await waitFor(() => expect(publishAndNotifyMock).toHaveBeenLastCalledWith("t1", true));
    await waitFor(() => expect(toastSuccess).toHaveBeenLastCalledWith(expect.stringContaining("Programado")));
  });

  it("un error del back se enseña", async () => {
    preparationMock.mockResolvedValue(prep("DRAW", 5));
    publishAndNotifyMock.mockRejectedValue(new Error("Ninguna categoría tiene cuadro"));
    renderChecklist();
    fireEvent.click(await screen.findByRole("button", { name: "Publicar y avisar" }));
    const confirm = screen.getAllByRole("button", { name: "Publicar y avisar" });
    fireEvent.click(confirm[confirm.length - 1]);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Ninguna categoría tiene cuadro"));
  });

  it("con el torneo en curso no se muestra", async () => {
    preparationMock.mockResolvedValue(prep("ONGOING", 6));
    const { qc } = renderChecklist();
    await waitFor(() => expect(qc.getQueryState(["tournament", "t1", "preparation"])?.status).toBe("success"));
    expect(screen.queryByText("Preparación del torneo")).toBeNull();
  });

  it("enlaza al estado a mano, en «Avanzado» de la edición", async () => {
    preparationMock.mockResolvedValue(prep("OPEN", 2));
    renderChecklist();
    expect(await screen.findByRole("link", { name: "Editar → Avanzado" })).toHaveAttribute("href", "/torneos/t1/editar#avanzado");
  });
});
