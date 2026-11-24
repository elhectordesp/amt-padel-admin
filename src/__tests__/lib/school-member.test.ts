/**
 * El alumno dentro de un grupo (F8-C3): el formulario de cómo paga, su
 * descuento y su baja temporal con las reglas del back, y los textos con que se
 * enseña.
 */
import { describe, it, expect } from "vitest";
import {
  checkMemberForm,
  discountLabel,
  memberFormOf,
  pauseLabel,
  voucherBillingLabel,
  type MemberFormValues,
} from "@/lib/utils/school-member";
import type { SchoolGroupMember } from "@/types/school";

const member = (over: Partial<SchoolGroupMember> = {}): SchoolGroupMember => ({
  id: "m1",
  clubCustomerId: "cc1",
  name: "Marta",
  joinedAt: "2026-09-14T10:00:00.000Z",
  leftAt: null,
  billing: "MONTHLY",
  discountCents: null,
  discountReason: null,
  pausedFrom: null,
  pausedUntil: null,
  pauseReason: null,
  voucherRemaining: null,
  ...over,
});

const TODAY = "2026-11-20";

const form = (over: Partial<MemberFormValues> = {}): MemberFormValues => ({ ...memberFormOf(member(), TODAY), ...over });

describe("memberFormOf", () => {
  it("el descuento y la baja tal como se escriben", () => {
    expect(
      memberFormOf(
        member({
          discountCents: 750,
          discountReason: "Hermanos",
          pausedFrom: "2026-11-02",
          pausedUntil: "2026-12-01",
          pauseReason: "Lesión",
        }),
        TODAY,
      ),
    ).toEqual({
      billing: "MONTHLY",
      discount: "7,50",
      discountReason: "Hermanos",
      paused: true,
      pausedFrom: "2026-11-02",
      pausedUntil: "2026-12-01",
      pauseReason: "Lesión",
    });
    expect(memberFormOf(member(), TODAY)).toMatchObject({ discount: "", paused: false, pausedFrom: "" });
  });

  it("una baja que ya cerró el back (volvió hoy o antes) no cuenta como baja en el formulario", () => {
    expect(
      memberFormOf(member({ pausedFrom: "2026-11-02", pausedUntil: TODAY, pauseReason: "Lesión" }), TODAY),
    ).toMatchObject({ paused: false, pausedFrom: "", pausedUntil: "", pauseReason: "" });
  });
});

describe("checkMemberForm", () => {
  it("sin cambios, nada que mandar", () => {
    expect(checkMemberForm(form(), member(), 8000, TODAY)).toEqual({ ok: true, value: {} });
  });

  it("solo manda lo que cambia: pasar a bono", () => {
    expect(checkMemberForm(form({ billing: "VOUCHER" }), member(), 8000, TODAY)).toEqual({
      ok: true,
      value: { billing: "VOUCHER" },
    });
  });

  it("un descuento en euros sale en céntimos y lleva su motivo", () => {
    expect(checkMemberForm(form({ discount: "10", discountReason: " Hermanos " }), member(), 8000, TODAY)).toEqual({
      ok: true,
      value: { discountCents: 1000, discountReason: "Hermanos" },
    });
  });

  it("un descuento sin motivo, mayor que la cuota o mal escrito no se manda", () => {
    expect(checkMemberForm(form({ discount: "10" }), member(), 8000, TODAY)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/motivo/),
    });
    expect(checkMemberForm(form({ discount: "80,01", discountReason: "x" }), member(), 8000, TODAY)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/mayor que la cuota/),
    });
    expect(checkMemberForm(form({ discount: "diez", discountReason: "x" }), member(), 8000, TODAY).ok).toBe(false);
    expect(checkMemberForm(form({ discount: "5", discountReason: "x" }), member(), null, TODAY)).toMatchObject({
      ok: false,
      message: expect.stringMatching(/no tiene cuota/),
    });
  });

  it("vaciar el descuento lo quita (null)", () => {
    const withDiscount = member({ discountCents: 1000, discountReason: "Hermanos" });
    expect(checkMemberForm(form({ discount: "", discountReason: "" }), withDiscount, 8000, TODAY)).toEqual({
      ok: true,
      value: { discountCents: null },
    });
    // Pasar a bono también lo deja sin descuento
    expect(checkMemberForm(form({ billing: "VOUCHER", discount: "10", discountReason: "x" }), withDiscount, 8000, TODAY)).toEqual({
      ok: true,
      value: { billing: "VOUCHER", discountCents: null },
    });
  });

  it("una baja temporal con vuelta prevista y motivo", () => {
    expect(
      checkMemberForm(
        form({ paused: true, pausedFrom: "2026-11-02", pausedUntil: "2026-12-01", pauseReason: " Lesión " }),
        member(),
        8000,
        TODAY,
      ),
    ).toEqual({
      ok: true,
      value: { pausedFrom: "2026-11-02", pausedUntil: "2026-12-01", pauseReason: "Lesión" },
    });
  });

  it("la vuelta no puede ser anterior al inicio; los días tienen que existir", () => {
    expect(
      checkMemberForm(form({ paused: true, pausedFrom: "2026-11-10", pausedUntil: "2026-11-09" }), member(), 8000, TODAY),
    ).toMatchObject({ ok: false, message: expect.stringMatching(/anterior/) });
    expect(checkMemberForm(form({ paused: true, pausedFrom: "" }), member(), 8000, TODAY).ok).toBe(false);
    expect(checkMemberForm(form({ paused: true, pausedFrom: "2026-02-30" }), member(), 8000, TODAY).ok).toBe(false);
    expect(
      checkMemberForm(form({ paused: true, pausedFrom: "2026-11-10", pausedUntil: "2026-02-30" }), member(), 8000, TODAY).ok,
    ).toBe(false);
  });

  it("«Vuelve el…» sobre una baja que ya existe solo manda la vuelta", () => {
    const paused = member({ pausedFrom: "2026-11-02", pausedUntil: null, pauseReason: "Lesión" });
    expect(checkMemberForm(memberFormOfWith(paused, { pausedUntil: "2026-12-01" }), paused, 8000, TODAY)).toEqual({
      ok: true,
      value: { pausedUntil: "2026-12-01" },
    });
  });

  it("quitar la baja manda pausedFrom null (el back la cierra hoy o la quita entera)", () => {
    const paused = member({ pausedFrom: "2026-11-02", pausedUntil: "2026-12-01" });
    expect(checkMemberForm(memberFormOfWith(paused, { paused: false }), paused, 8000, TODAY)).toEqual({
      ok: true,
      value: { pausedFrom: null },
    });
  });

  it("una baja ya cerrada no se vuelve a quitar: sin cambios", () => {
    const closed = member({ pausedFrom: "2026-11-02", pausedUntil: TODAY });
    expect(checkMemberForm(memberFormOfWith(closed, {}), closed, 8000, TODAY)).toEqual({ ok: true, value: {} });
  });
});

function memberFormOfWith(m: SchoolGroupMember, over: Partial<MemberFormValues>): MemberFormValues {
  return { ...memberFormOf(m, TODAY), ...over };
}

describe("textos del alumno", () => {
  it("de baja hasta cuándo, o sin fecha; null si no está de baja", () => {
    expect(pauseLabel({ pausedFrom: null, pausedUntil: null }, TODAY)).toBeNull();
    expect(pauseLabel({ pausedFrom: "2026-11-02", pausedUntil: null }, TODAY)).toBe("De baja (sin fecha de vuelta)");
    expect(pauseLabel({ pausedFrom: "2026-11-02", pausedUntil: "2026-12-15" }, TODAY)).toBe("De baja hasta el 15 dic");
    // Una baja que el back cerró hoy (o que ya acabó) no se enseña como baja
    expect(pauseLabel({ pausedFrom: "2026-11-02", pausedUntil: TODAY }, TODAY)).toBeNull();
  });

  it("paga con bono, con las clases que le quedan", () => {
    expect(voucherBillingLabel({ billing: "MONTHLY", voucherRemaining: null })).toBeNull();
    expect(voucherBillingLabel({ billing: "VOUCHER", voucherRemaining: 3 })).toBe("Paga con bono (quedan 3)");
    expect(voucherBillingLabel({ billing: "VOUCHER", voucherRemaining: 0 })).toBe("Paga con bono (quedan 0)");
    expect(voucherBillingLabel({ billing: "VOUCHER", voucherRemaining: null })).toBe("Paga con bono");
  });

  it("el descuento con su motivo", () => {
    expect(discountLabel({ discountCents: null, discountReason: null })).toBeNull();
    expect(discountLabel({ discountCents: 1000, discountReason: "Hermanos" })).toBe("− 10,00 € (Hermanos)");
  });
});
