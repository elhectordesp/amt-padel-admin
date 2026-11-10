import { describe, it, expect } from "vitest";
import { navForRole } from "@/components/admin/sidebar";

describe("navForRole", () => {
  it("el gestor del club: lo diario arriba, sin Inscripciones ni Resultados", () => {
    expect(navForRole("club").map((i) => i.label)).toEqual([
      "Hoy", "Calendario", "Reservas", "Caja", "Clientes", "Torneos", "Mi club", "Patrocinadores",
    ]);
    const hrefs = navForRole("club").map((i) => i.href);
    expect(hrefs).toContain("/caja");
    expect(hrefs).not.toContain("/inscripciones");
    expect(hrefs).not.toContain("/resultados");
  });

  it("AMT conserva el menú completo", () => {
    const labels = navForRole("admin").map((i) => i.label);
    expect(labels[0]).toBe("Dashboard");
    expect(labels).toEqual(expect.arrayContaining(["Inscripciones", "Resultados", "Clubes", "Finanzas"]));
  });
});
