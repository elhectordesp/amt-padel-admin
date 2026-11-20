import { describe, it, expect } from "vitest";
import { isLeaguePath, kindWord, tournamentsBase } from "@/lib/league";

describe("league", () => {
  it("las rutas de /ligas son de liga; las de /torneos y el resto, no", () => {
    expect(isLeaguePath("/ligas")).toBe(true);
    expect(isLeaguePath("/ligas/nuevo")).toBe(true);
    expect(isLeaguePath("/ligas/l1/editar")).toBe(true);
    expect(isLeaguePath("/torneos")).toBe(false);
    expect(isLeaguePath("/ligaspublicas")).toBe(false);
    expect(isLeaguePath(null)).toBe(false);
  });

  it("raíz y palabra del tipo; sin tipo (back anterior), torneo", () => {
    expect(tournamentsBase("LEAGUE")).toBe("/ligas");
    expect(tournamentsBase("TOURNAMENT")).toBe("/torneos");
    expect(tournamentsBase(undefined)).toBe("/torneos");
    expect(kindWord("LEAGUE")).toBe("liga");
    expect(kindWord(undefined)).toBe("torneo");
  });
});
