import { describe, it, expect } from "vitest";
import { navForRole } from "@/components/admin/sidebar";
import { canAccess, type ClubArea, type ClubStaffRole } from "@/lib/club-permissions";

describe("navForRole", () => {
  it("el gestor del club: lo diario arriba, sin Inscripciones ni Resultados", () => {
    expect(navForRole("club").map((i) => i.label)).toEqual([
      "Hoy", "Calendario", "Reservas", "Caja", "Clientes", "Mensajes", "Escuela", "Torneos", "Ligas", "Mi club", "Equipo", "Historial", "Patrocinadores",
    ]);
    expect(navForRole("club").find((i) => i.label === "Escuela")?.href).toBe("/mi-club/escuela");
    const hrefs = navForRole("club").map((i) => i.href);
    expect(hrefs).toContain("/caja");
    expect(hrefs).not.toContain("/inscripciones");
    expect(hrefs).not.toContain("/resultados");
  });

  it("el equipo solo ve lo que su rol puede leer", () => {
    const can = (roles: ClubStaffRole[]) => ({ can: (a: ClubArea, l: "read" | "write" = "read") => canAccess(roles, a, l) });
    expect(navForRole("club", can(["COACH"])).map((i) => i.label)).toEqual(["Hoy", "Calendario", "Reservas", "Escuela"]);
    expect(navForRole("club", can(["RESULTS"])).map((i) => i.label)).toEqual(["Hoy", "Torneos", "Ligas"]);
    // La escuela la ven recepción y el entrenador; torneos no
    expect(navForRole("club", can(["RECEPTION"])).map((i) => i.label)).toContain("Escuela");
    expect(navForRole("club", can(["TOURNAMENTS"])).map((i) => i.label)).not.toContain("Escuela");
    expect(navForRole("club", can(["MANAGER"])).map((i) => i.label)).toContain("Equipo");
    // El historial del club lo lee quien lee el equipo: propietario y gestor
    expect(navForRole("club", can(["OWNER"])).map((i) => i.label)).toContain("Historial");
    expect(navForRole("club", can(["MANAGER"])).map((i) => i.label)).toContain("Historial");
    for (const role of ["TOURNAMENTS", "RESULTS", "RECEPTION", "COACH"] as ClubStaffRole[]) {
      expect(navForRole("club", can([role])).map((i) => i.label)).not.toContain("Historial");
    }
    expect(navForRole("club", can(["OWNER"])).length).toBe(navForRole("club").length);
  });

  it("AMT conserva el menú completo", () => {
    const labels = navForRole("admin").map((i) => i.label);
    expect(labels[0]).toBe("Dashboard");
    expect(labels).toEqual(expect.arrayContaining(["Ligas", "Inscripciones", "Resultados", "Clubes", "Finanzas"]));
  });
});
