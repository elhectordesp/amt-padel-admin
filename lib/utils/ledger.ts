import type { LedgerActivity, LedgerPayment } from "@/lib/services/ledger";

/** Cómo se dicen en el panel las cosas de gastos, ingresos y entrenadores (F8 fase 2). */

/** Categoría de sistema de los pagos a entrenadores: se apuntan desde Entrenadores, no sueltos ni como fijo. */
export const COACHES_CATEGORY_KEY = "COACHES";

export const PAYMENT_LABEL: Record<LedgerPayment, string> = {
  CASH:    "Caja",
  BANK:    "Banco",
  CARD:    "Tarjeta o Bizum",
  PARTNER: "De su bolsillo",
  PENDING: "Pendiente de pago",
  UNKNOWN: "Sin indicar",
};

/** Las formas de pago que se ofrecen: «Pendiente» solo en gastos. */
export function paymentOptions(kind: "INCOME" | "EXPENSE", opts: { allowPending?: boolean } = {}) {
  const all: LedgerPayment[] = ["CASH", "BANK", "CARD", "PARTNER", "PENDING", "UNKNOWN"];
  return all
    .filter((p) => p !== "PENDING" || (kind === "EXPENSE" && opts.allowPending !== false))
    .map((value) => ({ value, label: PAYMENT_LABEL[value] }));
}

export const ACTIVITY_LABEL: Record<LedgerActivity, string> = {
  COURTS:      "Pistas",
  ACADEMY:     "Academia",
  TEAMS:       "Equipos",
  TOURNAMENTS: "Torneos",
  SHOP:        "Tienda",
  OTHER:       "Otros",
};

/** Cuánto pesa un fichero de justificante como máximo (10 MB, como el back). */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
/** Lado mayor al que se reducen las fotos en el navegador y su calidad JPEG. */
export const RECEIPT_MAX_SIDE = 1800;
export const RECEIPT_JPEG_QUALITY = 0.82;
export const RECEIPT_MAX_PER_ENTRY = 10;

/** Un PDF o una foto (JPEG, PNG o WEBP): lo único que admite el back. */
export function isReceiptFile(file: Pick<File, "type">): boolean {
  return file.type === "application/pdf" || ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

/** El tamaño al que queda una imagen para que su lado mayor no pase de `maxSide`. */
export function fitSize(width: number, height: number, maxSide = RECEIPT_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Lo que se sube de un fichero elegido: un PDF, tal cual; una foto, reducida a
 * 1.800 px de lado mayor en JPEG (0,82), para no mandar 8 MB desde el móvil. Si
 * el navegador no puede reducirla, se manda como está (el back la valida).
 */
export async function prepareReceipt(file: File): Promise<{ blob: Blob; name: string }> {
  if (file.type === "application/pdf") return { blob: file, name: file.name };
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, name: file.name };
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", RECEIPT_JPEG_QUALITY));
    if (!blob) return { blob: file, name: file.name };
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
  } catch {
    return { blob: file, name: file.name };
  }
}

/** «1 h 30 min», «45 min». */
export function minutesText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * El primer día que el back conserva («AAAA-01-01», 6 años): una fecha anterior
 * se rechaza porque la limpieza de esa noche borraría el apunte y sus justificantes.
 */
export const LEDGER_RETENTION_YEARS = 6;
export function ledgerRetentionMinDay(today: string): string {
  return `${Number(today.slice(0, 4)) - LEDGER_RETENTION_YEARS}-01-01`;
}

/** ¿Es «AAAA-MM-DD» un día real del calendario? */
export function isDayKey(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === text;
}

/** Cuánto se debe, dicho para la etiqueta de «Debe» (negativo = a favor). */
export function owedText(cents: number, format: (c: number) => string): string {
  if (cents < 0) return `${format(-cents)} a su favor`;
  return format(cents);
}

/** Los códigos nuevos de gastos, ingresos y entrenadores, dichos en llano. */
export const LEDGER_ERROR_MESSAGES: Record<string, string> = {
  LEDGER_CATEGORY_NOT_FOUND:  "Esa categoría ya no existe.",
  LEDGER_ENTRY_NOT_FOUND:     "Ese apunte ya no existe (alguien lo ha borrado).",
  LEDGER_ATTACHMENT_NOT_FOUND: "Ese justificante ya no existe.",
  LEDGER_RECURRING_NOT_FOUND: "Ese gasto o ingreso fijo ya no existe.",
  LEDGER_CATEGORY_INACTIVE:   "La categoría está desactivada. Elige otra o actívala en Ajustes.",
  LEDGER_ENTRY_NOT_PENDING:   "Ese gasto ya no está pendiente de pago.",
  LEDGER_FILE_INVALID:        "Solo se admiten fotos (JPEG, PNG o WEBP) o PDF.",
  LEDGER_FILE_TOO_LARGE:      "El justificante pesa más de 10 MB.",
  LEDGER_ATTACHMENT_LIMIT:    "Un apunte admite como mucho 10 justificantes.",
  LEDGER_STORAGE_UNAVAILABLE: "No se ha podido guardar o leer el justificante. Inténtalo de nuevo en un momento.",
  LEDGER_TOO_MANY_RECEIPTS:   "Ese mes tiene más de 300 justificantes y no caben en un ZIP.",
  COACH_PAY_NOT_FOUND:        "Ese entrenador ya no está en el equipo del club.",
  COACH_PAY_RATE_NOT_FOUND:   "Esa tarifa ya no existe.",
  COACH_PAY_HOURS_NOT_FOUND:  "Esas horas ya no existen.",
};

/** Estos traen del back el motivo concreto (qué dato falla): se enseña ese mensaje. */
export const LEDGER_BACK_MESSAGE_WINS = new Set(["LEDGER_INVALID", "COACH_PAY_INVALID"]);

/** El primer y el último día de un mes «AAAA-MM» (para filtrar los apuntes por fecha). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
