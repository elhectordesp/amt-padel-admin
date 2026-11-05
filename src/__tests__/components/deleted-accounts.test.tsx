/**
 * Cuentas borradas con «Anonimizar» (decisión 30-10): se cargan al abrir la
 * sección, se buscan por nombre y, tras confirmar, anonimizar llama al back y
 * la cuenta sale de la lista.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
const playersMock = vi.hoisted(() => ({ deleted: vi.fn(), anonymize: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { players: playersMock } }));

import { DeletedAccounts } from "../../../components/admin/deleted-accounts";

const ANA = {
  id: "p-1",
  name: "Ana López",
  // Ya en invierno: las 23:30Z del 27 son el 28 en España
  deletedAt: "2026-10-27T23:30:00.000Z",
  lastTournament: { name: "Open de primavera", startDate: "2026-04-10T00:00:00.000Z" },
};
const LUIS = { id: "p-2", name: "Luis Pérez", deletedAt: "2026-09-01T10:00:00.000Z", lastTournament: null };
const pageOf = (data: unknown[]) => ({ data, total: data.length, page: 1, pageSize: 50 });

function renderOpen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <DeletedAccounts />
    </QueryClientProvider>,
  );
  const details = utils.container.querySelector("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  return utils;
}

describe("DeletedAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playersMock.deleted.mockResolvedValue(pageOf([ANA, LUIS]));
    playersMock.anonymize.mockResolvedValue({ message: "Cuenta anonimizada" });
  });

  it("no pide nada hasta abrirla; abierta, lista nombre, fecha de baja y último torneo", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <DeletedAccounts />
      </QueryClientProvider>,
    );
    expect(playersMock.deleted).not.toHaveBeenCalled();

    const details = container.querySelector("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));

    expect(await screen.findByText("Ana López")).toBeInTheDocument();
    expect(playersMock.deleted).toHaveBeenCalledWith({ page: 1, pageSize: 50, q: undefined });
    expect(screen.getByText("Baja el 28 oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Último torneo: Open de primavera (10 abr 2026)")).toBeInTheDocument();
    expect(screen.getByText("Luis Pérez")).toBeInTheDocument();
    expect(screen.getByText("Sin torneos")).toBeInTheDocument();
  });

  it("busca por nombre en el back", async () => {
    renderOpen();
    await screen.findByText("Ana López");

    fireEvent.change(screen.getByLabelText("Buscar cuentas borradas por nombre"), { target: { value: "ana" } });
    await waitFor(() =>
      expect(playersMock.deleted).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, q: "ana" }),
    );
  });

  it("anonimizar pide confirmación (definitivo, «Usuario eliminado») y la cuenta sale de la lista", async () => {
    renderOpen();
    await screen.findByText("Ana López");
    // Tras anonimizar, el back ya no la devuelve
    playersMock.deleted.mockResolvedValue(pageOf([LUIS]));

    fireEvent.click(screen.getAllByRole("button", { name: /Anonimizar/ })[0]);
    expect(screen.getByText(/Se quitará el nombre de Ana López y es definitivo/)).toBeInTheDocument();
    expect(screen.getByText(/comprueba que quien lo pide es esta persona/)).toBeInTheDocument();
    expect(screen.getByText(/mostrarán «Usuario eliminado» en vez de su nombre/)).toBeInTheDocument();
    expect(playersMock.anonymize).not.toHaveBeenCalled();

    // Un doble clic en confirmar manda una sola
    const confirm = screen.getAllByRole("button", { name: "Anonimizar" }).at(-1)!;
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith("Cuenta anonimizada"));
    expect(playersMock.anonymize).toHaveBeenCalledTimes(1);
    expect(playersMock.anonymize).toHaveBeenCalledWith("p-1");
    await waitFor(() => expect(screen.queryByText("Ana López")).not.toBeInTheDocument());
    expect(screen.getByText("Luis Pérez")).toBeInTheDocument();
    expect(screen.queryByText(/es definitivo/)).not.toBeInTheDocument();
  });

  it("cancelar no anonimiza", async () => {
    renderOpen();
    await screen.findByText("Ana López");

    fireEvent.click(screen.getAllByRole("button", { name: /Anonimizar/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText(/es definitivo/)).not.toBeInTheDocument();
    expect(playersMock.anonymize).not.toHaveBeenCalled();
  });

  it("si ya no está para anonimizar (otro admin lo hizo), lo dice, cierra y recarga la lista", async () => {
    renderOpen();
    await screen.findByText("Ana López");
    playersMock.anonymize.mockRejectedValue(new ApiError("Jugador no encontrado", 404, "PLAYER_NOT_FOUND"));
    playersMock.deleted.mockResolvedValue(pageOf([LUIS]));

    fireEvent.click(screen.getAllByRole("button", { name: /Anonimizar/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Anonimizar" }).at(-1)!);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(
      "Esta cuenta ya no se puede anonimizar (quizá ya se hizo). Se ha recargado la lista.",
    ));
    await waitFor(() => expect(screen.queryByText("Ana López")).not.toBeInTheDocument());
    expect(screen.queryByText(/es definitivo/)).not.toBeInTheDocument();
  });

  it("con otro error, lo dice y deja la confirmación abierta para reintentar", async () => {
    renderOpen();
    await screen.findByText("Ana López");
    playersMock.anonymize.mockRejectedValue(new ApiError("Error de conexión"));

    fireEvent.click(screen.getAllByRole("button", { name: /Anonimizar/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Anonimizar" }).at(-1)!);

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Error de conexión"));
    expect(screen.getByText(/Se quitará el nombre de Ana López/)).toBeInTheDocument();
    expect(playersMock.deleted).toHaveBeenCalledTimes(1);
  });

  it("sin cuentas, lo dice", async () => {
    playersMock.deleted.mockResolvedValue(pageOf([]));
    renderOpen();
    expect(await screen.findByText("No hay cuentas borradas que conserven el nombre.")).toBeInTheDocument();
  });
});
