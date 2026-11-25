import { api } from "@/lib/api";
import type { QueryClient } from "@tanstack/react-query";
import { reportsQK } from "@/lib/services/club-reports";

/**
 * Tesorería del club (F8, fase 3): dónde está el dinero (caja, banco, lo que
 * guardan los socios y la cuenta de cada socio con el club), traspasos entre
 * esos sitios y cuadres contra lo que hay de verdad. Los saldos los calcula el
 * back; nada se guarda. Responde 403 TREASURY_DISABLED con el módulo apagado y,
 * sin fecha de inicio, las lecturas dicen `started: false`. Los importes van
 * en céntimos y los días son «AAAA-MM-DD» en la zona del club.
 */

export type MoneyPlace = "CASH" | "BANK" | "PARTNER_HELD" | "PARTNER_ACCOUNT";

export interface PlaceRef {
  place:     MoneyPlace;
  /** Solo en los lugares de un socio. */
  partnerId: string | null;
  label:     string;
}

export interface LastCount {
  id:           string;
  upTo:         string;
  countedCents: number;
  /** ISO */
  createdAt:    string;
}

export interface PlaceBalance extends PlaceRef {
  balanceCents: number;
  lastCount:    LastCount | null;
}

export interface PartnerTreasury {
  partnerId:    string;
  name:         string;
  active:       boolean;
  /** Efectivo del club que guarda el socio. */
  heldCents:    number;
  /** Más de 0: tiene dinero del club; menos de 0: el club le debe. */
  accountCents: number;
}

export interface TreasurySummary {
  started:    true;
  startDate:  string;
  today:      string;
  places:     PlaceBalance[];
  totalCents: number;
  partners:   PartnerTreasury[];
  /** Dinero cuyo lugar no se sabe: no suma en ningún sitio. */
  unplaced:   { count: number; cents: number };
  /** Saldo de los fondos (categorías «Es un fondo»): no se reparte y se resta del disponible. */
  fundCents:  number;
}

export type TreasuryRead<T> = { started: false } | ({ started: true } & T);

export type StatementSource =
  | "BOOKING" | "BOOKING_PART" | "REGISTRATION" | "VOUCHER" | "SCHOOL_FEE" | "PRIVATE_CLASS" | "CLUB_DEBT" | "SALE"
  | "LEDGER" | "PURCHASE" | "CARD_FEE" | "CLOSURE" | "TRANSFER" | "PROFIT_SHARE" | "COUNT";

export interface StatementRow {
  day:         string;
  source:      StatementSource;
  refId:       string;
  concept:     string;
  /** Con signo: lo que suma o resta a ese lugar. */
  amountCents: number;
}

export interface Statement {
  openingCents: number;
  rows:         StatementRow[];
  closingCents: number;
}

export interface Transfer {
  id:            string;
  date:          string;
  amountCents:   number;
  from:          PlaceRef;
  to:            PlaceRef;
  note:          string | null;
  /** ISO */
  createdAt:     string;
  createdByName: string;
}

export interface Count {
  id:            string;
  place:         MoneyPlace;
  partnerId:     string | null;
  label:         string;
  upTo:          string;
  countedCents:  number;
  note:          string | null;
  /** ISO */
  createdAt:     string;
  createdByName: string;
}

/** Un cuadre recién hecho: con lo que el back tenía calculado y la diferencia. */
export interface CountResult extends Count {
  computedCents: number;
  diffCents:     number;
}

export interface PlaceInput {
  place:      MoneyPlace;
  partnerId?: string;
}

export interface TransferInput {
  date:        string;
  amountCents: number;
  from:        PlaceInput;
  to:          PlaceInput;
  note?:       string;
}

export interface CountInput extends PlaceInput {
  upTo:         string;
  countedCents: number;
  note?:        string;
}

export interface StatementQuery extends PlaceInput {
  from?: string;
  to?:   string;
}

export const treasuryQK = {
  all:        (clubId: string) => ["club-treasury", clubId] as const,
  summary:    (clubId: string) => ["club-treasury", clubId, "summary"] as const,
  statement:  (clubId: string, q: StatementQuery) => ["club-treasury", clubId, "statement", q] as const,
  transfers:  (clubId: string) => ["club-treasury", clubId, "transfers"] as const,
  counts:     (clubId: string) => ["club-treasury", clubId, "counts"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts/treasury`;

export const treasuryService = {
  summary: (clubId: string) =>
    api.get<{ started: false } | TreasurySummary>(base(clubId)).then((r) => r.data),

  /** El extracto de un lugar; 93 días como mucho (422 TREASURY_RANGE_TOO_LONG). */
  statement: (clubId: string, query: StatementQuery) =>
    api.get<TreasuryRead<Statement>>(`${base(clubId)}/movements`, { params: query }).then((r) => r.data),

  transfers: {
    list:   (clubId: string) =>
      api.get<TreasuryRead<{ transfers: Transfer[] }>>(`${base(clubId)}/transfers`).then((r) => r.data),
    create: (clubId: string, data: TransferInput) =>
      api.post<Transfer>(`${base(clubId)}/transfers`, data).then((r) => r.data),
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/transfers/${id}`).then(() => undefined),
  },

  counts: {
    list:   (clubId: string) =>
      api.get<TreasuryRead<{ counts: Count[] }>>(`${base(clubId)}/counts`).then((r) => r.data),
    create: (clubId: string, data: CountInput) =>
      api.post<CountResult>(`${base(clubId)}/counts`, data).then((r) => r.data),
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/counts/${id}`).then(() => undefined),
  },
};

/** Tras escribir en la tesorería, lo suyo y los avisos de «Requiere atención» se vuelven a pedir. */
export function invalidateTreasury(qc: QueryClient, clubId: string) {
  void qc.invalidateQueries({ queryKey: treasuryQK.all(clubId) });
  void qc.invalidateQueries({ queryKey: reportsQK.all(clubId) });
}
