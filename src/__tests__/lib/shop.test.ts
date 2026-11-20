/**
 * Lógica pura de la tienda del club (módulo Cuentas, M4): aviso de stock al
 * vender, estado de una venta, unidades de una compra y mensajes de error.
 */
import { describe, it, expect } from "vitest";
import type { ShopProduct, ShopSale } from "@/lib/services/shop";
import {
  cancelNeedsAccounts, cancelSaleText, countDifference, lowStockThreshold, moveLabel, parseCount, purchaseUnits,
  saleActions, saleStatusInfo, saleStockWarning, shopErrorText, signedUnits, stockAfterWarning,
} from "@/lib/utils/shop";

const product = (patch: Partial<ShopProduct> = {}): ShopProduct => ({
  id: "p1", name: "Bolas", priceCents: 600, costCents: 375, unitsPerBox: 24, minStock: null,
  active: true, displayOrder: 0, stock: 30, lowStock: false, ...patch,
});

const sale = (patch: Partial<ShopSale> = {}): ShopSale => ({
  id: "s1", productName: "Bolas", quantity: 2, unitPriceCents: 600, amountCents: 1200, bookingId: null,
  personName: null, status: "PAID", paymentMethod: "CASH", bizumPartnerName: null, paidAt: "2026-11-20T10:00:00.000Z",
  debtId: null, debtStatus: null, cancelledAt: null, refundAmountCents: null, soldByName: "Recepción", createdAt: "2026-11-20T10:00:00.000Z",
  ...patch,
});

describe("stock al vender", () => {
  it("el umbral es el mínimo; sin él, una caja; sin caja, 0", () => {
    expect(lowStockThreshold({ minStock: 10, unitsPerBox: 24 })).toBe(10);
    expect(lowStockThreshold({ minStock: null, unitsPerBox: 24 })).toBe(24);
    expect(lowStockThreshold({ minStock: null, unitsPerBox: null })).toBe(0);
  });

  it("sin stock o pasándose: avisa «out» pero deja vender", () => {
    expect(saleStockWarning(product({ stock: 0 }), 1)).toMatchObject({ level: "out" });
    expect(saleStockWarning(product({ stock: 2 }), 3)).toMatchObject({ level: "out", text: expect.stringContaining("Solo quedan 2") });
  });

  it("dejando menos de una caja: stock bajo con lo que quedará", () => {
    expect(saleStockWarning(product({ stock: 30 }), 10)).toEqual({ level: "low", text: "Stock bajo: quedarán 20." });
  });

  it("con stock de sobra no avisa", () => {
    expect(saleStockWarning(product({ stock: 48 }), 2)).toBeNull();
  });

  it("tras vender, avisa según lo que dice el back", () => {
    expect(stockAfterWarning("Bolas", -2, 24)).toBe("Bolas: sin stock (-2). Revisa el recuento.");
    expect(stockAfterWarning("Bolas", 10, 24)).toBe("Bolas: stock bajo, quedan 10.");
    expect(stockAfterWarning("Bolas", 30, 24)).toBeNull();
  });
});

describe("estado de una venta", () => {
  it("cobrada con su método y, en un Bizum, el receptor", () => {
    expect(saleStatusInfo(sale())).toEqual({ label: "Cobrada · Efectivo", tone: "paid" });
    expect(saleStatusInfo(sale({ paymentMethod: "BIZUM", bizumPartnerName: "Marta" })).label).toBe("Cobrada · Bizum · Marta");
  });

  it("a deber, pendiente y anulada (la anulación manda)", () => {
    expect(saleStatusInfo(sale({ status: "DEBT", paymentMethod: null }))).toEqual({ label: "A deber", tone: "debt" });
    expect(saleStatusInfo(sale({ status: "PENDING", paymentMethod: null })).tone).toBe("pending");
    expect(saleStatusInfo(sale({ cancelledAt: "2026-11-20T11:00:00.000Z" })).tone).toBe("cancelled");
  });

  it("una venta a deber enseña cómo va su deuda: cobrada, perdonada o perdida", () => {
    const debt = (debtStatus: ShopSale["debtStatus"]) => sale({ status: "DEBT", paymentMethod: null, debtStatus });
    expect(saleStatusInfo(debt("OPEN")).label).toBe("A deber");
    expect(saleStatusInfo(debt("PAID"))).toEqual({ label: "Deuda cobrada", tone: "paid" });
    expect(saleStatusInfo(debt("FORGIVEN")).label).toBe("Deuda perdonada");
    expect(saleStatusInfo(debt("LOST")).label).toBe("Deuda perdida");
  });

  it("una venta a deber no se anula si su deuda no está abierta", () => {
    const debt = (debtStatus: ShopSale["debtStatus"]) => sale({ status: "DEBT", debtStatus });
    expect(saleActions(debt("OPEN")).cancel).toBe(true);
    for (const closed of ["PAID", "FORGIVEN", "LOST"] as const)
      expect(saleActions(debt(closed)).cancel).toBe(false);
  });

  it("anular una cobrada de otro día necesita el área accounts; la de hoy, no", () => {
    const now = new Date("2026-11-20T18:00:00.000Z");
    expect(cancelNeedsAccounts(sale({ paidAt: "2026-11-20T10:00:00.000Z" }), "Europe/Madrid", now)).toBe(false);
    expect(cancelNeedsAccounts(sale({ paidAt: "2026-11-19T10:00:00.000Z" }), "Europe/Madrid", now)).toBe(true);
    // 23:30 UTC del 19 ya es el 20 en Madrid: es de hoy
    expect(cancelNeedsAccounts(sale({ paidAt: "2026-11-19T23:30:00.000Z" }), "Europe/Madrid", now)).toBe(false);
    // Una pendiente no tiene cobro que devolver
    expect(cancelNeedsAccounts(sale({ status: "PENDING", paidAt: null }), "Europe/Madrid", now)).toBe(false);
    // Sin saber la zona, lo estricto
    expect(cancelNeedsAccounts(sale({ paidAt: "2026-11-20T10:00:00.000Z" }), null, now)).toBe(true);
  });

  it("acciones: cobrar solo si está pendiente; anular mientras no esté anulada", () => {
    expect(saleActions(sale({ status: "PENDING" }))).toEqual({ pay: true, cancel: true });
    expect(saleActions(sale({ status: "PAID" }))).toEqual({ pay: false, cancel: true });
    expect(saleActions(sale({ status: "DEBT" }))).toEqual({ pay: false, cancel: true });
    expect(saleActions(sale({ cancelledAt: "2026-11-20T11:00:00.000Z" }))).toEqual({ pay: false, cancel: false });
  });

  it("el aviso de anular dice qué pasa con el dinero", () => {
    expect(cancelSaleText(sale())).toContain("Se devolverán 12,00");
    expect(cancelSaleText(sale({ status: "DEBT" }))).toContain("deuda");
    expect(cancelSaleText(sale({ status: "PENDING" }))).toContain("nada que devolver");
  });
});

describe("compras y recuentos", () => {
  it("cajas × unidades por caja; unidades sueltas; sin caja definida, no hay cajas", () => {
    expect(purchaseUnits("boxes", 2, 24)).toBe(48);
    expect(purchaseUnits("units", 10, 24)).toBe(10);
    expect(purchaseUnits("boxes", 2, null)).toBeNull();
    expect(purchaseUnits("units", 0, null)).toBeNull();
  });

  it("la diferencia de un recuento y su signo", () => {
    expect(countDifference(15, 18)).toBe(-3);
    expect(signedUnits(-3)).toBe("−3");
    expect(signedUnits(48)).toBe("+48");
    expect(signedUnits(0)).toBe("0");
  });

  it("un campo de unidades solo admite enteros", () => {
    expect(parseCount(" 12 ")).toBe(12);
    expect(parseCount("")).toBeNull();
    expect(parseCount("1,5")).toBeNull();
    expect(parseCount("-3")).toBeNull();
  });

  it("nombre de cada movimiento", () => {
    expect(moveLabel({ kind: "PURCHASE", boxes: 2, cancelled: false })).toBe("Compra de 2 cajas");
    expect(moveLabel({ kind: "PURCHASE", boxes: 1, cancelled: false })).toBe("Compra de 1 caja");
    expect(moveLabel({ kind: "PURCHASE", boxes: null, cancelled: false })).toBe("Compra");
    expect(moveLabel({ kind: "ADJUSTMENT", boxes: null, cancelled: false })).toBe("Recuento");
    expect(moveLabel({ kind: "SALE", boxes: null, cancelled: true })).toBe("Venta anulada");
  });
});

describe("mensajes de error", () => {
  it("un producto usado se explica; el resto, con el mensaje del back", () => {
    expect(shopErrorText({ code: "ACCOUNTS_IN_USE", message: "x" })).toContain("Desactívalo");
    expect(shopErrorText({ code: "ACCOUNTS_SALE_LOCKED", message: "La venta ya está anulada" })).toBe("La venta ya está anulada");
    expect(shopErrorText({ code: "ACCOUNTS_DISABLED", message: "x" })).toContain("Cuentas no está activado");
  });
});
