import { api } from "@/lib/api";

/**
 * Módulo «Cuentas» del club (F8): el interruptor que enciende AMT, los socios
 * a cuyo móvil llega un Bizum y los precios especiales con nombre (alumno,
 * amigos del club...). Todo responde 403 ACCOUNTS_DISABLED con el módulo
 * apagado, salvo el interruptor. Los importes van en céntimos.
 */

export interface ClubPartner {
  id:     string;
  name:   string;
  active: boolean;
}

export const PART_PRICE_KINDS = ["STUDENT", "SPECIAL"] as const;
export type PartPriceKind = (typeof PART_PRICE_KINDS)[number];

export interface PartPriceSlot {
  /** 1 (lunes) a 7 (domingo). */
  daysOfWeek: number[];
  /** HH:mm */
  startTime:  string;
  /** HH:mm */
  endTime:    string;
  priceCents: number;
}

export interface PartPrice {
  id:           string;
  name:         string;
  kind:         PartPriceKind;
  /** Precio de la pista entera (se reparte entre las partes) en vez de por jugador. */
  perCourt:     boolean;
  active:       boolean;
  displayOrder: number;
  slots:        PartPriceSlot[];
}

export interface CreatePartPricePayload {
  name:     string;
  kind:     PartPriceKind;
  perCourt: boolean;
  slots:    PartPriceSlot[];
}

export interface UpdatePartPricePayload extends CreatePartPricePayload {
  active:       boolean;
  displayOrder: number;
}

export const accountsQK = {
  partners:   (clubId: string) => ["club-accounts", clubId, "partners"] as const,
  partPrices: (clubId: string) => ["club-accounts", clubId, "part-prices"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts`;

export const accountsService = {
  /** Solo AMT. */
  setEnabled: (clubId: string, enabled: boolean) =>
    api.patch<{ accountsEnabled: boolean }>(`/admin/clubs/${clubId}/accounts/enabled`, { enabled }).then((r) => r.data),

  /** Solo AMT: la tesorería va sobre «Cuentas» (409 TREASURY_NEEDS_ACCOUNTS si está apagado). */
  setTreasuryEnabled: (clubId: string, enabled: boolean) =>
    api.patch<{ treasuryEnabled: boolean }>(`/admin/clubs/${clubId}/accounts/treasury-enabled`, { enabled }).then((r) => r.data),

  partners: {
    list:   (clubId: string) =>
      api.get<ClubPartner[]>(`${base(clubId)}/partners`).then((r) => r.data),
    create: (clubId: string, name: string) =>
      api.post<ClubPartner>(`${base(clubId)}/partners`, { name }).then((r) => r.data),
    update: (clubId: string, id: string, data: { name?: string; active?: boolean }) =>
      api.patch<ClubPartner>(`${base(clubId)}/partners/${id}`, data).then((r) => r.data),
  },

  partPrices: {
    list:   (clubId: string) =>
      api.get<PartPrice[]>(`${base(clubId)}/part-prices`).then((r) => r.data),
    create: (clubId: string, data: CreatePartPricePayload) =>
      api.post<PartPrice>(`${base(clubId)}/part-prices`, data).then((r) => r.data),
    /** Sustituye las franjas. */
    update: (clubId: string, id: string, data: UpdatePartPricePayload) =>
      api.put<PartPrice>(`${base(clubId)}/part-prices/${id}`, data).then((r) => r.data),
    /** 204; con 409 ACCOUNTS_IN_USE ya se usó y solo se puede desactivar. */
    remove: (clubId: string, id: string) =>
      api.delete(`${base(clubId)}/part-prices/${id}`).then(() => undefined),
  },
};
