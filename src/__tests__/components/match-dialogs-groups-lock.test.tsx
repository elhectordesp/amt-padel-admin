/**
 * Crear un partido y cambiar sus parejas con el cuadro publicado: mandan el
 * «Forzar» (forceLocked) y, si el back lo rechaza (409 GROUPS_LOCKED), no lo
 * enseñan como un error más: avisan a la ficha, que ofrece ocultar o forzar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  it("el 409 GROUPS_LOCKED avisa a la ficha, sin error genérico ni cerrar", async () => {
    createManualMatch.mockRejectedValue(locked);
    const onGroupsLocked = vi.fn();
    const { onClose } = renderCreate({ onGroupsLocked });
    fireEvent.click(screen.getByRole("button", { name: /Crear partido/ }));
    await waitFor(() => expect(onGroupsLocked).toHaveBeenCalled());
    expect(toastError).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
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

  it("manda el «Forzar» y el 409 avisa a la ficha", async () => {
    editMatchPlayers.mockRejectedValueOnce(locked).mockResolvedValueOnce({ success: true });
    const onGroupsLocked = vi.fn();
    renderEdit({ lock: { forceLocked: false }, onGroupsLocked });
    fireEvent.click(screen.getByRole("button", { name: /Guardar/ }));
    await waitFor(() => expect(onGroupsLocked).toHaveBeenCalled());
    expect(editMatchPlayers).toHaveBeenCalledWith(
      "m1",
      { userId: "a", partnerId: "b" },
      { userId: "c", partnerId: "d" },
      false,
      { forceLocked: false },
    );
    expect(toastError).not.toHaveBeenCalled();
  });
});
