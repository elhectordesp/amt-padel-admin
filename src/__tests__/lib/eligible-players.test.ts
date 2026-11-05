/**
 * El buscador de jugadores de una categoría (D2): pide a la lista del back el
 * género que admite la categoría, así no salen los que no lo tienen en su
 * ficha. La mixta sin pareja elegida admite los dos: una búsqueda por cada
 * uno, juntas por puntos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/services/admin", () => ({ adminService: { players: { list: vi.fn() } } }));

import { adminService } from "@/lib/services/admin";
import { searchPlayersForCategory } from "@/lib/utils/eligible-players";

const player = (id: string, gender: "M" | "F", points: number) => ({ id, name: id, gender, points });
const list = vi.mocked(adminService.players.list);

describe("searchPlayersForCategory", () => {
  beforeEach(() => {
    list.mockReset();
  });

  it("sin regla (general, junior): una búsqueda sin género, que también trae a quien no lo tiene", async () => {
    list.mockResolvedValue({ data: [player("ana", "F", 10)] } as never);

    expect(await searchPlayersForCategory("an", null)).toEqual([player("ana", "F", 10)]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ q: "an", pageSize: 8 });
  });

  it("con un género (femenina, o la mixta con la pareja elegida): una búsqueda con él", async () => {
    list.mockResolvedValue({ data: [player("bea", "F", 5)] } as never);

    await searchPlayersForCategory("be", ["F"]);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ q: "be", gender: "F", pageSize: 8 });
  });

  it("sin ningún género (una categoría que el panel no conoce): nadie, sin preguntar al back", async () => {
    expect(await searchPlayersForCategory("an", [])).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it("con los dos (mixta sin pareja): una por género, juntas por puntos y hasta el tamaño pedido", async () => {
    list.mockImplementation(async (params) =>
      (params?.gender === "M"
        ? { data: [player("luis", "M", 30), player("pablo", "M", 5)] }
        : { data: [player("eva", "F", 20), player("sara", "F", 1)] }) as never,
    );

    const found = await searchPlayersForCategory("a", ["M", "F"], 3);

    expect(list).toHaveBeenCalledWith({ q: "a", gender: "M", pageSize: 3 });
    expect(list).toHaveBeenCalledWith({ q: "a", gender: "F", pageSize: 3 });
    expect(found.map((p) => p.id)).toEqual(["luis", "eva", "pablo"]);
  });
});
