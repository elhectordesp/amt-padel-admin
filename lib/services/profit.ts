import { api } from "@/lib/api";

/**
 * Socios y reparto del beneficio (F8, fase 3, S2): lo que gana el club cada mes,
 * la parte de cada socio, lo ya repartido y lo que queda por repartir, con el
 * dinero disponible. Todo lo calcula el back. Cuelga de la tesorería: 403
 * TREASURY_DISABLED con el módulo apagado y, sin fecha de inicio, la lectura
 * dice `started: false`. Los importes van en céntimos; las partes, en puntos
 * básicos (10.000 = 100 %); los meses, «AAAA-MM», y los días, «AAAA-MM-DD».
 */

export interface ProfitPart {
  partnerId:      string;
  name:           string;
  /** Lo que le toca del mes (0 si el mes fue de pérdidas). */
  partCents:      number;
  sharedCents:    number;
  pendingCents:   number;
  /** Lo repartido por encima de su parte en ese mes (0 si nada). */
  overSharedCents: number;
  /** Solo en meses acabados con algo pendiente. */
  suggestedCents: number;
  /** Un socio de baja sigue en los meses en que tenía parte. */
  active:         boolean;
}

export interface ProfitMonth {
  period:      string;
  /** El mes ya acabó: solo esos se reparten. */
  ended:       boolean;
  resultCents: number;
  parts:       ProfitPart[];
}

export interface ProfitPartner {
  partnerId: string;
  name:      string;
  active:    boolean;
}

export interface ProfitAvailable {
  cashCents:            number;
  bankCents:            number;
  /** Efectivo del club que guardan los socios. */
  heldCents:            number;
  /** Suma de las cuentas de los socios con el club: lo que el club les debe resta. */
  partnerAccountsCents: number;
  coachesOwedCents:     number;
  unpaidExpensesCents:  number;
  fundCents:            number;
  reserveCents:         number;
  /** Puede ser negativo. */
  availableCents:       number;
}

export interface ProfitSummary {
  started:     true;
  year:        number;
  months:      ProfitMonth[];
  partners:    ProfitPartner[];
  available:   ProfitAvailable;
  /** Las partes de los socios activos suman 100 %. */
  sharesValid: boolean;
  warnings:    string[];
}

export type ProfitRead = { started: false } | ProfitSummary;

export interface ProfitShareRow {
  id:            string;
  period:        string;
  date:          string;
  partnerId:     string;
  partnerName:   string;
  amountCents:   number;
  fromPlace:     "CASH" | "BANK";
  note:          string | null;
  /** ISO */
  createdAt:     string;
  createdByName: string;
}

export interface ProfitShareInput {
  period:    string;
  date:      string;
  fromPlace: "CASH" | "BANK";
  lines:     { partnerId: string; amountCents: number }[];
  note?:     string;
}

export interface PartnerShareInput {
  partnerId: string;
  shareBps:  number;
}

/** Un juego de partes: vale desde su mes hasta que otro juego empieza. */
export interface PartnerShareSet {
  /** «AAAA-MM» */
  fromMonth: string;
  /** Con los socios que estaban en él, aunque hoy estén de baja. */
  shares:    (PartnerShareInput & { name: string; active: boolean })[];
}

export interface PartnerSharesRead {
  sets:        PartnerShareSet[];
  /** El último mes con repartos vivos: un juego nuevo solo puede empezar después. «AAAA-MM» */
  lockedUntil: string | null;
}

// Cuelgan de la clave de la tesorería: al escribir en ella, todo se vuelve a pedir
export const profitQK = {
  /** Las partes de Ajustes, con sus juegos. */
  partnerShares: (clubId: string) => ["club-treasury", clubId, "partner-shares"] as const,
  summary: (clubId: string, year: string) => ["club-treasury", clubId, "profit", year] as const,
  shares:  (clubId: string, year: string) => ["club-treasury", clubId, "profit-shares", year] as const,
  /** Para las partes de Ajustes: sin año, el del club. */
  current: (clubId: string) => ["club-treasury", clubId, "profit"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts`;

export const profitService = {
  /** Sin año, el del club. */
  summary: (clubId: string, year?: string) =>
    api.get<ProfitRead>(`${base(clubId)}/treasury/profit`, { params: year ? { year } : undefined }).then((r) => r.data),

  shares: {
    list: (clubId: string, year?: string) =>
      api.get<{ started: false } | { started: true; shares: ProfitShareRow[] }>(
        `${base(clubId)}/treasury/profit-shares`, { params: year ? { year } : undefined },
      ).then((r) => r.data),
    create: (clubId: string, data: ProfitShareInput) =>
      api.post<{ shares: ProfitShareRow[] }>(`${base(clubId)}/treasury/profit-shares`, data).then((r) => r.data),
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/treasury/profit-shares/${id}`).then(() => undefined),
  },

  partnerShares: {
    get: (clubId: string) =>
      api.get<PartnerSharesRead>(`${base(clubId)}/partners/shares`).then((r) => r.data),
    /**
     * Fija el juego de partes que vale desde `fromMonth`: todos los socios activos, sin repetir y sumando
     * 10.000 (422 PROFIT_SHARES_INVALID). Si ya había uno desde ese mes, lo sustituye; no puede ser de
     * un mes con repartos (409 PROFIT_SHARES_LOCKED).
     */
    set: (clubId: string, data: { fromMonth: string; shares: PartnerShareInput[] }) =>
      api.put(`${base(clubId)}/partners/shares`, data).then(() => undefined),
  },
};
