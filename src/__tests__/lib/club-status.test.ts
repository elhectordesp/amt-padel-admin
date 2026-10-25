import { describe, it, expect } from "vitest";
import { clubStatus, clubToggle } from "../../../lib/club-status";

describe("clubStatus", () => {
  it("activo", () => {
    expect(clubStatus({ active: true, deactivatedAt: null })).toBe("active");
  });

  it("inactivo con fecha: lo desactivó AMT", () => {
    expect(clubStatus({ active: false, deactivatedAt: "2026-10-01T10:00:00.000Z" })).toBe("deactivated");
  });

  it("inactivo sin fecha: por configurar (alta rápida)", () => {
    expect(clubStatus({ active: false, deactivatedAt: null })).toBe("pending");
  });

  it("inactivo con un back anterior (sin deactivatedAt): no se sabe, como antes", () => {
    expect(clubStatus({ active: false })).toBe("inactive");
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
