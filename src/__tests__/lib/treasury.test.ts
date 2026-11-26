import { describe, it, expect } from "vitest";
import {
  allowsNegativeCount, applyShortcut, beforeStartBalance, countablePlaces, countDay, countDiffText, daysInclusive,
  defaultSettleSide, defaultStatementRange, parsePlaceKey, parseSignedCents, partnerAccountText, pendingSentence,
  pendingSettlements, placeKey, settleAmountProblem, settleCountNote, settleStartCents, settleTransfer,
  signedCents, sourceLabel, statementRangeProblem, TREASURY_MAX_CENTS, transferProblem, withRunningBalance,
  writablePlaces,
} from "@/lib/utils/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { paidWithText, purchasePaymentOptions, purchasePaymentPayload } from "@/lib/utils/shop";

// El espacio que mete Intl entre la cifra y el símbolo es un espacio duro
const clean = (s: string) => s.replace(/ /g, " ");

describe("lugares", () => {
  it("la clave de un lugar de socio lleva el socio y se puede deshacer", () => {
    expect(placeKey({ place: "CASH", partnerId: null })).toBe("CASH");
    expect(placeKey({ place: "PARTNER_HELD", partnerId: "s1" })).toBe("PARTNER_HELD:s1");
    expect(parsePlaceKey("BANK")).toEqual({ place: "BANK" });
    expect(parsePlaceKey("PARTNER_ACCOUNT:s1")).toEqual({ place: "PARTNER_ACCOUNT", partnerId: "s1" });
  });

  it("solo el banco y la cuenta de un socio admiten un cuadre negativo", () => {
    expect(allowsNegativeCount("BANK")).toBe(true);
    expect(allowsNegativeCount("PARTNER_ACCOUNT")).toBe(true);
    expect(allowsNegativeCount("CASH")).toBe(false);
    expect(allowsNegativeCount("PARTNER_HELD")).toBe(false);
  });

  it("para apuntar no se ofrecen los lugares de un socio de baja", () => {
    const places = [
      { place: "CASH" as const, partnerId: null, label: "Caja" },
      { place: "PARTNER_HELD" as const, partnerId: "s1", label: "Guardado por Marta" },
      { place: "PARTNER_HELD" as const, partnerId: "s2", label: "Guardado por Antiguo" },
    ];
    expect(writablePlaces(places, new Set(["s1"])).map((p) => p.label)).toEqual(["Caja", "Guardado por Marta"]);
  });

  it("para cuadrar, un socio de baja solo se ofrece mientras tenga saldo", () => {
    const place = (p: "CASH" | "PARTNER_HELD" | "PARTNER_ACCOUNT", partnerId: string | null, label: string, balanceCents: number) =>
      ({ place: p, partnerId, label, balanceCents, lastCount: null });
    const places = [
      place("CASH", null, "Caja", 0),
      place("PARTNER_HELD", "s1", "Guardado por Marta", 0),
      place("PARTNER_HELD", "s2", "Guardado por Antiguo", 5000),
      place("PARTNER_ACCOUNT", "s2", "Cuenta de Antiguo con el club", -8000),
      place("PARTNER_ACCOUNT", "s3", "Cuenta de Otro con el club", 0),
    ];
    // s1 activo (aunque esté a cero), s2 y s3 de baja: solo se queda el que debe o guarda algo
    expect(countablePlaces(places, new Set(["s1"])).map((p) => p.label))
      .toEqual(["Caja", "Guardado por Marta", "Guardado por Antiguo", "Cuenta de Antiguo con el club"]);
  });
});

describe("saldar a un socio de baja", () => {
  it("lista una cosa pendiente por cada lugar con saldo, con su frase", () => {
    expect(pendingSettlements({ heldCents: 0, accountCents: 0 })).toEqual([]);
    const held = pendingSettlements({ heldCents: 20000, accountCents: 0 });
    expect(held.map((i) => [i.kind, i.place, i.cents])).toEqual([["held", "PARTNER_HELD", 20000]]);
    expect(clean(held[0].text)).toBe("Guarda 200,00 € del club");
    const has = pendingSettlements({ heldCents: 0, accountCents: 12000 });
    expect(has.map((i) => [i.kind, i.place, i.cents])).toEqual([["has", "PARTNER_ACCOUNT", 12000]]);
    expect(clean(has[0].text)).toBe("Tiene 120,00 € del club");
    // Lo que el club le debe se pide en positivo: es lo pendiente
    const owed = pendingSettlements({ heldCents: 0, accountCents: -8000 });
    expect(owed.map((i) => [i.kind, i.place, i.cents])).toEqual([["owed", "PARTNER_ACCOUNT", 8000]]);
    expect(clean(owed[0].text)).toBe("El club le debe 80,00 €");
    // Guardado y cuenta van por separado, de uno en uno
    expect(pendingSettlements({ heldCents: 500, accountCents: -300 }).map((i) => i.kind)).toEqual(["held", "owed"]);
    expect(pendingSettlements({ heldCents: 500, accountCents: 300 }).map((i) => i.kind)).toEqual(["held", "has"]);
  });

  it("el sentido del traspaso: el socio entrega al club, salvo que el club le deba", () => {
    const [held] = pendingSettlements({ heldCents: 20000, accountCents: 0 });
    const [has] = pendingSettlements({ heldCents: 0, accountCents: 12000 });
    const [owed] = pendingSettlements({ heldCents: 0, accountCents: -8000 });
    expect(settleTransfer(held, "s2", "CASH")).toEqual({
      from: { place: "PARTNER_HELD", partnerId: "s2" }, to: { place: "CASH" },
    });
    expect(settleTransfer(has, "s2", "BANK")).toEqual({
      from: { place: "PARTNER_ACCOUNT", partnerId: "s2" }, to: { place: "BANK" },
    });
    // El club paga: sale de la caja o del banco y entra en la cuenta del socio (que sube hacia 0)
    expect(settleTransfer(owed, "s2", "BANK")).toEqual({
      from: { place: "BANK" }, to: { place: "PARTNER_ACCOUNT", partnerId: "s2" },
    });
    expect(settleTransfer(owed, "s2", "CASH").from).toEqual({ place: "CASH" });
    // Y los dos lugares que salen son válidos para el back (con socio donde toca)
    for (const i of [held, has, owed]) {
      const { from, to } = settleTransfer(i, "s2", "CASH");
      expect(transferProblem(from, to)).toBeNull();
    }
  });

  it("el efectivo vuelve a la caja y lo que tiene en su cuenta, al banco", () => {
    expect(defaultSettleSide("held")).toBe("CASH");
    expect(defaultSettleSide("has")).toBe("BANK");
    expect(defaultSettleSide("owed")).toBe("BANK");
  });

  it("el importe va de 0,01 € a lo pendiente, sin pasar del tope de un traspaso", () => {
    expect(settleAmountProblem(8000, 8000)).toBeNull();
    expect(settleAmountProblem(1, 8000)).toBeNull();
    expect(settleAmountProblem(null, 8000)).toMatch(/importe válido/);
    expect(settleAmountProblem(0, 8000)).toMatch(/0,01/);
    expect(clean(settleAmountProblem(8001, 8000) ?? "")).toBe("No puede pasar de lo pendiente: 80,00 €");
    // Un saldo mayor que el tope se salda en varios traspasos
    expect(settleAmountProblem(TREASURY_MAX_CENTS, TREASURY_MAX_CENTS + 5000)).toBeNull();
    expect(settleAmountProblem(TREASURY_MAX_CENTS + 1, TREASURY_MAX_CENTS + 5000)).toMatch(/100\.000/);
    expect(settleStartCents(8000)).toBe(8000);
    expect(settleStartCents(TREASURY_MAX_CENTS + 5000)).toBe(TREASURY_MAX_CENTS);
  });

  it("dice lo pendiente en una frase para confirmar la baja", () => {
    const sentence = (held: number, account: number) => clean(pendingSentence("Marta", pendingSettlements({ heldCents: held, accountCents: account })));
    expect(sentence(20000, 0)).toBe("Marta guarda 200,00 € del club");
    expect(sentence(0, 12000)).toBe("Marta tiene 120,00 € del club");
    expect(sentence(0, -8000)).toBe("El club le debe 80,00 € a Marta");
    expect(sentence(20000, -8000)).toBe("Marta guarda 200,00 € del club y el club le debe 80,00 €");
  });

  it("avisa de entre qué valores se puede cuadrar el lugar de un socio de baja", () => {
    expect(clean(settleCountNote("Antiguo", 5000))).toBe(
      "Antiguo está de baja: este cuadre solo puede dejar el saldo entre 0,00 € y 50,00 €, para saldarlo.",
    );
    expect(clean(settleCountNote("Antiguo", -8000))).toBe(
      "Antiguo está de baja: este cuadre solo puede dejar el saldo entre −80,00 € y 0,00 € (en negativo, lo que el club le debe), para saldarlo.",
    );
  });
});

describe("frases", () => {
  it("la cuenta de un socio nunca enseña el signo: lo dice con palabras", () => {
    expect(clean(partnerAccountText(12000))).toBe("Tiene 120,00 € del club");
    expect(clean(partnerAccountText(-8000))).toBe("El club le debe 80,00 €");
    expect(partnerAccountText(0)).toBe("Está a cero con el club");
  });

  it("las cantidades con signo usan el menos de verdad", () => {
    expect(clean(signedCents(1250))).toBe("+12,50 €");
    expect(clean(signedCents(-300))).toBe("−3,00 €");
    expect(clean(signedCents(0))).toBe("0,00 €");
  });

  it("lee importes con signo y rechaza lo que no lo es", () => {
    expect(parseSignedCents("12,5")).toBe(1250);
    expect(parseSignedCents("-3")).toBe(-300);
    expect(parseSignedCents("−3,00")).toBe(-300);
    expect(parseSignedCents("0")).toBe(0);
    expect(parseSignedCents("")).toBeNull();
    expect(parseSignedCents("doce")).toBeNull();
    expect(parseSignedCents("1,234")).toBeNull();
  });
});

describe("atajos de «Mover dinero»", () => {
  it("cada atajo pone origen y destino", () => {
    expect(applyShortcut("cash_to_bank", "")).toEqual({ from: { place: "CASH" }, to: { place: "BANK" } });
    expect(applyShortcut("partner_keeps", "s1")).toEqual({ from: { place: "CASH" }, to: { place: "PARTNER_HELD", partnerId: "s1" } });
    expect(applyShortcut("partner_returns", "s1")).toEqual({ from: { place: "PARTNER_HELD", partnerId: "s1" }, to: { place: "CASH" } });
    // El socio pone dinero: su cuenta baja (el club le debe) y la caja sube
    expect(applyShortcut("partner_puts", "s1")).toEqual({ from: { place: "PARTNER_ACCOUNT", partnerId: "s1" }, to: { place: "CASH" } });
    // El socio se lleva dinero: su cuenta sube y la caja baja
    expect(applyShortcut("partner_takes", "s1")).toEqual({ from: { place: "CASH" }, to: { place: "PARTNER_ACCOUNT", partnerId: "s1" } });
    // El Bizum llegó a su móvil (su cuenta subió): al pasarlo al banco, baja
    expect(applyShortcut("bizum_to_bank", "s1")).toEqual({ from: { place: "PARTNER_ACCOUNT", partnerId: "s1" }, to: { place: "BANK" } });
    expect(applyShortcut("other", "s1")).toBeNull();
  });

  it("no deja guardar un traspaso sin socio donde hace falta ni del sitio a sí mismo", () => {
    expect(transferProblem({ place: "CASH" }, { place: "BANK" })).toBeNull();
    expect(transferProblem({ place: "CASH" }, { place: "PARTNER_HELD" })).toBe("Elige el socio");
    expect(transferProblem({ place: "CASH" }, { place: "CASH" })).toMatch(/mismo/);
    expect(transferProblem({ place: "PARTNER_HELD", partnerId: "s1" }, { place: "PARTNER_HELD", partnerId: "s1" })).toMatch(/mismo/);
    // Entre dos socios es otro sitio: vale
    expect(transferProblem({ place: "PARTNER_HELD", partnerId: "s1" }, { place: "PARTNER_HELD", partnerId: "s2" })).toBeNull();
  });
});

describe("cuadre", () => {
  it("«hoy» y «ayer» salen del día del club", () => {
    expect(countDay("today", "2026-11-25")).toBe("2026-11-25");
    expect(countDay("yesterday", "2026-11-25")).toBe("2026-11-24");
    expect(countDay("yesterday", "2026-12-01")).toBe("2026-11-30");
  });

  it("dice si coincide, si sobra o si falta", () => {
    expect(countDiffText(10000, 10000)).toMatchObject({ diffCents: 0, text: "Coincide: no hay diferencia." });
    expect(clean(countDiffText(10000, 10500).text)).toBe("Hay 5,00 € más de lo calculado.");
    expect(clean(countDiffText(10000, 9000).text)).toBe("Faltan 10,00 € respecto a lo calculado.");
    expect(countDiffText(10000, 9000).diffCents).toBe(-1000);
  });

  it("antes del inicio vale 0, salvo que ese día ya se cuadrara", () => {
    expect(beforeStartBalance(null, "2026-11-01")).toBe(0);
    expect(beforeStartBalance({ upTo: "2026-11-01", countedCents: 5000 }, "2026-11-01")).toBe(5000);
    expect(beforeStartBalance({ upTo: "2026-11-02", countedCents: 5000 }, "2026-11-01")).toBe(0);
  });
});

describe("extracto", () => {
  it("cuenta los días con los dos extremos", () => {
    expect(daysInclusive("2026-11-01", "2026-11-01")).toBe(1);
    expect(daysInclusive("2026-11-01", "2026-11-30")).toBe(30);
  });

  it("abre con 30 días sin pasar del inicio", () => {
    expect(defaultStatementRange("2026-11-25", "2026-01-01")).toEqual({ from: "2026-10-27", to: "2026-11-25" });
    expect(defaultStatementRange("2026-11-25", "2026-11-20")).toEqual({ from: "2026-11-20", to: "2026-11-25" });
  });

  it("rechaza rangos que el back rechazaría", () => {
    const check = (from: string, to: string) => statementRangeProblem(from, to, "2026-01-01", "2026-11-25");
    expect(check("2026-11-01", "2026-11-25")).toBeNull();
    expect(check("", "2026-11-25")).toMatch(/dos días/);
    expect(check("2026-11-25", "2026-11-01")).toMatch(/acaba antes/);
    expect(check("2025-12-31", "2026-11-25")).toMatch(/empieza el 01\/01\/2026/);
    expect(check("2026-11-01", "2026-11-26")).toMatch(/futuros/);
    // 93 días valen; 94, no
    expect(check("2026-08-25", "2026-11-25")).toBeNull();
    expect(check("2026-08-24", "2026-11-25")).toMatch(/93/);
  });

  it("el saldo corre sumando cada fila (el cuadre ya trae lo que corrige)", () => {
    const rows = withRunningBalance(1000, [
      { day: "2026-11-02", source: "SALE", refId: "a", concept: "Bolas", amountCents: 600 },
      { day: "2026-11-03", source: "COUNT", refId: "c", concept: "Cuadre", amountCents: -100 },
      { day: "2026-11-04", source: "LEDGER", refId: "l", concept: "Luz", amountCents: -500 },
    ]);
    expect(rows.map((r) => r.balanceCents)).toEqual([1600, 1500, 1000]);
  });

  it("nombra de dónde sale cada fila", () => {
    expect(sourceLabel("COUNT")).toBe("Cuadre");
    expect(sourceLabel("CARD_FEE")).toBe("Comisión");
  });
});

describe("errores de tesorería", () => {
  it("cada código conocido tiene su texto; los que traen el motivo del back, el del back", () => {
    expect(accountsErrorText({ code: "TREASURY_HELD_INSUFFICIENT", message: "x" })).toMatch(/no puede devolver más efectivo/);
    expect(accountsErrorText({ code: "TREASURY_RANGE_TOO_LONG", message: "x" })).toMatch(/93 días/);
    expect(accountsErrorText({ code: "TREASURY_NOT_STARTED", message: "x" })).toMatch(/fecha de inicio/);
    expect(accountsErrorText({ code: "TREASURY_INVALID", message: "Elige otro socio" })).toBe("Elige otro socio");
    expect(accountsErrorText({ code: "TREASURY_START_AFTER_RECORDS", message: "Hay traspasos desde el 2026-11-02" }))
      .toBe("Hay traspasos desde el 2026-11-02");
  });

  it("con un socio de baja llega el texto del back, que dice lo pendiente; sin él, uno genérico", () => {
    expect(accountsErrorText({ code: "TREASURY_PARTNER_INACTIVE", message: "Antiguo está de baja: solo se le puede saldar 80,00 €" }))
      .toBe("Antiguo está de baja: solo se le puede saldar 80,00 €");
    expect(accountsErrorText({ code: "TREASURY_PARTNER_INACTIVE", message: "" })).toMatch(/Ese socio está de baja/);
  });
});

describe("«Pagado con» de la tienda", () => {
  it("ofrece caja, banco, tarjeta y un bolsillo por socio, y lo manda como el back lo espera", () => {
    const options = purchasePaymentOptions([{ id: "s1", name: "Marta" }]);
    expect(options.map((o) => o.value)).toEqual(["CASH", "BANK", "CARD", "PARTNER:s1"]);
    expect(options[3].label).toBe("Bolsillo de Marta");
    expect(purchasePaymentPayload("BANK")).toEqual({ payment: "BANK" });
    expect(purchasePaymentPayload("PARTNER:s1")).toEqual({ payment: "PARTNER", partnerId: "s1" });
  });

  it("en el historial dice con qué se pagó; las compras anteriores, nada", () => {
    expect(paidWithText({ kind: "PURCHASE", payment: "CASH", partnerName: null })).toBe("Caja");
    expect(paidWithText({ kind: "PURCHASE", payment: "PARTNER", partnerName: "Marta" })).toBe("Marta (socio)");
    expect(paidWithText({ kind: "PURCHASE", payment: null, partnerName: null })).toBeNull();
    expect(paidWithText({ kind: "SALE", payment: null, partnerName: null })).toBeNull();
  });
});
