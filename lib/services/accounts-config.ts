import { api } from "@/lib/api";

/**
 * Ajustes de las cuentas del club (F8): plazo de las deudas, días de aviso y
 * comisión del datáfono. Recepción los lee; propietario y gestor los cambian.
 */

export interface AccountsConfig {
  /** Días que tiene una deuda para cobrarse (1-365); null = no caducan. */
  debtExpiryDays: number | null;
  /** Días (desde el de la deuda) en que la portada avisa de ella. */
  debtWarnDays:   number[];
  /** Comisión del datáfono en puntos básicos (150 = 1,50 %). */
  cardFeeBps:     number;
  /** Día («AAAA-MM-DD») desde el que se avisa de los gastos sin justificante; null = no se avisa. */
  receiptsRequiredFrom?: string | null;
  /**
   * Tesorería (fase 3; solo propietario y gestor los ven, y escribirlos exige la
   * tesorería encendida): el día en que empieza, el colchón y el saldo inicial
   * del fondo. Sin el campo al guardar, no cambian.
   */
  treasuryStartDate?: string | null;
  reserveCents?:      number;
  fundOpeningCents?:  number;
}

export const accountsConfigQK = {
  config: (clubId: string) => ["accounts-config", clubId] as const,
};

const url = (clubId: string) => `/admin/clubs/${clubId}/accounts/config`;

export const accountsConfigService = {
  get: (clubId: string) => api.get<AccountsConfig>(url(clubId)).then((r) => r.data),
  update: (clubId: string, input: AccountsConfig) =>
    api.put<AccountsConfig>(url(clubId), input).then((r) => r.data),
};
