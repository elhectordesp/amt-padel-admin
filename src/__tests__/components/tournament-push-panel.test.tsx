/**
 * Tests de TournamentPushPanel (mensaje a mano a los inscritos de un torneo).
 *
 * Cubre: contadores de 30/145 y su validación, recuento de destinatarios
 * según las categorías marcadas y la lista de espera, confirmación antes de
 * enviar (con el texto recortado), límite del día e historial.
 *
 * Mockea `lib/services/tournament-messages` para no depender de la API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const listMock = vi.fn();
const recipientsMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@/lib/services/tournament-messages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/tournament-messages")>();
  return {
    ...actual,
    tournamentMessagesService: {
      list: (...a: unknown[]) => listMock(...a),
      recipients: (...a: unknown[]) => recipientsMock(...a),
      send: (...a: unknown[]) => sendMock(...a),
    },
  };
});

const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastErrorMock(...a),
    success: (...a: unknown[]) => toastSuccessMock(...a),
  },
}));

import { TournamentPushPanel, DRAFT_MESSAGES_HINT } from "../../../components/admin/tournament-push-panel";

const CATEGORIES = [
  { id: "cat-1", gender: "M", level: "3a" },
  { id: "cat-2", gender: "F", level: "4a" },
];

function history(overrides: Record<string, unknown> = {}) {
  return {
    dailyLimit: 5,
    sentToday: 1,
    remainingToday: 4,
    messages: [
      {
        id: "m1",
        title: "Lluvia",
        body: "Se retrasan los partidos una hora.",
        categories: [{ id: "cat-1", gender: "M", level: "3a" }],
        includeWaitlist: true,
        recipientCount: 12,
        sentBy: { id: "a1", name: "Ana AMT" },
        createdAt: "2026-10-27T09:05:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderPanel({ isDraft = false } = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TournamentPushPanel tournamentId="t1" categories={CATEGORIES} isDraft={isDraft} />
    </QueryClientProvider>,
  );
}

const sendButton = () => screen.getByRole("button", { name: /^Enviar$/ });

function fillForm(title = "Retraso", body = "Empezamos a las 18:00.") {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Texto"), { target: { value: body } });
}

describe("TournamentPushPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue(history());
    recipientsMock.mockResolvedValue({ recipients: 7 });
    sendMock.mockResolvedValue({ id: "m2", recipientCount: 7, createdAt: "2026-10-27T10:00:00.000Z", remainingToday: 3 });
  });

  it("enseña el historial: quién, a cuántos, categorías, lista de espera y hora de España", async () => {
    renderPanel();
    expect(await screen.findByText("Lluvia")).toBeInTheDocument();
    expect(screen.getByText("Se retrasan los partidos una hora.")).toBeInTheDocument();
    expect(screen.getByText(/Ana AMT · 12 jugadores · Masc\. 3ª · con lista de espera/)).toBeInTheDocument();
    // 09:05 UTC = 10:05 en Madrid (CET, octubre tras el cambio)
    expect(screen.getByText(/10:05/)).toBeInTheDocument();
    expect(screen.getByText("Hoy quedan 4 de 5")).toBeInTheDocument();
  });

  it("cuenta los caracteres como el back y no deja enviar si se pasa", async () => {
    renderPanel();
    await screen.findByText("Lluvia");
    fireEvent.click(screen.getByLabelText("Masc. 3ª"));
    fillForm("🎾 Retraso", "Ok");
    expect(screen.getByText("9/30")).toBeInTheDocument();
    expect(screen.getByText("2/145")).toBeInTheDocument();
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "x".repeat(31) } });
    expect(screen.getByText("31/30")).toHaveClass("text-destructive");
    expect(sendButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Ok" } });
    fireEvent.change(screen.getByLabelText("Texto"), { target: { value: "y".repeat(146) } });
    expect(sendButton()).toBeDisabled();
  });

  it("los espacios de los extremos no cuentan (el back los quita): 30 caracteres con espacios alrededor se pueden enviar", async () => {
    renderPanel();
    await screen.findByText("Lluvia");
    fireEvent.click(screen.getByLabelText("Masc. 3ª"));
    fillForm(`  ${"x".repeat(30)}  `, ` ${"y".repeat(145)} `);
    expect(screen.getByText("30/30")).not.toHaveClass("text-destructive");
    expect(screen.getByText("145/145")).not.toHaveClass("text-destructive");
    await waitFor(() => expect(sendButton()).toBeEnabled());
  });

  it("en un borrador explica por qué no se puede mandar y no consulta nada al back", () => {
    renderPanel({ isDraft: true });
    expect(screen.getByText(DRAFT_MESSAGES_HINT)).toBeInTheDocument();
    expect(screen.queryByLabelText("Título")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Enviar$/ })).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
    expect(recipientsMock).not.toHaveBeenCalled();
  });

  it("sin categorías marcadas no cuenta ni deja enviar; al marcar, dice a cuántos llegará", async () => {
    renderPanel();
    await screen.findByText("Lluvia");
    fillForm();
    expect(screen.getByText("Marca al menos una categoría")).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
    expect(recipientsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Masc. 3ª"));
    expect(await screen.findByText("Llegará a 7 jugadores")).toBeInTheDocument();
    expect(recipientsMock).toHaveBeenLastCalledWith("t1", ["cat-1"], false);

    fireEvent.click(screen.getByLabelText("Incluir la lista de espera"));
    await waitFor(() => expect(recipientsMock).toHaveBeenLastCalledWith("t1", ["cat-1"], true));

    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    await waitFor(() =>
      expect(recipientsMock).toHaveBeenLastCalledWith("t1", ["cat-1", "cat-2"], true),
    );
  });

  it("si no hay inscritos en esas categorías, lo dice y no deja enviar", async () => {
    recipientsMock.mockResolvedValue({ recipients: 0 });
    renderPanel();
    await screen.findByText("Lluvia");
    fillForm();
    fireEvent.click(screen.getByLabelText("Fem. 4ª"));
    expect(await screen.findByText("No hay jugadores inscritos en esas categorías")).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();
  });

  it("pide confirmación y manda el texto recortado; al acabar avisa, limpia y recarga el historial", async () => {
    renderPanel();
    await screen.findByText("Lluvia");
    fireEvent.click(screen.getByLabelText("Masc. 3ª"));
    fillForm("  Retraso  ", " Empezamos a las 18:00. ");
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(sendButton());
    expect(screen.getByText("¿Enviar el mensaje?")).toBeInTheDocument();
    expect(screen.getByText(/Llegará al móvil de 7 jugadores/)).toBeInTheDocument();
    expect(sendMock).not.toHaveBeenCalled();

    // El botón de la confirmación (el último «Enviar»)
    const confirm = screen.getAllByRole("button", { name: "Enviar" }).at(-1)!;
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith("t1", {
        title: "Retraso",
        body: "Empezamos a las 18:00.",
        categoryIds: ["cat-1"],
        includeWaitlist: false,
      }),
    );
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Mensaje enviado a 7 jugadores"));
    expect(screen.getByLabelText("Título")).toHaveValue("");
    expect(screen.getByLabelText("Texto")).toHaveValue("");
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  it("si el back lo rechaza (p. ej. límite del día), enseña su mensaje", async () => {
    sendMock.mockRejectedValue(new Error("Ya se han enviado los 5 mensajes de hoy de este torneo."));
    renderPanel();
    await screen.findByText("Lluvia");
    fireEvent.click(screen.getByLabelText("Masc. 3ª"));
    fillForm();
    await waitFor(() => expect(sendButton()).toBeEnabled());
    fireEvent.click(sendButton());
    fireEvent.click(screen.getAllByRole("button", { name: "Enviar" }).at(-1)!);
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Ya se han enviado los 5 mensajes de hoy de este torneo."),
    );
  });

  it("con los envíos de hoy agotados no deja enviar", async () => {
    listMock.mockResolvedValue(history({ sentToday: 5, remainingToday: 0 }));
    renderPanel();
    expect(await screen.findByText("Hoy quedan 0 de 5")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Masc. 3ª"));
    fillForm();
    await screen.findByText("Llegará a 7 jugadores");
    expect(sendButton()).toBeDisabled();
  });

  it("sin envíos todavía, lo dice", async () => {
    listMock.mockResolvedValue(history({ sentToday: 0, remainingToday: 5, messages: [] }));
    renderPanel();
    expect(await screen.findByText("Aún no se ha enviado ningún mensaje en este torneo.")).toBeInTheDocument();
  });
});
