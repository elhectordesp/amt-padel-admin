import { describe, it, expect } from "vitest";
import { invitationNotice } from "../../../lib/player-invite";

describe("invitationNotice (P2-12)", () => {
  it("enviada: lo confirma", () => {
    expect(invitationNotice("sent")).toEqual({ kind: "success", text: expect.stringMatching(/enviado la invitación/) });
  });

  it("apagada en la configuración: avisa de que no ha salido y de dónde enviarla", () => {
    const n = invitationNotice("disabled");
    expect(n?.kind).toBe("warning");
    expect(n?.text).toMatch(/no se le ha enviado/i);
    expect(n?.text).toMatch(/desde su ficha/);
  });

  it("a un club (no ve la ficha ni la configuración) no le manda a la ficha", () => {
    const n = invitationNotice("disabled", { fromPlayerPage: false });
    expect(n?.kind).toBe("warning");
    expect(n?.text).not.toMatch(/ficha/);
    expect(invitationNotice("failed", { fromPlayerPage: false })?.text).toBe("No se pudo enviar la invitación por email.");
  });

  it("sin dato (no tocaba invitar, o un back anterior): nada que decir", () => {
    expect(invitationNotice(undefined)).toBeNull();
  });
});
