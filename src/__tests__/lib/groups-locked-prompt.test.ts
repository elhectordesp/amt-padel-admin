import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../../lib/api";
import { useGroupsLockedPrompt } from "../../../lib/use-groups-locked-prompt";

const locked = new ApiError("El cuadro de esta categoría está publicado", 409, "GROUPS_LOCKED");

describe("useGroupsLockedPrompt (el «Forzar» del diálogo del 409)", () => {
  it("solo atiende el 409 GROUPS_LOCKED: los demás errores siguen su camino", () => {
    const { result } = renderHook(() => useGroupsLockedPrompt());
    let handled = true;
    act(() => {
      handled = result.current.onError(new ApiError("Llena", 400, "CATEGORY_FULL"), "c1", vi.fn());
    });
    expect(handled).toBe(false);
    expect(result.current.categoryId).toBeNull();
  });

  it("«Forzar» repite la petición fallida UNA vez y no deja nada forzado", () => {
    const { result } = renderHook(() => useGroupsLockedPrompt());
    const retry = vi.fn();
    let handled = false;
    act(() => {
      handled = result.current.onError(locked, "c1", retry);
    });
    expect(handled).toBe(true);
    expect(result.current.categoryId).toBe("c1");

    act(() => result.current.force());
    expect(retry).toHaveBeenCalledTimes(1);
    expect(result.current.categoryId).toBeNull();
    // Cerrado, otro «Forzar» no repite nada
    act(() => result.current.force());
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("cerrar (o ocultar el cuadro) no repite la petición", () => {
    const { result } = renderHook(() => useGroupsLockedPrompt());
    const retry = vi.fn();
    act(() => result.current.open("c1", retry));
    expect(result.current.categoryId).toBe("c1");
    act(() => result.current.close());
    expect(retry).not.toHaveBeenCalled();
    expect(result.current.categoryId).toBeNull();
  });
});
