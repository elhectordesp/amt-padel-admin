import { api } from "@/lib/api";

/**
 * Gastos e ingresos del club (F8-C1) y cuentas abiertas (F8-C2): lo que NO nace
 * en el panel (alquiler, luz, patrocinios...). Todo responde 403
 * ACCOUNTS_DISABLED con el módulo Cuentas apagado y es del área «accounts»
 * (propietario y gestor). Los importes van en céntimos y los días («AAAA-MM-DD»)
 * son del calendario del club.
 */

export type LedgerKind = "INCOME" | "EXPENSE";
export const LEDGER_ACTIVITIES = ["COURTS", "ACADEMY", "TEAMS", "TOURNAMENTS", "SHOP", "OTHER"] as const;
export type LedgerActivity = (typeof LEDGER_ACTIVITIES)[number];
export type LedgerPayment = "CASH" | "BANK" | "CARD" | "PARTNER" | "PENDING" | "UNKNOWN";

export interface LedgerCategory {
  id:           string;
  name:         string;
  kind:         LedgerKind;
  activity:     LedgerActivity;
  vatPercent:   number | null;
  /** Las del juego por defecto lo llevan: no se borran, se desactivan. */
  systemKey:    string | null;
  active:       boolean;
  displayOrder: number;
  /** Se ha usado en algún apunte o fijo (aunque estén borrados). */
  inUse:        boolean;
}

export interface LedgerAttachment {
  id:       string;
  fileName: string;
  mimeType: string;
  bytes:    number;
}

export interface LedgerEntry {
  id:            string;
  kind:          LedgerKind;
  categoryId:    string;
  categoryName:  string;
  activity:      LedgerActivity;
  date:          string;
  imputedMonth:  string | null;
  amountCents:   number;
  payment:       LedgerPayment;
  partnerId:     string | null;
  partnerName:   string | null;
  paidOn:        string | null;
  concept:       string;
  note:          string | null;
  noReceipt:     boolean;
  recurringId:   string | null;
  coachStaffId:  string | null;
  coachName:     string | null;
  attachments:   LedgerAttachment[];
  needsReceipt:  boolean;
  /** Pasó su plazo de conservación (6 años): sus justificantes se retiraron. */
  receiptsRetired: boolean;
  createdByName: string | null;
  createdAt:     string;
}

export interface LedgerTotals {
  incomeCents:  number;
  expenseCents: number;
  /** Lo que suman los gastos sin pagar (ya incluidos en expenseCents). */
  pendingCents: number;
}

export interface LedgerEntriesPage {
  items:    LedgerEntry[];
  total:    number;
  page:     number;
  pageSize: number;
  totals:   LedgerTotals;
}

export interface LedgerEntriesFilter {
  from?:           string;
  to?:             string;
  kind?:           LedgerKind;
  categoryId?:     string;
  missingReceipt?: boolean;
  page?:           number;
}

export interface LedgerEntryPayload {
  categoryId:    string;
  date:          string;
  imputedMonth?: string | null;
  amountCents:   number;
  payment:       LedgerPayment;
  partnerId?:    string | null;
  concept:       string;
  note?:         string | null;
  noReceipt?:    boolean;
}

export interface LedgerRecurring {
  id:           string;
  categoryId:   string;
  categoryName: string;
  concept:      string;
  amountCents:  number;
  dayOfMonth:   number;
  payment:      LedgerPayment;
  partnerId:    string | null;
  partnerName:  string | null;
  startMonth:   string;
  active:       boolean;
  /** El último mes apuntado («AAAA-MM»). */
  lastMonth:    string | null;
}

export interface LedgerRecurringPayload {
  categoryId:  string;
  concept:     string;
  amountCents: number;
  dayOfMonth:  number;
  payment:     LedgerPayment;
  partnerId?:  string | null;
  startMonth?: string;
  active?:     boolean;
}

export interface CategoryPayload {
  name:        string;
  kind:        LedgerKind;
  activity:    LedgerActivity;
  vatPercent?: number | null;
}

export interface OpenAccount {
  clubCustomerId: string;
  name:           string;
  openCents:      number;
  openDebts:      number;
  lastPaidAt:     string | null;
}

export const ledgerQK = {
  all:        (clubId: string) => ["ledger", clubId] as const,
  categories: (clubId: string) => ["ledger", clubId, "categories"] as const,
  entries:    (clubId: string, filter: LedgerEntriesFilter) => ["ledger", clubId, "entries", filter] as const,
  recurring:  (clubId: string) => ["ledger", clubId, "recurring"] as const,
  openAccounts: (clubId: string) => ["ledger", clubId, "open-accounts"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts/ledger`;

export const ledgerService = {
  categories: {
    list:   (clubId: string) => api.get<LedgerCategory[]>(`${base(clubId)}/categories`).then((r) => r.data),
    create: (clubId: string, data: CategoryPayload) =>
      api.post<LedgerCategory>(`${base(clubId)}/categories`, data).then((r) => r.data),
    update: (clubId: string, id: string, data: Partial<Omit<CategoryPayload, "kind">> & { active?: boolean; displayOrder?: number }) =>
      api.patch<LedgerCategory>(`${base(clubId)}/categories/${id}`, data).then((r) => r.data),
    /** 204; con 409 ACCOUNTS_IN_USE es de serie o ya se usó: solo se desactiva. */
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/categories/${id}`).then(() => undefined),
  },

  entries: {
    list: (clubId: string, f: LedgerEntriesFilter) =>
      api
        .get<LedgerEntriesPage>(`${base(clubId)}/entries`, {
          params: {
            from: f.from, to: f.to, kind: f.kind, categoryId: f.categoryId, page: f.page,
            missingReceipt: f.missingReceipt ? "true" : undefined,
          },
        })
        .then((r) => r.data),
    create: (clubId: string, data: LedgerEntryPayload) =>
      api.post<LedgerEntry>(`${base(clubId)}/entries`, data).then((r) => r.data),
    update: (clubId: string, id: string, data: Partial<LedgerEntryPayload>) =>
      api.patch<LedgerEntry>(`${base(clubId)}/entries/${id}`, data).then((r) => r.data),
    pay: (clubId: string, id: string, data: { payment: LedgerPayment; partnerId?: string | null; paidOn?: string }) =>
      api.post<LedgerEntry>(`${base(clubId)}/entries/${id}/pay`, data).then((r) => r.data),
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/entries/${id}`).then(() => undefined),
  },

  attachments: {
    upload: (clubId: string, entryId: string, file: Blob, fileName: string) => {
      const form = new FormData();
      form.append("file", file, fileName);
      return api
        .post<LedgerAttachment>(`${base(clubId)}/entries/${entryId}/attachments`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    /** URL firmada de 5 minutos: se abre en otra pestaña, nunca se guarda. */
    url: (clubId: string, attachmentId: string) =>
      api.get<{ url: string; expiresAt: string }>(`${base(clubId)}/attachments/${attachmentId}/url`).then((r) => r.data),
    remove: (clubId: string, attachmentId: string) =>
      api.delete(`${base(clubId)}/attachments/${attachmentId}`).then(() => undefined),
  },

  recurring: {
    list:   (clubId: string) => api.get<LedgerRecurring[]>(`${base(clubId)}/recurring`).then((r) => r.data),
    create: (clubId: string, data: LedgerRecurringPayload) =>
      api.post<LedgerRecurring>(`${base(clubId)}/recurring`, data).then((r) => r.data),
    update: (clubId: string, id: string, data: Partial<LedgerRecurringPayload>) =>
      api.patch<LedgerRecurring>(`${base(clubId)}/recurring/${id}`, data).then((r) => r.data),
    /** 204; con 409 ACCOUNTS_IN_USE ya apuntó algo: se pausa. */
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/recurring/${id}`).then(() => undefined),
  },

  openAccounts: {
    list: (clubId: string) =>
      api.get<OpenAccount[]>(`/admin/clubs/${clubId}/accounts/open-accounts`).then((r) => r.data),
    set: (clubId: string, clubCustomerId: string, openAccount: boolean) =>
      api
        .patch<{ clubCustomerId: string; openAccount: boolean; converted: number }>(
          `/admin/clubs/${clubId}/accounts/open-accounts/${clubCustomerId}`,
          { openAccount },
        )
        .then((r) => r.data),
  },
};
