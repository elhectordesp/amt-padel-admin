import { api } from "@/lib/api";
import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";

/**
 * Tienda del club (módulo Cuentas, M4): productos (bolas, grips...), su stock y
 * las ventas, que se cobran en el momento, se dejan a deber o quedan pendientes
 * en una reserva. Todo responde 403 ACCOUNTS_DISABLED con el módulo apagado.
 * Los importes van en céntimos.
 */

export interface ShopProduct {
  id:           string;
  name:         string;
  priceCents:   number;
  costCents:    number | null;
  unitsPerBox:  number | null;
  /** Aviso de stock bajo por debajo de esto; sin él, por debajo de una caja. */
  minStock:     number | null;
  active:       boolean;
  displayOrder: number;
  /** Compras y recuentos menos lo vendido sin anular; puede ser negativo. */
  stock:        number;
  lowStock:     boolean;
}

export interface ProductPayload {
  name:         string;
  priceCents:   number;
  costCents?:   number | null;
  unitsPerBox?: number | null;
  minStock?:    number | null;
  active?:      boolean;
}

export type StockMovePayload =
  | { kind: "PURCHASE"; boxes?: number; units?: number; costCents?: number; notes?: string }
  | { kind: "ADJUSTMENT"; countedUnits: number; notes: string };

export interface ProductMove {
  kind:        "PURCHASE" | "ADJUSTMENT" | "SALE";
  id:          string;
  /** ISO */
  at:          string;
  /** Entra (+) o sale (−); una venta, en negativo. */
  units:       number;
  boxes:       number | null;
  costCents:   number | null;
  /** Solo ventas. */
  amountCents: number | null;
  notes:       string | null;
  byName:      string;
  /** Venta anulada: ya no cuenta en el stock. */
  cancelled:   boolean;
}

export interface ProductMovesPage {
  items:    ProductMove[];
  total:    number;
  page:     number;
  pageSize: number;
}

export type SaleStatus = "PENDING" | "PAID" | "DEBT";

export interface ShopSale {
  id:                string;
  productName:       string;
  quantity:          number;
  unitPriceCents:    number;
  amountCents:       number;
  bookingId:         string | null;
  personName:        string | null;
  status:            SaleStatus;
  paymentMethod:     string | null;
  bizumPartnerName:  string | null;
  paidAt:            string | null;
  debtId:            string | null;
  cancelledAt:       string | null;
  refundAmountCents: number | null;
  soldByName:        string;
  createdAt:         string;
}

/** Una de tres formas de cobrar. */
export type SalePayment =
  | { method: CounterPaymentMethod; bizumPartnerId?: string | null }
  | { debt: true }
  | { pending: true };

export interface SellPayload {
  productId:       string;
  quantity:        number;
  bookingId?:      string;
  clubCustomerId?: string;
  label?:          string;
  payment:         SalePayment;
}

export interface SellResult {
  sale:       ShopSale;
  /** El stock que queda tras la venta: negativo si se vendió sin tenerlo. */
  stockAfter: number;
}

export const shopQK = {
  all:      (clubId: string) => ["club-shop", clubId] as const,
  products: (clubId: string) => ["club-shop", clubId, "products"] as const,
  moves:    (clubId: string, productId: string, page: number) => ["club-shop", clubId, "moves", productId, page] as const,
  sales:    (clubId: string, scope: string) => ["club-shop", clubId, "sales", scope] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts`;

export const shopService = {
  products: {
    list:   (clubId: string) =>
      api.get<ShopProduct[]>(`${base(clubId)}/products`).then((r) => r.data),
    create: (clubId: string, data: ProductPayload) =>
      api.post<ShopProduct>(`${base(clubId)}/products`, data).then((r) => r.data),
    /** Reemplaza el producto: lo opcional que no se manda se vacía. */
    update: (clubId: string, id: string, data: ProductPayload) =>
      api.put<ShopProduct>(`${base(clubId)}/products/${id}`, data).then((r) => r.data),
    /** 204; con 409 ACCOUNTS_IN_USE ya tiene ventas o movimientos y solo se puede desactivar. */
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/products/${id}`).then(() => undefined),
    addStock: (clubId: string, id: string, data: StockMovePayload) =>
      api.post<ShopProduct>(`${base(clubId)}/products/${id}/stock`, data).then((r) => r.data),
    moves: (clubId: string, id: string, page = 1) =>
      api.get<ProductMovesPage>(`${base(clubId)}/products/${id}/moves`, { params: { page } }).then((r) => r.data),
  },

  sales: {
    /** Las creadas en un día del club o las de una reserva. */
    list: (clubId: string, scope: { date: string } | { bookingId: string }) =>
      api.get<ShopSale[]>(`${base(clubId)}/sales`, { params: scope }).then((r) => r.data),
    sell: (clubId: string, data: SellPayload) =>
      api.post<SellResult>(`${base(clubId)}/sales`, data).then((r) => r.data),
    /** Solo una venta pendiente. */
    pay: (clubId: string, id: string, data: { method: CounterPaymentMethod; bizumPartnerId?: string | null }) =>
      api.post<ShopSale>(`${base(clubId)}/sales/${id}/pay`, data).then((r) => r.data),
    /** Pendiente: sin más; cobrada: con devolución entera; a deber: solo con la deuda abierta. */
    cancel: (clubId: string, id: string) =>
      api.post<ShopSale>(`${base(clubId)}/sales/${id}/cancel`).then((r) => r.data),
  },
};
