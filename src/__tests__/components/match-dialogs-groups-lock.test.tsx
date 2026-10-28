/**
 * Crear un partido y cambiar sus parejas con el cuadro publicado: mandan el
 * «Forzar» del aviso (forceLocked) y, si el back lo rechaza (409
 * GROUPS_LOCKED), no lo enseñan como un error más: avisan a la ficha, que
 * ofrece ocultar o forzar. Ese «Forzar» repite la petición UNA vez.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiError } from "@/lib/api";

const createManualMatch = vi.fn();
const editMatchPlayers = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    tournaments: {
      createManualMatch: (...a: unknown[]) => createManualMatch(...a),
      editMatchPlayers: (...a: unknown[]) => editMatchPlayers(...a),
    },
  },
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (...a: unknown[]) => toastError(...a) },
}));

import { MatchCreateDialog } from "../../../components/admin/match-create-dialog";
import { MatchEditPairsDialog } from "../../../components/admin/match-edit-pairs-dialog";

const locked = new ApiError("El cuadro de esta categoría está publicado", 409, "GROUPS_LOCKED");
const pairs = [
  { userId: "a", partnerId: "b", label: "A / B" },
  { userId: "c", partnerId: "d", label: "C / D" },
];

describe("MatchCreateDialog con el cuadro publicado", () => {
  beforeEach(() => vi.clearAllMocks());

  const renderCreate = (props: Partial<Parameters<typeof MatchCreateDialog>[0]> = {}) => {
    const onClose = vi.fn();
    render(
      <MatchCreateDialog
        open
        onClose={onClose}
        tournamentId="t1"
        categoryId="c1"
        categoryLabel="Masc. 4ª"
        groups={[{ id: "g1", label: "Grupo A" }]}
        pairs={pairs}
        timeZone="Europe/Madrid"
        {...props}
      />,
    );
    return { onClose };
  };

  it("manda el «Forzar» que le pasa la ficha", async () => {
    createManualMatch.mockResolvedValue({ success: true });
    renderCreate({ lock: { forceLocked: true } });
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));
    await waitFor(() =>
      expect(createManualMatch).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ categoryId: "c1", groupId: "g1" }),
        { forceLocked: true },
      ),
    );
  });

  it("el 409 GROUPS_LOCKED avisa a la ficha, sin error genérico ni cerrar; su «Forzar» lo repite forzado una vez", async () => {
    createManualMatch.mockRejectedValueOnce(locked).mockResolvedValueOnce({ success: true });
    const onGroupsLocked = vi.fn();
    const { onClose } = renderCreate({ onGroupsLocked });
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));
    await waitFor(() => expect(onGroupsLocked).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Sin forzar la primera vez
    expect(createManualMatch.mock.calls[0][2]).toBeUndefined();

    // «Forzar» en el diálogo de la ficha
    await act(async () => onGroupsLocked.mock.calls[0][0]());
    expect(createManualMatch).toHaveBeenCalledTimes(2);
    expect(createManualMatch.mock.calls[1][2]).toEqual({ forceLocked: true });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("MatchEditPairsDialog con el cuadro publicado", () => {
  beforeEach(() => vi.clearAllMocks());

  const renderEdit = (props: Partial<Parameters<typeof MatchEditPairsDialog>[0]> = {}) =>
    render(
      <MatchEditPairsDialog
        open
        onClose={vi.fn()}
        matchId="m1"
        categoryLabel="Masc. 4ª"
        pairs={pairs}
        team1UserIds={["a", "b"]}
        team2UserIds={["c", "d"]}
        {...props}
      />,
    );

  it("manda el «Forzar» del aviso; el 409 avisa a la ficha y su «Forzar» vale para esa petición", async () => {
    editMatchPlayers
      .mockRejectedValueOnce(locked)
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(locked);
    const onGroupsLocked = vi.fn();
    renderEdit({ lock: { forceLocked: false }, onGroupsLocked });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() => expect(onGroupsLocked).toHaveBeenCalledTimes(1));
    expect(editMatchPlayers).toHaveBeenLastCalledWith(
      "m1",
      { userId: "a", partnerId: "b" },
      { userId: "c", partnerId: "d" },
      false,
      { forceLocked: false },
    );
    expect(toastError).not.toHaveBeenCalled();

    // «Forzar»: esa petición, otra vez, forzada
    await act(async () => onGroupsLocked.mock.calls[0][0]());
    expect(editMatchPlayers).toHaveBeenLastCalledWith(
      "m1",
      { userId: "a", partnerId: "b" },
      { userId: "c", partnerId: "d" },
      false,
      { forceLocked: true },
    );

    // La siguiente ya no va forzada: vuelve a pedir confirmación
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() => expect(onGroupsLocked).toHaveBeenCalledTimes(2));
    expect(editMatchPlayers.mock.calls[2][4]).toEqual({ forceLocked: false });
  });
});
