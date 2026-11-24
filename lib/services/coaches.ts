import { api } from "@/lib/api";
import type { LedgerEntry, LedgerPayment } from "@/lib/services/ledger";

/**
 * Entrenadores propios del club (F8-C2): horas dadas, devengado (horas × tarifa
 * de cada día), lo pagado y lo que se les debe. Todo es del área «accounts» y
 * responde 403 ACCOUNTS_DISABLED con el módulo apagado. Importes en céntimos;
 * los meses van como «AAAA-MM».
 */

export interface CoachMonth {
  coachStaffId:      string;
  /** La cuenta del entrenador (la pantalla de equipo lista por ella). */
  userId:            string;
  name:              string;
  groupMinutes:      number;
  privateMinutes:    number;
  extraMinutes:      number;
  accruedCents:      number;
  paidCents:         number;
  /** Devengado menos pagado del mes (negativo si se le pagó de más). */
  owedCents:         number;
  /** Lo que se le debe de los 24 meses anteriores. */
  previousOwedCents: number;
  /** Alguna clase sin tarifa ese día: cuesta 0 hasta que se ponga. */
  missingRate:       boolean;
  payDue:            boolean;
}

export interface CoachesOverview {
  month:   string;
  coaches: CoachMonth[];
  totals:  { accruedCents: number; paidCents: number; owedCents: number; previousOwedCents: number };
}

export interface CoachWorkItem {
  date:        string;
  kind:        "GROUP" | "PRIVATE" | "EXTRA";
  label:       string;
  minutes:     number;
  hourlyCents: number;
  cents:       number;
  missingRate: boolean;
}

export interface CoachDetail {
  items:    CoachWorkItem[];
  payments: LedgerEntry[];
}

export interface CoachRate {
  id:           string;
  coachStaffId: string | null;
  coachName:    string | null;
  validFrom:    string;
  hourlyCents:  number;
}

export interface CoachExtraHours {
  id:           string;
  coachStaffId: string;
  coachName:    string;
  date:         string;
  minutes:      number;
  note:         string | null;
}

export interface PayCoachPayload {
  month:       string;
  amountCents: number;
  payment:     Exclude<LedgerPayment, "PENDING">;
  partnerId?:  string | null;
  date?:       string;
  note?:       string | null;
}

export const coachesQK = {
  all:      (clubId: string) => ["coaches", clubId] as const,
  overview: (clubId: string, month: string) => ["coaches", clubId, "overview", month] as const,
  detail:   (clubId: string, coachId: string, month: string) => ["coaches", clubId, "detail", coachId, month] as const,
  rates:    (clubId: string) => ["coaches", clubId, "rates"] as const,
  extra:    (clubId: string, month: string) => ["coaches", clubId, "extra", month] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts/coaches`;

export const coachesService = {
  overview: (clubId: string, month: string) =>
    api.get<CoachesOverview>(base(clubId), { params: { month } }).then((r) => r.data),
  detail: (clubId: string, coachId: string, month: string) =>
    api.get<CoachDetail>(`${base(clubId)}/${coachId}`, { params: { month } }).then((r) => r.data),
  pay: (clubId: string, coachId: string, data: PayCoachPayload) =>
    api.post<LedgerEntry>(`${base(clubId)}/${coachId}/pay`, data).then((r) => r.data),

  rates: {
    list: (clubId: string) => api.get<CoachRate[]>(`${base(clubId)}/rates`).then((r) => r.data),
    /** Sin entrenador, la tarifa del club; con el mismo día, actualiza. */
    save: (clubId: string, data: { coachStaffId?: string | null; validFrom: string; hourlyCents: number }) =>
      api.post<CoachRate>(`${base(clubId)}/rates`, data).then((r) => r.data),
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/rates/${id}`).then(() => undefined),
  },

  extraHours: {
    list: (clubId: string, month: string) =>
      api.get<CoachExtraHours[]>(`${base(clubId)}/extra-hours`, { params: { month } }).then((r) => r.data),
    create: (clubId: string, data: { coachStaffId: string; date: string; minutes: number; note?: string | null }) =>
      api.post<CoachExtraHours>(`${base(clubId)}/extra-hours`, data).then((r) => r.data),
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/extra-hours/${id}`).then(() => undefined),
  },
};
