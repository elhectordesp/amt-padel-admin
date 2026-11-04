import { describe, it, expect } from "vitest";
import { genderConflictsNotice, playerEditProblem, playerUpdatePayload } from "../../../lib/player-edit";

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

  it("el género sin tocar no se manda (a quien no lo tenía se le grababa Masculino)", () => {
    expect(playerUpdatePayload({ gender: "F" }, { level: null, gender: "F" }).gender).toBeUndefined();
    // Sin género y sin elegirle uno
    expect(playerUpdatePayload({ email: "ana@x.com" }, { level: null, gender: null }).gender).toBeUndefined();
  });

  it("si se le cambia el género, o se le elige uno a quien no lo tenía, manda el nuevo", () => {
    expect(playerUpdatePayload({ gender: "M" }, { level: null, gender: "F" }).gender).toBe("M");
    expect(playerUpdatePayload({ gender: "F" }, { level: null, gender: null }).gender).toBe("F");
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

describe("genderConflictsNotice (tras cambiarle el género)", () => {
  const inscription = {
    registrationId: "r-1", tournamentId: "t-1", tournamentName: "Open de otoño",
    categoryLabel: "3ª Masculina", invitation: false,
  };
  const invitation = {
    registrationId: "r-2", tournamentId: "t-2", tournamentName: "Liga de invierno",
    categoryLabel: "2ª Mixta", invitation: true,
  };

  it("si todo encaja (o no se cambió el género), no hay aviso", () => {
    expect(genderConflictsNotice([])).toBeNull();
  });

  it("una: el torneo y la categoría, y qué hacer", () => {
    expect(genderConflictsNotice([inscription])).toEqual({
      title: "Con su género nuevo ya no encaja en una inscripción:",
      items: [{ id: "r-1", text: "Open de otoño · 3ª Masculina" }],
      fix:   "Muévela a otra categoría o cámbiale la pareja en las inscripciones del torneo.",
    });
  });

  it("varias, y la invitación pendiente dice que ya no se podrá aceptar", () => {
    const notice = genderConflictsNotice([inscription, invitation]);
    expect(notice?.title).toBe("Con su género nuevo ya no encaja en 2 inscripciones:");
    expect(notice?.items).toEqual([
      { id: "r-1", text: "Open de otoño · 3ª Masculina" },
      { id: "r-2", text: "Liga de invierno · 2ª Mixta (invitación pendiente: ya no se podrá aceptar)" },
    ]);
    expect(notice?.fix).toBe("Muévelas a otra categoría o cámbiales la pareja en las inscripciones de cada torneo.");
  });
});
