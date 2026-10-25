import { describe, it, expect } from "vitest";
import { playerUpdatePayload } from "../../../lib/player-edit";

describe("playerUpdatePayload («Editar datos» de la ficha)", () => {
  it("sin categoría y sin tocarla: no la manda (antes le grababa 4ª, D6)", () => {
    const payload = playerUpdatePayload({ email: "nuevo@x.com", categoryLevel: null }, null);
    expect(payload.categoryLevel).toBeUndefined();
    expect(payload.email).toBe("nuevo@x.com");
  });

  it("con categoría y sin tocarla: no la manda", () => {
    expect(playerUpdatePayload({ categoryLevel: "3a" }, "3a").categoryLevel).toBeUndefined();
  });

  it("si la cambia, manda la nueva", () => {
    expect(playerUpdatePayload({ categoryLevel: "2a" }, "3a").categoryLevel).toBe("2a");
    expect(playerUpdatePayload({ categoryLevel: "5a" }, null).categoryLevel).toBe("5a");
  });

  it("«Sin asignar» a quien tenía una: manda null y el back se la quita", () => {
    const payload = playerUpdatePayload({ categoryLevel: null }, "4a");
    expect(payload).toHaveProperty("categoryLevel", null);
  });

  it("los textos vacíos no se mandan", () => {
    const payload = playerUpdatePayload({ email: "  ", phone: "", city: " Madrid ", bio: "" }, null);
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBeUndefined();
    expect(payload.city).toBe("Madrid");
    expect(payload.bio).toBeUndefined();
  });
});
