import { api } from "@/lib/api";

/**
 * Cierre de caja del día (F8 M3): el club cuenta el efectivo y mira el total del
 * datáfono, y la caja dice si cuadra. Los importes van en céntimos y el día
 * («AAAA-MM-DD») en la zona del club. Solo con el módulo «Cuentas» encendido.
 */

export interface CashClosure {
  id:                string;
  date:              string;
  /** Lo esperado por método al cerrar (sin los métodos a 0). */
  expectedByMethod:  Record<string, number>;
  expectedCashCents: number;
  countedCashCents:  number;
  /** Contado − esperado: negativo, faltan; positivo, sobran. */
  cashDiffCents:     number;
  expectedCardCents: number;
  cardTerminalCents: number | null;
  /** Datáfono − esperado en tarjeta; null si no se tecleó el total. */
  cardDiffCents:     number | null;
  notes:             string | null;
  closedByName:      string;
  closedAt:          string;
}

export interface ClosureChange {
  method:      string;
  closedCents: number;
  nowCents:    number;
}

export interface CashClosureState {
  date:    string;
  closure: CashClosure | null;
  /** Lo esperado ahora, con lo cobrado hasta este momento. */
  current: {
    expectedByMethod:  Record<string, number>;
    expectedCashCents: number;
    expectedCardCents: number;
  };
  /** Lo cobrado ha cambiado después del cierre. */
  changedSinceClose: boolean;
  changes:           ClosureChange[];
}

export interface UnclosedDay {
  date:       string;
  totalCents: number;
  /** true: el día está cerrado, pero ha cambiado después del cierre. */
  changedSinceClose: boolean;
}

export interface CloseCashInput {
  date:               string;
  countedCashCents:   number;
  cardTerminalCents?: number | null;
  notes?:             string;
}

export const closureQK = {
  all:      (clubId: string) => ["cash-closure", clubId] as const,
  day:      (clubId: string, date: string) => ["cash-closure", clubId, "day", date] as const,
  unclosed: (clubId: string, days: number) => ["cash-closure", clubId, "unclosed", days] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/cash`;

export const cashClosureService = {
  get: (clubId: string, date: string) =>
    api.get<CashClosureState>(`${base(clubId)}/closure`, { params: { date } }).then((r) => r.data),
  close: (clubId: string, input: CloseCashInput) =>
    api.post<CashClosure>(`${base(clubId)}/closure`, input).then((r) => r.data),
  /** Reabre el día (solo propietario y gestor). */
  reopen: (clubId: string, date: string) =>
    api.delete<{ reopened: true; date: string }>(`${base(clubId)}/closure`, { params: { date } }).then((r) => r.data),
  unclosed: (clubId: string, days: number) =>
    api.get<UnclosedDay[]>(`${base(clubId)}/unclosed`, { params: { days } }).then((r) => r.data),
};
