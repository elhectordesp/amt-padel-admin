/**
 * Bonos de reservas: lo que el panel dice de un bono (saldo, validez, cobro) y
 * los formularios del catálogo y de la devolución, comprobados antes de mandar.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_TYPE_FORM,
  VOUCHER_STATUS_LABEL,
  checkRefund,
  checkTypeForm,
  expiryLabel,
  futureSessionCount,
  isVoucherOpen,
  proportionalRefundCents,
  sessionsLabel,
  typeFormOf,
  typeOptionLabel,
  validityLabel,
  voucherPaymentLabel,
} from "@/lib/utils/voucher";
import type { ClubVoucherType } from "@/lib/services/club-vouchers";

describe("etiquetas", () => {
  it("cada estado tiene la suya", () => {
    expect(VOUCHER_STATUS_LABEL).toEqual({
      ACTIVE: "Activo",
      EXHAUSTED: "Agotado",
      EXPIRED: "Caducado",
      CANCELLED: "Cancelado",
    });
  });

  it("el saldo, con singular y plural", () => {
    expect(sessionsLabel({ remainingSessions: 7, sessions: 10 })).toBe("7 de 10 sesiones");
    expect(sessionsLabel({ remainingSessions: 1, sessions: 1 })).toBe("1 de 1 sesión");
  });

  it("la validez: días o sin caducidad", () => {
    expect(validityLabel(null)).toBe("Sin caducidad");
    expect(validityLabel(1)).toBe("1 día");
    expect(validityLabel(90)).toBe("90 días");
  });

  it("el cobro: pendiente, o cobrado con su método", () => {
    expect(voucherPaymentLabel({ paid: false, paymentMethod: null })).toBe("Pendiente de cobro");
    expect(voucherPaymentLabel({ paid: true, paymentMethod: "CARD" })).toBe("Cobrado · Tarjeta");
  });

  it("la caducidad se lee en la zona del club: el último instante del día local es ese día", () => {
    // 22:59:59.999Z del 19-11 es el 19-11 a las 23:59 en Madrid (CET, +1)
    expect(expiryLabel("2026-11-19T22:59:59.999Z", "Europe/Madrid")).toBe("Caduca el 19/11/2026");
    expect(expiryLabel(null, "Europe/Madrid")).toBe("Sin caducidad");
  });

  it("un tipo para elegir al vender", () => {
    expect(typeOptionLabel({ name: "Bono 10", sessions: 10, priceCents: 12000 })).toBe("Bono 10 · 10 sesiones · 120,00 €");
    expect(typeOptionLabel({ name: "Bono 10", kind: "COURT", sessions: 10, priceCents: 12000 })).toBe(
      "Bono 10 · 10 sesiones · 120,00 €",
    );
    // Los de clases privadas lo dicen para no confundirlos al vender
    expect(typeOptionLabel({ name: "Clases", kind: "PRIVATE_CLASS", sessions: 8, priceCents: 20000 })).toBe(
      "Clases · 8 sesiones · 200,00 € · clases privadas",
    );
  });

  it("solo uno cancelado deja de admitir acciones", () => {
    expect(isVoucherOpen({ status: "ACTIVE" })).toBe(true);
    expect(isVoucherOpen({ status: "EXHAUSTED" })).toBe(true);
    expect(isVoucherOpen({ status: "EXPIRED" })).toBe(true);
    expect(isVoucherOpen({ status: "CANCELLED" })).toBe(false);
  });
});

describe("checkTypeForm", () => {
  const form = (over: Partial<typeof EMPTY_TYPE_FORM> = {}): typeof EMPTY_TYPE_FORM => ({
    name: "Bono 10",
    kind: "COURT",
    sessions: "10",
    price: "120",
    validDays: "90",
    ...over,
  });

  it("un tipo bien escrito sale en céntimos y días", () => {
    expect(checkTypeForm(form())).toEqual({
      ok: true,
      value: { name: "Bono 10", kind: "COURT", sessions: 10, priceCents: 12000, validDays: 90 },
    });
  });

  it("el tipo de bono (pista o clases privadas) va tal cual; por defecto, de pista", () => {
    expect(EMPTY_TYPE_FORM.kind).toBe("COURT");
    expect(checkTypeForm(form({ kind: "PRIVATE_CLASS" }))).toMatchObject({
      ok: true,
      value: { kind: "PRIVATE_CLASS" },
    });
  });

  it("el precio con coma o con decimales; el nombre sin espacios de más", () => {
    expect(checkTypeForm(form({ name: "  Bono 5  ", price: "59,90" }))).toMatchObject({
      ok: true,
      value: { name: "Bono 5", priceCents: 5990 },
    });
  });

  it("sin días de validez, no caduca (null)", () => {
    expect(checkTypeForm(form({ validDays: "" }))).toMatchObject({ ok: true, value: { validDays: null } });
  });

  it("un precio de 0 € es válido", () => {
    expect(checkTypeForm(form({ price: "0" }))).toMatchObject({ ok: true, value: { priceCents: 0 } });
  });

  it("sin nombre, sin sesiones válidas, con el precio mal escrito o con días inválidos, no se manda", () => {
    expect(checkTypeForm(form({ name: "  " }))).toMatchObject({ ok: false });
    for (const sessions of ["", "0", "101", "2.5", "abc"]) {
      expect(checkTypeForm(form({ sessions }))).toMatchObject({ ok: false });
    }
    for (const price of ["", "abc", "12,345", "-5"]) {
      expect(checkTypeForm(form({ price }))).toMatchObject({ ok: false });
    }
    for (const validDays of ["0", "3651", "1.5", "x"]) {
      expect(checkTypeForm(form({ validDays }))).toMatchObject({ ok: false });
    }
  });

  it("los topes son los del back: 100 sesiones y 3650 días valen", () => {
    expect(checkTypeForm(form({ sessions: "100", validDays: "3650" }))).toMatchObject({ ok: true });
  });

  it("el formulario de un tipo guardado vuelve a escribirse tal cual", () => {
    const t: ClubVoucherType = {
      id: "t1", clubId: "c1", name: "Bono 10", kind: "PRIVATE_CLASS", sessions: 10, priceCents: 12050, validDays: null,
      active: true, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
    };
    expect(typeFormOf(t)).toEqual({ name: "Bono 10", kind: "PRIVATE_CLASS", sessions: "10", price: "120.5", validDays: "" });
    expect(checkTypeForm(typeFormOf(t))).toMatchObject({ ok: true, value: { priceCents: 12050, validDays: null } });
  });
});

describe("checkRefund", () => {
  it("vacío: no se devuelve nada", () => {
    expect(checkRefund("", 12000)).toEqual({ ok: true, value: 0 });
    expect(checkRefund("  ", 12000)).toEqual({ ok: true, value: 0 });
  });

  it("un importe en euros, hasta lo que costó el bono", () => {
    expect(checkRefund("60", 12000)).toEqual({ ok: true, value: 6000 });
    expect(checkRefund("120,00", 12000)).toEqual({ ok: true, value: 12000 });
  });

  it("más de lo que costó: no vale, y dice cuánto es", () => {
    const res = checkRefund("120,01", 12000);
    expect(res).toMatchObject({ ok: false });
    expect(res.ok === false && res.message).toContain("120,00");
  });

  it("mal escrito: no vale", () => {
    expect(checkRefund("doce", 12000)).toMatchObject({ ok: false });
    expect(checkRefund("-5", 12000)).toMatchObject({ ok: false });
  });
});

describe("devolución proporcional al cancelar", () => {
  const now = new Date("2026-11-19T10:00:00.000Z");
  const use = (startsAt: string | null) => ({
    id: "u", bookingId: null, privateClassId: null, usedAt: "2026-11-01T10:00:00.000Z", startsAt, courtName: null,
  });
  const voucher = (uses: ReturnType<typeof use>[], remainingSessions: number) => ({
    priceCents: 12000, sessions: 10, remainingSessions, uses,
  });

  it("cuenta como futuras solo las sesiones que empiezan después de ahora", () => {
    expect(
      futureSessionCount({ uses: [use("2026-11-18T10:00:00.000Z"), use("2026-11-20T10:00:00.000Z"), use(null)] }, now),
    ).toBe(1);
  });

  it("proporcional a lo que queda sin gastar", () => {
    expect(proportionalRefundCents(voucher([use("2026-11-01T10:00:00.000Z")], 7), now)).toBe(8400);
    expect(proportionalRefundCents(voucher([], 10), now)).toBe(12000);
    expect(proportionalRefundCents(voucher([], 0), now)).toBe(0);
  });

  it("las sesiones que aún no han empezado vuelven al bono y cuentan como sin gastar", () => {
    expect(
      proportionalRefundCents(voucher([use("2026-11-01T10:00:00.000Z"), use("2026-11-25T10:00:00.000Z")], 7), now),
    ).toBe(9600);
  });

  it("redondea al céntimo y nunca pasa del precio", () => {
    expect(proportionalRefundCents({ priceCents: 1000, sessions: 3, remainingSessions: 1, uses: [] }, now)).toBe(333);
    expect(proportionalRefundCents({ priceCents: 1000, sessions: 3, remainingSessions: 3, uses: [use("2026-11-25T10:00:00.000Z")] }, now)).toBe(1000);
  });
});
