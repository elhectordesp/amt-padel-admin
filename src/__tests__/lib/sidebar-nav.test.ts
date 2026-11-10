import { describe, it, expect } from "vitest";
import { navForRole } from "@/components/admin/sidebar";
import { canAccess, type ClubArea, type ClubStaffRole } from "@/lib/club-permissions";

describe("navForRole", () => {
  it("el gestor del club: lo diario arriba, sin Inscripciones ni Resultados", () => {
    expect(navForRole("club").map((i) => i.label)).toEqual([
      "Hoy", "Calendario", "Reservas", "Caja", "Clientes", "Torneos", "Mi club", "Equipo", "Patrocinadores",
    ]);
    const hrefs = navForRole("club").map((i) => i.href);
    expect(hrefs).toContain("/caja");
    expect(hrefs).not.toContain("/inscripciones");
    expect(hrefs).not.toContain("/resultados");
  });

  it("el equipo solo ve lo que su rol puede leer", () => {
    const can = (roles: ClubStaffRole[]) => ({ can: (a: ClubArea, l: "read" | "write" = "read") => canAccess(roles, a, l) });
    expect(navForRole("club", can(["COACH"])).map((i) => i.label)).toEqual(["Hoy", "Calendario", "Reservas"]);
    expect(navForRole("club", can(["RESULTS"])).map((i) => i.label)).toEqual(["Hoy", "Torneos"]);
    expect(navForRole("club", can(["MANAGER"])).map((i) => i.label)).toContain("Equipo");
    expect(navForRole("club", can(["OWNER"])).length).toBe(navForRole("club").length);
  });

  it("AMT conserva el menú completo", () => {
    const labels = navForRole("admin").map((i) => i.label);
    expect(labels[0]).toBe("Dashboard");
    expect(labels).toEqual(expect.arrayContaining(["Inscripciones", "Resultados", "Clubes", "Finanzas"]));
  });
});
