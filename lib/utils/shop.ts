/**
 * Lógica pura de la tienda del club (módulo Cuentas, M4): el aviso de stock
 * al vender, lo que se enseña de una venta, las unidades de una compra y los
 * mensajes de error.
 */
import type { ProductMove, ShopProduct, ShopSale } from "@/lib/services/shop";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { formatCents } from "@/lib/utils/booking-price";
import { methodLabel } from "@/lib/utils/payment-methods";
import { isBeforeToday } from "@/lib/utils/time-zone";

/** Lo mínimo y lo máximo del motivo de anular una venta cobrada (como en el back). */
export const SALE_REASON_MIN = 3;
export const SALE_REASON_MAX = 200;

/** Lo máximo que admite el back en una venta. */
export const SALE_MAX_QUANTITY = 99;

/** Por debajo de cuánto avisa el stock bajo de un producto (sin mínimo, una caja; sin caja, 0). */
export function lowStockThreshold(p: Pick<ShopProduct, "minStock" | "unitsPerBox">): number {
  return p.minStock ?? p.unitsPerBox ?? 0;
}

export type StockWarning = { level: "out" | "low"; text: string };

/** El aviso al vender `quantity` de un producto: sin stock (se vende igual) o stock bajo. */
export function saleStockWarning(p: ShopProduct, quantity: number): StockWarning | null {
  const after = p.stock - quantity;
  if (after < 0)
    return {
      level: "out",
      text: p.stock <= 0
        ? "Sin stock según el recuento. Se puede vender igual; revisa el stock después."
        : `Solo quedan ${p.stock}. Se puede vender igual; revisa el stock después.`,
    };
  if (after < lowStockThreshold(p)) return { level: "low", text: `Stock bajo: quedarán ${after}.` };
  return null;
}

/** El aviso tras vender, con lo que dice el back que queda. */
export function stockAfterWarning(productName: string, stockAfter: number, threshold: number): string | null {
  if (stockAfter < 0) return `${productName}: sin stock (${stockAfter}). Revisa el recuento.`;
  if (stockAfter < threshold) return `${productName}: stock bajo, quedan ${stockAfter}.`;
  return null;
}

/** Cómo se enseña el estado de una venta. */
export function saleStatusInfo(s: Pick<ShopSale, "status" | "cancelledAt" | "paymentMethod" | "bizumPartnerName" | "debtStatus">): {
  label: string;
  tone: "paid" | "debt" | "pending" | "cancelled";
} {
  if (s.cancelledAt) return { label: "Anulada", tone: "cancelled" };
  if (s.status === "DEBT") {
    // La venta sigue «a deber», pero su deuda puede haberse cobrado, perdonado o perdido
    if (s.debtStatus === "PAID") return { label: "Deuda cobrada", tone: "paid" };
    if (s.debtStatus === "FORGIVEN") return { label: "Deuda perdonada", tone: "cancelled" };
    if (s.debtStatus === "LOST") return { label: "Deuda perdida", tone: "cancelled" };
    return { label: "A deber", tone: "debt" };
  }
  if (s.status === "PENDING") return { label: "Pendiente de cobro", tone: "pending" };
  const method = methodLabel(s.paymentMethod);
  return {
    label: s.paymentMethod === "BIZUM" && s.bizumPartnerName ? `Cobrada · ${method} · ${s.bizumPartnerName}` : `Cobrada · ${method}`,
    tone: "paid",
  };
}

/** «2 × Bolas · 12,00 €» */
export function saleTitle(s: Pick<ShopSale, "quantity" | "productName" | "amountCents">): string {
  return `${s.quantity} × ${s.productName} · ${formatCents(s.amountCents)}`;
}

/**
 * Qué se puede hacer con una venta: cobrar si está pendiente y anular si no
 * está anulada. Una a deber solo se anula con su deuda abierta: cobrada,
 * perdonada o perdida, antes hay que deshacer eso en Deudas.
 */
export function saleActions(s: Pick<ShopSale, "status" | "cancelledAt" | "debtStatus">): { pay: boolean; cancel: boolean } {
  if (s.cancelledAt) return { pay: false, cancel: false };
  const debtOpen = s.status !== "DEBT" || s.debtStatus === null || s.debtStatus === "OPEN";
  return { pay: s.status === "PENDING", cancel: debtOpen };
}

/** Anular una venta cobrada necesita un motivo. */
export function saleNeedsReason(s: Pick<ShopSale, "status">): boolean {
  return s.status === "PAID";
}

/**
 * Anular una venta cobrada en un día anterior al de hoy (en la zona del club)
 * es del área «accounts»; la de hoy, de la caja.
 */
export function cancelNeedsAccounts(
  s: Pick<ShopSale, "status" | "paidAt">,
  timeZone: string | null,
  now: Date = new Date(),
): boolean {
  return s.status === "PAID" && s.paidAt !== null && isBeforeToday(s.paidAt, timeZone, now);
}

/** Lo que avisa el diálogo antes de anular, según el estado de la venta. */
export function cancelSaleText(s: Pick<ShopSale, "status" | "amountCents">): string {
  if (s.status === "PAID") return `Se devolverán ${formatCents(s.amountCents)} y salen de la caja de hoy.`;
  if (s.status === "DEBT") return "Se borra su deuda, solo si sigue sin cobrar.";
  return "No se había cobrado: no hay nada que devolver.";
}

/** Las unidades que entran con una compra: cajas × unidades por caja, o las sueltas. */
export function purchaseUnits(mode: "boxes" | "units", amount: number, unitsPerBox: number | null): number | null {
  if (!Number.isInteger(amount) || amount < 1) return null;
  if (mode === "units") return amount;
  return unitsPerBox === null ? null : amount * unitsPerBox;
}

/** La diferencia que guardaría un recuento: contado menos el stock de ahora. */
export function countDifference(counted: number, stock: number): number {
  return counted - stock;
}

/** «+48», «−3» (con el menos de verdad) para un movimiento de stock. */
export function signedUnits(units: number): string {
  return units > 0 ? `+${units}` : units < 0 ? `−${Math.abs(units)}` : "0";
}

/** Cómo se llama un movimiento del historial de un producto. */
export function moveLabel(m: Pick<ProductMove, "kind" | "boxes" | "cancelled">): string {
  if (m.kind === "SALE") return m.cancelled ? "Venta anulada" : "Venta";
  if (m.kind === "ADJUSTMENT") return "Recuento";
  return m.boxes ? `Compra de ${m.boxes} ${m.boxes === 1 ? "caja" : "cajas"}` : "Compra";
}

/** Un número entero positivo escrito en un campo; null si no lo es (vacío incluido). */
export function parseCount(text: string): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isSafeInteger(n) ? n : null;
}

/** El mensaje de un error de la tienda: los del back ya vienen en llano; los de Cuentas, con el suyo. */
export function shopErrorText(err: unknown): string {
  const code = (err as { code?: unknown }).code;
  if (code === "ACCOUNTS_IN_USE")
    return "El producto ya tiene ventas o movimientos de stock, así que no se puede borrar. Desactívalo y dejará de ofrecerse.";
  return accountsErrorText(err);
}
