import { describe, it, expect } from "vitest";
import { clubStatus, clubToggle, toggleConfirm } from "../../../lib/utils/club-status";

describe("clubStatus", () => {
  it("usa el estado que calcula el back", () => {
    expect(clubStatus({ active: true, status: "active" })).toBe("active");
    expect(clubStatus({ active: false, status: "deactivated" })).toBe("deactivated");
    expect(clubStatus({ active: false, status: "pending" })).toBe("pending");
  });

  it("con un back anterior (sin status) no lo deduce: inactivo, como antes", () => {
    expect(clubStatus({ active: false })).toBe("inactive");
    expect(clubStatus({ active: true })).toBe("active");
  });
});

describe("clubToggle", () => {
  it("activo o por configurar: desactivar (su admin queda fuera)", () => {
    expect(clubToggle("active")).toBe("deactivate");
    expect(clubToggle("pending")).toBe("deactivate");
  });

  it("desactivado: reactivar", () => {
    expect(clubToggle("deactivated")).toBe("reactivate");
  });

  it("back anterior: activar, como antes", () => {
    expect(clubToggle("inactive")).toBe("activate");
  });
});

describe("toggleConfirm (los textos)", () => {
  it("desactivar uno activo: deja de salir en la app", () => {
    const c = toggleConfirm({ active: true, status: "active" });
    expect(c).toMatchObject({ action: "deactivate", label: "Desactivar", danger: true });
    expect(c.description).toContain("Dejará de salir en la app");
  });

  it("desactivar uno por configurar: su admin pierde el acceso y ya no se activará solo", () => {
    const c = toggleConfirm({ active: false, status: "pending" });
    expect(c.description).not.toContain("dejará de salir en la app");
    expect(c.description).toContain("Su admin perderá el acceso");
    expect(c.description).toContain("habrá que reactivarlo a mano");
  });

  it("reactivar uno configurado: vuelve a salir en la app y su admin entra", () => {
    const c = toggleConfirm({ active: false, status: "deactivated", pendingSetup: false });
    expect(c).toMatchObject({ action: "reactivate", label: "Reactivar", danger: false });
    expect(c.description).toBe("Volverá a salir en la app y su admin podrá entrar.");
  });

  it("reactivar uno que sigue por configurar: no saldrá en la app hasta tener sus datos", () => {
    const c = toggleConfirm({ active: false, status: "deactivated", pendingSetup: true });
    expect(c.description).toContain("no saldrá en la app hasta que su admin ponga");
  });
});
