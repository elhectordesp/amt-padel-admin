import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/services/admin", () => ({ adminService: { me: vi.fn() } }));

import { canManageAdmins, roleLabel } from "../../../lib/use-me";

describe("roleLabel", () => {
  it.each([
    ["SUPERADMIN", "Super Admin"],
    ["ADMIN", "Admin"],
    ["CLUB", "Admin de club"],
    ["PLAYER", "Jugador"],
  ])("%s → %s", (role, label) => {
    expect(roleLabel(role)).toBe(label);
  });

  it("sin rol (aún no se sabe, o un back anterior): vacío, nunca «Super Admin»", () => {
    expect(roleLabel(undefined)).toBe("");
    expect(roleLabel(null)).toBe("");
    expect(roleLabel("OTRO")).toBe("");
  });
});

describe("canManageAdmins", () => {
  it("solo el Super Admin gestiona administradores (D4)", () => {
    expect(canManageAdmins({ id: "u", name: "S", role: "SUPERADMIN" })).toBe(true);
    expect(canManageAdmins({ id: "u", name: "A", role: "ADMIN" })).toBe(false);
    expect(canManageAdmins({ id: "u", name: "C", role: "CLUB" })).toBe(false);
  });

  it("si el back no dice el rol (versión anterior), sí: decide el back", () => {
    expect(canManageAdmins({ id: "u", name: "A" })).toBe(true);
  });

  it("mientras no se sabe quién es, no", () => {
    expect(canManageAdmins(undefined)).toBe(false);
  });
});
