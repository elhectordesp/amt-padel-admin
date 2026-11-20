import { describe, it, expect } from "vitest";
import {
  PRICE_CUSTOM, PRICE_MEMBER, PRICE_NORMAL, accountsErrorText, canCollectWhole, namedPriceChoice,
  partDots, partWho, partsDebtLabel, partsDescription, partsOpenDebtCents, priceChoiceOf, refundableOfPart, studentOption,
  studentSuggestion, updateForChoice,
} from "@/lib/utils/booking-parts";
import { paymentAction } from "@/lib/utils/booking-payment";
import { daysText } from "@/lib/utils/accounts-config";
import { methodLabel } from "@/lib/utils/payment-methods";
import type { PartPriceOption } from "@/lib/services/booking-parts";

const STUDENT_OPTION: PartPriceOption = { partPriceId: "pp-alumno", name: "Alumno", kind: "STUDENT", perCourt: false, priceCents: 500 };
const FRIEND_OPTION: PartPriceOption = { partPriceId: "pp-amigo", name: "Amigo del club", kind: "SPECIAL", perCourt: false, priceCents: 400 };
const VIEW = { priceOptions: [FRIEND_OPTION, STUDENT_OPTION] };

describe("puntos de color del calendario", () => {
  it("un punto por parte, cobradas primero y sin cobrar al final", () => {
    const summary = { count: 4, paid: 2, pending: 1, debt: 1, invited: 0 };
    expect(partDots(summary)).toEqual(["paid", "paid", "debt", "pending"]);
  });

  it("se lee en llano para quien no ve los colores", () => {
    expect(partsDescription({ count: 4, paid: 2, pending: 1, debt: 1, invited: 0 })).toBe("2 cobradas, 1 debe, 1 sin cobrar");
    expect(partsDescription({ count: 4, paid: 1, pending: 0, debt: 2, invited: 1 })).toBe("1 cobrada, 2 deben, 1 invitada");
  });
});

describe("precio de una parte", () => {
  it("la opción elegida sale del tipo de la parte", () => {
    expect(priceChoiceOf({ kind: "NORMAL", partPriceId: null })).toBe(PRICE_NORMAL);
    expect(priceChoiceOf({ kind: "MEMBER", partPriceId: null })).toBe(PRICE_MEMBER);
    expect(priceChoiceOf({ kind: "CUSTOM", partPriceId: null })).toBe(PRICE_CUSTOM);
    expect(priceChoiceOf({ kind: "SPECIAL", partPriceId: "pp-amigo" })).toBe(namedPriceChoice("pp-amigo"));
  });

  it("al elegir una opción se manda lo que pide el contrato; «Otro precio» no, pide importe y motivo", () => {
    expect(updateForChoice(PRICE_NORMAL)).toEqual({ kind: "NORMAL" });
    expect(updateForChoice(PRICE_MEMBER)).toEqual({ kind: "MEMBER" });
    expect(updateForChoice(namedPriceChoice("pp-amigo"))).toEqual({ kind: "SPECIAL", partPriceId: "pp-amigo" });
    expect(updateForChoice(PRICE_CUSTOM)).toBeNull();
  });
});

describe("parte de un alumno", () => {
  const student = { isStudent: true, status: "PENDING" as const, kind: "NORMAL" as const, partPriceId: null };

  it("propone el precio de alumno, y no cualquier precio especial", () => {
    expect(studentOption(VIEW)).toBe(STUDENT_OPTION);
    expect(studentSuggestion(student, VIEW)).toBe(STUDENT_OPTION);
  });

  it("no avisa si no es alumno, si ya lo lleva puesto, si la parte ya no está sin cobrar o si no hay franja", () => {
    expect(studentSuggestion({ ...student, isStudent: false }, VIEW)).toBeNull();
    expect(studentSuggestion({ ...student, kind: "SPECIAL", partPriceId: "pp-alumno" }, VIEW)).toBeNull();
    expect(studentSuggestion({ ...student, status: "PAID" }, VIEW)).toBeNull();
    expect(studentSuggestion(student, { priceOptions: [FRIEND_OPTION] })).toBeNull();
  });

  it("con otro precio especial puesto, sigue proponiendo el de alumno", () => {
    expect(studentSuggestion({ ...student, kind: "SPECIAL", partPriceId: "pp-amigo" }, VIEW)).toBe(STUDENT_OPTION);
  });
});

describe("quién y cuánto queda", () => {
  it("el cliente manda sobre el nombre libre; sin ninguno, nadie", () => {
    expect(partWho({ customerName: "Ana", label: "Pepe" })).toBe("Ana");
    expect(partWho({ customerName: null, label: "Pepe" })).toBe("Pepe");
    expect(partWho({ customerName: null, label: null })).toBeNull();
  });

  it("se vuelve a cobrar entera solo si todas están sin cobrar", () => {
    expect(canCollectWhole([{ status: "PENDING" }, { status: "PENDING" }])).toBe(true);
    expect(canCollectWhole([{ status: "PENDING" }, { status: "DEBT" }])).toBe(false);
  });

  it("se puede devolver lo cobrado menos lo ya devuelto, solo de una parte cobrada", () => {
    expect(refundableOfPart({ status: "PAID", priceCents: 500, refundAmountCents: null })).toBe(500);
    expect(refundableOfPart({ status: "PAID", priceCents: 500, refundAmountCents: 200 })).toBe(300);
    expect(refundableOfPart({ status: "PENDING", priceCents: 500, refundAmountCents: null })).toBe(0);
  });
});

describe("errores del módulo", () => {
  const err = (code: string) => Object.assign(new Error("x"), { code });

  it("cada código nuevo sale con su mensaje en castellano", () => {
    expect(accountsErrorText(err("ACCOUNTS_DISABLED"))).toMatch(/no está activado/);
    expect(accountsErrorText(err("ACCOUNTS_IN_USE"))).toMatch(/Desactívalo/);
    expect(accountsErrorText(err("BOOKING_HAS_PARTS"))).toMatch(/por partes/);
    expect(accountsErrorText(err("BOOKING_PARTS_LOCKED"))).toMatch(/Deshazla/);
    expect(accountsErrorText(err("BOOKING_ALREADY_COLLECTED"))).toMatch(/cobrada entera/);
  });

  it("«parte no válida» enseña el motivo concreto que manda el back", () => {
    const withReason = Object.assign(new Error("Ya hay un precio de alumno activo"), { code: "BOOKING_PART_INVALID" });
    expect(accountsErrorText(withReason)).toBe("Ya hay un precio de alumno activo");
  });

  it("un código que no es del módulo conserva el mensaje del back", () => {
    expect(accountsErrorText(Object.assign(new Error("Error de conexión"), { code: "OTRO" }))).toBe("Error de conexión");
  });
});

describe("lo que queda a deber de una reserva con partes", () => {
  const base = { count: 4, paid: 3, pending: 0, debt: 1, invited: 0, debtCents: 550 };

  it("solo cuenta cuando no queda nada sin cobrar", () => {
    expect(partsOpenDebtCents(base)).toBe(550);
    expect(partsOpenDebtCents({ ...base, pending: 1, paid: 2 })).toBe(0);
    expect(partsOpenDebtCents({ ...base, debt: 0, debtCents: 0 })).toBe(0);
    expect(partsOpenDebtCents(null)).toBe(0);
  });

  it("«Cobrada · 5,50 € a deber»; sin ninguna cobrada, solo lo que se debe", () => {
    expect(partsDebtLabel(base)).toBe("Cobrada · 5,50 € a deber");
    expect(partsDebtLabel({ ...base, paid: 0, count: 1 })).toBe("5,50 € a deber");
  });
});

describe("plural de los días de un plazo", () => {
  it("1 día, 5 días", () => {
    expect(daysText(1)).toBe("1 día");
    expect(daysText(10)).toBe("10 días");
  });
});

describe("«Varios»", () => {
  it("se lee «Varios» y no ofrece ninguna acción entera: se deshace parte a parte", () => {
    expect(methodLabel("MIXED")).toBe("Varios");
    expect(paymentAction("MIXED")).toBeNull();
  });
});
