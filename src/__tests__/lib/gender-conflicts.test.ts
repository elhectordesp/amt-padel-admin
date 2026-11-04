import { describe, it, expect } from "vitest";
import { genderConflictsNotice } from "../../../lib/gender-conflicts";

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
    expect(genderConflictsNotice([], "player")).toBeNull();
  });

  it("una: el torneo y la categoría, y qué hacer", () => {
    expect(genderConflictsNotice([inscription], "player")).toEqual({
      title: "Con su género nuevo ya no encaja en una inscripción:",
      items: [{ id: "r-1", text: "Open de otoño · 3ª Masculina" }],
      fix:   "Muévela a otra categoría o cámbiale la pareja en las inscripciones del torneo.",
    });
  });

  it("varias, y la invitación pendiente dice que ya no se podrá aceptar", () => {
    const notice = genderConflictsNotice([inscription, invitation], "player");
    expect(notice?.title).toBe("Con su género nuevo ya no encaja en 2 inscripciones:");
    expect(notice?.items).toEqual([
      { id: "r-1", text: "Open de otoño · 3ª Masculina" },
      { id: "r-2", text: "Liga de invierno · 2ª Mixta (invitación pendiente: ya no se podrá aceptar)" },
    ]);
    expect(notice?.fix).toBe("Muévelas a otra categoría o cámbiales la pareja en las inscripciones de cada torneo.");
  });
});

describe("genderConflictsNotice (al restaurar un torneo borrado)", () => {
  const conflict = (registrationId: string, categoryLabel: string, invitation = false) => ({
    registrationId, tournamentId: "t-9", tournamentName: "Open de primavera", categoryLabel, invitation,
  });

  it("si todo encaja, no hay aviso", () => {
    expect(genderConflictsNotice([], "restore")).toBeNull();
  });

  it("una: el torneo en el título, su categoría y qué hacer", () => {
    expect(genderConflictsNotice([conflict("r-1", "3ª Femenina")], "restore")).toEqual({
      title: "En «Open de primavera» una inscripción ya no encaja por género:",
      items: [{ id: "r-1", text: "3ª Femenina" }],
      fix:   "Muévela a otra categoría o cámbiale la pareja en las inscripciones del torneo.",
    });
  });

  it("varias: una línea por categoría, con cuántas, y las invitaciones aparte", () => {
    const notice = genderConflictsNotice([
      conflict("r-1", "3ª Femenina"),
      conflict("r-2", "2ª Mixta", true),
      conflict("r-3", "3ª Femenina"),
      conflict("r-4", "2ª Mixta"),
      conflict("r-5", "4ª Mixta", true),
      conflict("r-6", "4ª Mixta", true),
    ], "restore");
    expect(notice?.title).toBe("En «Open de primavera» 6 inscripciones ya no encajan por género:");
    expect(notice?.items).toEqual([
      { id: "r-1", text: "3ª Femenina (2 inscripciones)" },
      { id: "r-2", text: "2ª Mixta (invitación pendiente: ya no se podrá aceptar)" },
      { id: "r-4", text: "2ª Mixta" },
      { id: "r-5", text: "4ª Mixta (2 invitaciones pendientes: ya no se podrán aceptar)" },
    ]);
    expect(notice?.fix).toBe("Muévelas a otra categoría o cámbiales la pareja en las inscripciones del torneo.");
  });
});
