import { describe, it, expect } from "vitest";
import { playerEditProblem, playerUpdatePayload } from "../../../lib/player-edit";

const noLevel = { level: null };

describe("playerUpdatePayload («Editar datos» de la ficha)", () => {
  it("sin categoría y sin tocarla: no la manda (antes le grababa 4ª, D6)", () => {
    const payload = playerUpdatePayload({ email: "nuevo@x.com", categoryLevel: null }, noLevel);
    expect(payload.categoryLevel).toBeUndefined();
    expect(payload.email).toBe("nuevo@x.com");
  });

  it("con categoría y sin tocarla: no la manda", () => {
    expect(playerUpdatePayload({ categoryLevel: "3a" }, { level: "3a" }).categoryLevel).toBeUndefined();
  });

  it("si la cambia, manda la nueva", () => {
    expect(playerUpdatePayload({ categoryLevel: "2a" }, { level: "3a" }).categoryLevel).toBe("2a");
    expect(playerUpdatePayload({ categoryLevel: "5a" }, noLevel).categoryLevel).toBe("5a");
  });

  it("«Sin asignar» a quien tenía una: manda null y el back se la quita", () => {
    const payload = playerUpdatePayload({ categoryLevel: null }, { level: "4a" });
    expect(payload).toHaveProperty("categoryLevel", null);
  });

  it("un texto vacío que ya estaba vacío no se manda; con contenido, recortado", () => {
    const payload = playerUpdatePayload({ email: "  ", phone: "", city: " Madrid ", bio: "" }, noLevel);
    expect(payload.email).toBeUndefined();
    expect(payload.phone).toBeUndefined();
    expect(payload.city).toBe("Madrid");
    expect(payload.bio).toBeUndefined();
  });

  it("vaciar el teléfono, la ciudad, la bio o el email que tenía los borra: null (B-M-03)", () => {
    const payload = playerUpdatePayload(
      { email: "", phone: " ", city: "", bio: "" },
      { level: null, email: "ana@x.com", phone: "600000000", city: "Madrid", bio: "Zurda" },
    );
    expect(payload).toMatchObject({ email: null, phone: null, city: null, bio: null });
  });
});

describe("playerEditProblem", () => {
  const current = { level: null, email: "ana@x.com" };

  it("a quien ya usa la app no se le puede dejar sin email (entra con él)", () => {
    expect(playerEditProblem({ email: "" }, { ...current, usesApp: true })).toMatch(/no se le puede dejar sin email/);
  });

  it("a una cuenta gestionada sin activar sí", () => {
    expect(playerEditProblem({ email: "" }, { ...current, usesApp: false })).toBeNull();
  });

  it("cambiar el email (sin vaciarlo) siempre se puede", () => {
    expect(playerEditProblem({ email: "nuevo@x.com" }, { ...current, usesApp: true })).toBeNull();
  });
});
