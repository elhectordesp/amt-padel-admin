import { describe, it, expect } from "vitest";
import { ApiError } from "../../../lib/api";
import {
  adminSinceLabel, clubAdminsQueryKey, invitationDetail, invitationEmailFailed,
  invitationErrorMessage, invitationStatusLabel, invitationsChangedMeanwhile,
} from "../../../lib/utils/club-invitations";

describe("invitationStatusLabel", () => {
  it("pendiente o caducada, según lo que calcula el back", () => {
    expect(invitationStatusLabel("pending")).toBe("Pendiente");
    expect(invitationStatusLabel("expired")).toBe("Caducada");
  });
});

describe("invitationDetail", () => {
  const base = {
    createdAt: "2026-10-30T09:00:00.000Z",
    expiresAt: "2026-11-06T09:00:00.000Z",
    invitedBy: { id: "amt-1", name: "Ana AMT" },
  };

  it("pendiente: cuándo se mandó, quién y cuándo caduca", () => {
    expect(invitationDetail({ ...base, status: "pending" }))
      .toBe("Enviada el 30/10/26 por Ana AMT · caduca el 6/11/26");
  });

  it("caducada: cuándo caducó", () => {
    expect(invitationDetail({ ...base, status: "expired" }))
      .toBe("Enviada el 30/10/26 por Ana AMT · caducó el 6/11/26");
  });

  it("sin quién la mandó (ya no está), sin «por»", () => {
    expect(invitationDetail({ ...base, invitedBy: null, status: "pending" }))
      .toBe("Enviada el 30/10/26 · caduca el 6/11/26");
  });

  it("las fechas, en la hora de España y no en la del navegador", () => {
    // 23:30 UTC del 31/10 ya es 1/11 en Madrid (horario de invierno, +1)
    expect(invitationDetail({
      createdAt: "2026-10-31T23:30:00.000Z",
      expiresAt: "2026-11-07T23:30:00.000Z",
      invitedBy: null,
      status: "pending",
    })).toBe("Enviada el 1/11/26 · caduca el 8/11/26");
  });
});

describe("adminSinceLabel", () => {
  it("desde cuándo administra el club", () => {
    expect(adminSinceLabel("2026-09-01T10:00:00.000Z")).toBe("Desde el 1/9/26");
  });
});

describe("invitationsChangedMeanwhile", () => {
  it("se aceptó, se anuló o se reenvió sin email mientras tanto: hay que recargar la lista", () => {
    expect(invitationsChangedMeanwhile(new ApiError("No está", 404, "CLUB_INVITATION_NOT_FOUND"))).toBe(true);
    expect(invitationsChangedMeanwhile(new ApiError("Aceptada", 409, "CLUB_INVITATION_ALREADY_ACCEPTED"))).toBe(true);
    expect(invitationsChangedMeanwhile(new ApiError("Sin email", 503, "INVITE_EMAIL_FAILED"))).toBe(true);
  });

  it("los demás errores no la cambian", () => {
    expect(invitationsChangedMeanwhile(new ApiError("Desactivado", 409, "CLUB_DEACTIVATED"))).toBe(false);
    expect(invitationsChangedMeanwhile(new ApiError("Registrado", 409, "CLUB_INVITATION_EMAIL_TAKEN"))).toBe(false);
    expect(invitationsChangedMeanwhile(new ApiError("Error de conexión"))).toBe(false);
    expect(invitationsChangedMeanwhile(new Error("CLUB_INVITATION_NOT_FOUND"))).toBe(false);
  });
});

describe("invitationErrorMessage", () => {
  it("si el email no salió, dice que la invitación quedó creada y que se puede reenviar", () => {
    const err = new ApiError("No se pudo enviar el email de invitación.", 503, "INVITE_EMAIL_FAILED");
    expect(invitationEmailFailed(err)).toBe(true);
    expect(invitationErrorMessage(err)).toBe(
      "La invitación está creada, pero el email no ha salido. Reenvíala desde la lista en unos minutos.",
    );
  });

  it("los demás, el mensaje del back", () => {
    const err = new ApiError("Ese email ya está registrado en la plataforma", 409, "CLUB_INVITATION_EMAIL_TAKEN");
    expect(invitationEmailFailed(err)).toBe(false);
    expect(invitationErrorMessage(err)).toBe("Ese email ya está registrado en la plataforma");
    expect(invitationEmailFailed(new Error("INVITE_EMAIL_FAILED"))).toBe(false);
  });
});

describe("clubAdminsQueryKey", () => {
  it("una por club", () => {
    expect(clubAdminsQueryKey("c1")).toEqual(["admin-club-admins", "c1"]);
    expect(clubAdminsQueryKey("c1")).not.toEqual(clubAdminsQueryKey("c2"));
  });
});
