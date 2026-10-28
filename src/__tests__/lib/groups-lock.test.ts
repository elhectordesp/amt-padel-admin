import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ApiError } from "../../../lib/api";
import { isGroupsLocked } from "../../../lib/utils/groups-lock";
import { useForcedGroupsLock } from "../../../lib/use-forced-groups-lock";

describe("isGroupsLocked", () => {
  it("el 409 GROUPS_LOCKED del back, y nada más", () => {
    expect(isGroupsLocked(new ApiError("Bloqueados", 409, "GROUPS_LOCKED"))).toBe(true);
    expect(isGroupsLocked(new ApiError("Llena", 400, "CATEGORY_FULL"))).toBe(false);
    expect(isGroupsLocked(new Error("GROUPS_LOCKED"))).toBe(false);
    expect(isGroupsLocked(undefined)).toBe(false);
  });
});

describe("useForcedGroupsLock", () => {
  /** El cuadro de cada categoría: cuándo se publicó (null: sin publicar). */
  const setup = (initial: Record<string, string | null>, viewKey = "A|A") => {
    let published = { ...initial };
    const hook = renderHook(
      ({ view }: { view: string }) => useForcedGroupsLock((c) => published[c], view),
      { initialProps: { view: viewKey } },
    );
    return {
      hook,
      setPublished: (next: Record<string, string | null>) => {
        published = next;
        hook.rerender({ view: viewKey });
      },
      view: (v: string) => {
        viewKey = v;
        hook.rerender({ view: v });
      },
    };
  };

  it("forzar vale para esa categoría y no para las demás", () => {
    const { hook } = setup({ A: "t1", B: "t1" });
    act(() => hook.result.current.force("A"));
    expect(hook.result.current.isForced("A")).toBe(true);
    expect(hook.result.current.isForced("B")).toBe(false);
    act(() => hook.result.current.release());
    expect(hook.result.current.isForced("A")).toBe(false);
  });

  it("se pierde al cambiar de categoría en el cuadro, también al volver a la de antes", () => {
    const { hook, view } = setup({ A: "t1", B: "t1" });
    act(() => hook.result.current.force("A"));
    view("B|A");
    expect(hook.result.current.isForced("A")).toBe(false);
    view("A|A");
    // Hay que confirmarlo otra vez
    expect(hook.result.current.isForced("A")).toBe(false);
  });

  it("se pierde al ocultar el cuadro y no vuelve al publicarlo otra vez", () => {
    const { hook, setPublished } = setup({ A: "t1" });
    act(() => hook.result.current.force("A"));
    setPublished({ A: null });
    expect(hook.result.current.isForced("A")).toBe(false);
    setPublished({ A: "t2" });
    expect(hook.result.current.isForced("A")).toBe(false);
  });

  it("sin el cuadro publicado no hay nada que forzar", () => {
    const { hook } = setup({ A: null });
    act(() => hook.result.current.force("A"));
    expect(hook.result.current.isForced("A")).toBe(false);
  });
});
