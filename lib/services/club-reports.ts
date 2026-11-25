import { api } from "@/lib/api";
import type { LedgerActivity, LedgerPayment } from "@/lib/services/ledger";

/**
 * Resumen de cuentas del club (F8, C4): ingresos, gastos y resultado de una
 * semana, un mes, un trimestre o un año; «Requiere atención»; y las descargas
 * (Excel y ZIP de justificantes). Del área «accounts» y con el módulo «Cuentas»
 * encendido (si no, 403 ACCOUNTS_DISABLED). Importes en céntimos; los días
 * («AAAA-MM-DD») son del calendario del club.
 */

export type ReportPeriod = "week" | "month" | "quarter" | "year";

export const INCOME_SOURCES = [
  "BOOKINGS", "REGISTRATIONS", "VOUCHERS_COURT", "VOUCHERS_CLASS", "FEES_ACADEMY", "FEES_TEAMS",
  "PRIVATE_CLASSES", "SHOP", "OTHER_DEBTS", "LEDGER",
] as const;
export type IncomeSource = (typeof INCOME_SOURCES)[number];

export interface CategoryTotal {
  categoryId: string;
  name:       string;
  activity:   LedgerActivity;
  cents:      number;
}

export interface ActivityMargin {
  incomeCents:  number;
  expenseCents: number;
  resultCents:  number;
}

export interface SummarySeriesPoint {
  label:        string;
  from:         string;
  to:           string;
  incomeCents:  number;
  expenseCents: number;
  resultCents:  number;
}

export interface Summary {
  period: ReportPeriod;
  from:   string;
  to:     string;
  label:  string;
  income: {
    totalCents:       number;
    bySource:         Record<IncomeSource, number>;
    /** Los ingresos apuntados a mano, por categoría. */
    ledgerByCategory: CategoryTotal[];
    /** De las reservas, lo del contrato de pistas (cuentas abiertas). */
    contractCents:    number;
  };
  expenses: {
    totalCents:         number;
    /** Apuntes de gasto (también los pendientes), sin los pagos a entrenadores. */
    byCategory:         CategoryTotal[];
    coaches:            { accruedCents: number; missingRate: boolean };
    shopPurchasesCents: number;
    cardFeesCents:      number;
  };
  result:    number;
  /** Lo que entra y sale de los fondos: aparte, fuera de ingresos, gastos y resultado. */
  fund:      { inCents: number; outCents: number };
  /** Resultado entre ingresos (0,25 = 25 %); null sin ingresos. */
  marginPct: number | null;
  byActivity: Record<LedgerActivity, ActivityMargin>;
  shop: { costOfSoldCents: number };
  byMethod: {
    totalsByMethod:        Record<string, number>;
    bizumByReceiver:       Record<string, number>;
    ledgerIncomeByPayment: Partial<Record<LedgerPayment, number>>;
  };
  series:   SummarySeriesPoint[];
  warnings: string[];
}

export type AttentionKey =
  | "DEBTS_WARN" | "UNCLOSED_DAYS" | "CLOSURE_DIFF" | "MISSING_RECEIPTS" | "UNPAID_EXPENSES"
  | "NO_PAYMENT_METHOD" | "OVERDUE_FEES" | "PAUSES_RETURNING" | "EXHAUSTED_VOUCHERS"
  | "COACHES_PAY_DUE" | "OPEN_ACCOUNTS" | "LOW_STOCK"
  // Tesorería (fase 3): solo con ella encendida y empezada
  | "TREASURY_NO_COUNT" | "TREASURY_UNPLACED";

export interface AttentionDetail {
  label:        string;
  amountCents?: number;
  date?:        string;
  href?:        string;
}

export interface AttentionItem {
  key:         AttentionKey;
  severity:    "high" | "normal";
  title:       string;
  count:       number;
  amountCents: number | null;
  href:        string;
  details:     AttentionDetail[];
}

export interface Attention {
  items: AttentionItem[];
}

export const reportsQK = {
  all:       (clubId: string) => ["club-reports", clubId] as const,
  summary:   (clubId: string, period: ReportPeriod, date: string) => ["club-reports", clubId, "summary", period, date] as const,
  attention: (clubId: string) => ["club-reports", clubId, "attention"] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/accounts`;

/** Un fichero descargado: sus bytes y el nombre que le da el back. */
export interface Download {
  blob:     Blob;
  fileName: string;
}

/** El nombre del fichero de una cabecera `Content-Disposition` (el UTF-8 manda sobre el de ASCII). */
export function fileNameFromDisposition(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      // un nombre mal codificado: se prueba con el otro
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : fallback;
}

// Un Excel de un año o un ZIP con 300 fotos tarda más que una consulta normal
const DOWNLOAD_TIMEOUT_MS = 120_000;

async function download(url: string, params: Record<string, string>, fallback: string): Promise<Download> {
  const res = await api.get<Blob>(url, { params, responseType: "blob", timeout: DOWNLOAD_TIMEOUT_MS });
  return {
    blob: res.data,
    fileName: fileNameFromDisposition(res.headers?.["content-disposition"] as string | undefined, fallback),
  };
}

export const reportsService = {
  summary: (clubId: string, period: ReportPeriod, date: string) =>
    api.get<Summary>(`${base(clubId)}/summary`, { params: { period, date } }).then((r) => r.data),
  attention: (clubId: string) =>
    api.get<Attention>(`${base(clubId)}/attention`).then((r) => r.data),
  /** Solo mes, trimestre o año. */
  excel: (clubId: string, period: Exclude<ReportPeriod, "week">, date: string) =>
    download(`${base(clubId)}/export.xlsx`, { period, date }, "Cuentas.xlsx"),
  receipts: (clubId: string, month: string) =>
    download(`${base(clubId)}/receipts.zip`, { month }, `Justificantes ${month}.zip`),
};
