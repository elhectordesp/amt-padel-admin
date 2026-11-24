/**
 * Cobro de la escuela: lo que no es pantalla. Los meses de las cuotas, sus
 * totales y estados, el precio que se propone a cada alumno de una clase
 * privada y el formulario de la clase con las mismas reglas que el back (que
 * es quien manda). Los importes van en céntimos.
 */

import { formatCents } from "@/lib/utils/booking-price";
import { eurosToCents, methodLabel } from "@/lib/utils/payment-methods";
import { SCHOOL_MAX_DURATION, SCHOOL_MIN_DURATION, SCHOOL_NOTES_MAX, endTimeOf, isRealDay } from "@/lib/utils/school";
import { SCHOOL_MAX_PRICE_CENTS, centsToFieldText, type Checked } from "@/lib/utils/school-money";
import { addDaysToKey, capitalizeFirst, formatDayKey, formatInTimeZone, isBeforeToday, zonedDayKey, zonedTime } from "@/lib/utils/time-zone";
import type { SchoolConfig } from "@/types/school-recovery";
import type {
  SchoolFee,
  SchoolFeeCancelReason,
  SchoolFeeStatus,
  SchoolPrivateClass,
  SchoolPrivateClassPayload,
  SchoolPrivateClassStudent,
} from "@/types/school-billing";

/** Lo mismo que el back acepta. */
export const SCHOOL_PRIVATE_CLASS_MAX_STUDENTS = 4;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

// ── Cuotas ──────────────────────────────────────────────────────────────────

export const FEE_STATUS_LABEL: Record<SchoolFeeStatus, string> = {
  PAID:      "Pagada",
  PARTIAL:   "Parcial",
  OVERDUE:   "Atrasada",
  PENDING:   "Pendiente",
  CANCELLED: "Anulada",
  ARCHIVED:  "Archivada",
};

/** Por qué el sistema anuló una cuota (el motivo del gestor va en su nota). */
export const FEE_CANCEL_REASON_LABEL: Record<SchoolFeeCancelReason, string> = {
  LEFT:    "Baja",
  PAUSED:  "Baja temporal",
  VOUCHER: "Paga con bono",
};

/** Por qué una cuota archivada no tiene cobro ni acciones. */
export const FEE_ARCHIVED_HINT = "Más de 6 años: ya no se guardan sus datos de cobro";

/** El mes («AAAA-MM») del día «AAAA-MM-DD». */
export function monthOfDay(day: string): string {
  return day.slice(0, 7);
}

/** El mes de hoy en la zona del club. */
export function currentMonth(now: Date, tz: string): string {
  return monthOfDay(zonedDayKey(now, tz));
}

/** ¿Cae ese instante en un mes anterior al de hoy, en la zona del club? Sin la zona (aún no se sabe), se supone que sí: lo estricto. */
export function isBeforeCurrentMonth(value: string | Date, tz: string | null, now: Date = new Date()): boolean {
  if (!tz) return true;
  return monthOfDay(zonedDayKey(value, tz)) < currentMonth(now, tz);
}

/** ¿Se cobró la cuota hoy (zona del club)? Cada pago con su día; una cobrada antes de los pagos, con su `paidAt`. */
export function feeCollectedToday(
  fee: Pick<SchoolFee, "payments" | "paidAt">,
  tz: string | null,
  now: Date = new Date(),
): boolean {
  const days = fee.payments.length > 0 ? fee.payments.map((p) => p.paidAt) : fee.paidAt ? [fee.paidAt] : [];
  return days.every((d) => !isBeforeToday(d, tz, now));
}

/** El mes `delta` meses después (o antes, si es negativo) de «AAAA-MM». */
export function shiftMonth(month: string, delta: number): string {
  const m = MONTH.exec(month);
  if (!m) return month;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  const year = Math.floor(total / 12);
  return `${String(year).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** «Noviembre de 2026». */
export function monthLabel(month: string): string {
  if (!MONTH.test(month)) return month;
  return capitalizeFirst(formatDayKey(`${month}-01`, { month: "long", year: "numeric" }));
}

export interface FeeTotals {
  /** Cuotas con algo pendiente (pendientes, parciales y atrasadas). */
  pendingCount: number;
  /** Lo que falta por cobrar de ellas. */
  pendingCents: number;
  /** Cuotas pagadas enteras. */
  paidCount:    number;
  /** Lo cobrado: lo pagado de todas las no anuladas, también lo de las parciales. */
  paidCents:    number;
}

/** Lo pendiente y lo cobrado de una lista de cuotas (las anuladas y las archivadas no cuentan). */
export function feeTotals(
  fees: readonly Pick<SchoolFee, "status" | "paidCents" | "pendingCents">[],
): FeeTotals {
  const totals: FeeTotals = { pendingCount: 0, pendingCents: 0, paidCount: 0, paidCents: 0 };
  for (const f of fees) {
    if (f.status === "CANCELLED" || f.status === "ARCHIVED") continue;
    totals.paidCents += f.paidCents;
    if (f.status === "PAID") {
      totals.paidCount += 1;
    } else {
      totals.pendingCount += 1;
      totals.pendingCents += f.pendingCents;
    }
  }
  return totals;
}

/** Lo que pasó al generar las cuotas, en una línea para el aviso. */
export function generateFeesText(r: { created: number; existing: number; due: number; groups: number }): string {
  if (r.groups === 0) return "Ningún grupo con cuota mensual tiene temporada en ese mes";
  if (r.due === 0) return "No hay alumnos a los que cobrar cuota en ese mes (los del bono y los de baja no pagan cuota)";
  const created = r.created === 0 ? "No había cuotas nuevas" : r.created === 1 ? "Se ha creado 1 cuota" : `Se han creado ${r.created} cuotas`;
  return r.existing > 0 ? `${created} · ${r.existing} ${r.existing === 1 ? "ya estaba" : "ya estaban"}` : created;
}

/** «Pagada · Efectivo», «Parcial» o «Atrasada»: el estado de la cuota con el método si está pagada entera. */
export function feeStateText(f: Pick<SchoolFee, "status" | "paymentMethod">): string {
  if (f.status === "PAID" && f.paymentMethod) return `Pagada · ${methodLabel(f.paymentMethod)}`;
  return FEE_STATUS_LABEL[f.status];
}

/** Cómo se llegó al importe de la cuota: «80,00 € − 6,25 € (Hermanos) · 5 de 8 clases», o vacío si es la cuota entera. */
export function feeBreakdownText(
  f: Pick<SchoolFee, "listCents" | "discountCents" | "prorationNote" | "amountCents">,
  discountReason?: string | null,
): string {
  const parts: string[] = [];
  if (f.prorationNote) parts.push(f.prorationNote);
  if (f.discountCents) {
    parts.push(`− ${formatCents(f.discountCents)}${discountReason ? ` (${discountReason})` : ""}`);
  }
  return parts.join(" · ");
}

export interface FeeShare {
  feeId:       string;
  amountCents: number;
}

/**
 * Cómo se reparte un importe entre cuotas con algo pendiente, ya ordenadas (la
 * más antigua primero, como hace el back): lo que toca a cada una y, si el
 * importe supera lo pendiente, el cambio que sobra.
 */
export function allocateFeePayment(
  pending: readonly { id: string; pendingCents: number }[],
  amountCents: number,
): { shares: FeeShare[]; changeCents: number } {
  let left = amountCents;
  const shares: FeeShare[] = [];
  for (const f of pending) {
    if (left <= 0) break;
    const share = Math.min(left, f.pendingCents);
    if (share > 0) shares.push({ feeId: f.id, amountCents: share });
    left -= share;
  }
  return { shares, changeCents: Math.max(0, left) };
}

/** Las cuotas con algo pendiente de un alumno, de la más antigua a la más nueva (y por grupo). */
export function pendingFeesOf(fees: readonly SchoolFee[]): SchoolFee[] {
  return fees
    .filter((f) => f.status !== "CANCELLED" && f.pendingCents > 0)
    .sort((a, b) => a.month.localeCompare(b.month) || a.groupName.localeCompare(b.groupName, "es") || a.id.localeCompare(b.id));
}

// ── Ajustes de las cuotas ───────────────────────────────────────────────────

/** Lo mismo que el back acepta del día límite de pago. */
export const FEE_DUE_DAY_MIN = 1;
export const FEE_DUE_DAY_MAX = 28;

export interface FeeSettingsForm {
  /** Día límite de pago, como se escribe. */
  feeDueDay:        string;
  autoGenerateFees: boolean;
}

export function feeSettingsOf(config: Pick<SchoolConfig, "feeDueDay" | "autoGenerateFees">): FeeSettingsForm {
  return { feeDueDay: String(config.feeDueDay), autoGenerateFees: config.autoGenerateFees };
}

/** Los ajustes de las cuotas con las reglas del back, listos para mandar. */
export function checkFeeSettings(
  form: FeeSettingsForm,
): Checked<Pick<SchoolConfig, "feeDueDay" | "autoGenerateFees">> {
  const day = Number(form.feeDueDay);
  if (form.feeDueDay.trim() === "" || !Number.isInteger(day) || day < FEE_DUE_DAY_MIN || day > FEE_DUE_DAY_MAX) {
    return { ok: false, message: `El día límite tiene que ser un día del mes entre ${FEE_DUE_DAY_MIN} y ${FEE_DUE_DAY_MAX}` };
  }
  return { ok: true, value: { feeDueDay: day, autoGenerateFees: form.autoGenerateFees } };
}

// ── Clases privadas ─────────────────────────────────────────────────────────

/** Las horas de una clase, para el precio propuesto: «60 min» son 1 hora. */
const HOUR = 60;

/**
 * El precio que se propone a cada alumno: la tarifa del entrenador (el precio
 * total de una hora) por las horas que dura la clase, repartido entre los
 * alumnos y redondeado al céntimo. null si no hay tarifa, duración válida o
 * alumnos.
 */
export function proposedStudentPriceCents(
  rateCents: number | null | undefined,
  durationMinutes: number,
  studentCount: number,
): number | null {
  if (!rateCents || rateCents <= 0) return null;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  if (!Number.isInteger(studentCount) || studentCount <= 0) return null;
  return Math.round((rateCents * durationMinutes) / HOUR / studentCount);
}

/** «2 de 3 cobrados». */
export function classPaymentSummary(c: Pick<SchoolPrivateClass, "students">): string {
  const paid = c.students.filter((s) => s.paid).length;
  return `${paid} de ${c.students.length} ${c.students.length === 1 ? "cobrado" : "cobrados"}`;
}

/** Lo que dice de un alumno su cobro: «Pendiente», «Cobrado · Efectivo», «Pagado con bono». */
export function studentPaymentText(s: Pick<SchoolPrivateClassStudent, "paid" | "paymentMethod">): string {
  if (!s.paid) return "Pendiente";
  return s.paymentMethod === "VOUCHER" ? "Pagado con bono" : `Cobrado · ${methodLabel(s.paymentMethod)}`;
}

/** «lun, 23 nov · 18:00–19:00» en la zona del club. */
export function privateClassWhen(c: Pick<SchoolPrivateClass, "startsAt" | "endsAt">, tz: string): string {
  const day = formatInTimeZone(c.startsAt, tz, { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${zonedTime(c.startsAt, tz)}–${zonedTime(c.endsAt, tz)}`;
}

/** Lo que dura la clase en minutos de reloj del club (una que acaba a medianoche cuenta hasta las 24:00). */
export function privateClassDuration(c: Pick<SchoolPrivateClass, "startsAt" | "endsAt">, tz: string): number {
  const mins = (v: string) => {
    const [h, m] = zonedTime(v, tz).split(":").map(Number);
    return h * 60 + m;
  };
  const diff = mins(c.endsAt) - mins(c.startsAt);
  return diff <= 0 ? diff + 24 * 60 : diff;
}

/** El rango por defecto de la lista: de hoy a dentro de una semana. */
export function defaultPrivateClassRange(now: Date, tz: string): { from: string; to: string } {
  const from = zonedDayKey(now, tz);
  return { from, to: addDaysToKey(from, 6) };
}

// ── Formulario de la clase ──────────────────────────────────────────────────

export interface StudentFormValues {
  /** Clave de la fila en pantalla (el id del cliente). */
  clubCustomerId: string;
  name:           string;
  /** En euros, como se escribe («30», «12,50»). */
  price:          string;
  /** Si el precio lo ha escrito la persona: ya no se recalcula al cambiar la hora o los alumnos. */
  priceTouched:   boolean;
  /** Ya cobrado: ni se quita ni cambia de precio. */
  paid:           boolean;
}

export interface PrivateClassFormValues {
  coachStaffId:    string;
  courtId:         string;
  date:            string;
  startTime:       string;
  durationMinutes: string;
  students:        StudentFormValues[];
  notes:           string;
}

export function emptyPrivateClassForm(date = ""): PrivateClassFormValues {
  return { coachStaffId: "", courtId: "", date, startTime: "18:00", durationMinutes: "60", students: [], notes: "" };
}

/** Euros para un campo de texto («30,00»). */
const eurosText = (cents: number): string => centsToFieldText(cents);

export function privateClassFormOf(c: SchoolPrivateClass, tz: string): PrivateClassFormValues {
  return {
    coachStaffId: c.coachStaffId ?? "",
    courtId: c.court?.id ?? "",
    date: zonedDayKey(c.startsAt, tz),
    startTime: zonedTime(c.startsAt, tz),
    durationMinutes: String(privateClassDuration(c, tz)),
    students: c.students.map((s) => ({
      clubCustomerId: s.clubCustomerId,
      name: s.name ?? "Sin nombre",
      price: eurosText(s.priceCents),
      priceTouched: true,
      paid: s.paid,
    })),
    notes: c.notes ?? "",
  };
}

/**
 * Pone a los alumnos cuyo precio no ha escrito nadie el que se propone (la
 * tarifa del entrenador por las horas de la clase, entre los alumnos). Sin
 * tarifa, no toca nada.
 */
export function withProposedPrices(form: PrivateClassFormValues, coachRateCents: number | null | undefined): PrivateClassFormValues {
  const proposed = proposedStudentPriceCents(coachRateCents, Number(form.durationMinutes), form.students.length);
  if (proposed === null) return form;
  return {
    ...form,
    students: form.students.map((s) => (s.priceTouched || s.paid ? s : { ...s, price: eurosText(proposed) })),
  };
}

/** El formulario de la clase con las reglas del back, listo para mandar o con lo que falta. */
export function checkPrivateClassForm(form: PrivateClassFormValues): Checked<SchoolPrivateClassPayload> {
  const fail = (message: string): Checked<SchoolPrivateClassPayload> => ({ ok: false, message });

  if (!form.courtId) return fail("Elige la pista de la clase");
  if (!isRealDay(form.date)) return fail("Elige el día de la clase");
  if (!HHMM.test(form.startTime)) return fail("Escribe la hora de la clase (HH:MM)");
  const duration = Number(form.durationMinutes);
  if (form.durationMinutes.trim() === "" || !Number.isInteger(duration) || duration < SCHOOL_MIN_DURATION || duration > SCHOOL_MAX_DURATION) {
    return fail(`La duración tiene que estar entre ${SCHOOL_MIN_DURATION} y ${SCHOOL_MAX_DURATION} minutos`);
  }
  if (endTimeOf(form.startTime, duration) === null) return fail("La clase no cabe en el día (acaba después de las 24:00)");
  const notes = form.notes.trim();
  if (notes.length > SCHOOL_NOTES_MAX) return fail(`Las notas no pueden pasar de ${SCHOOL_NOTES_MAX} caracteres`);

  if (form.students.length === 0) return fail("Añade al menos un alumno");
  if (form.students.length > SCHOOL_PRIVATE_CLASS_MAX_STUDENTS) {
    return fail(`Una clase privada admite como mucho ${SCHOOL_PRIVATE_CLASS_MAX_STUDENTS} alumnos`);
  }
  const students: SchoolPrivateClassPayload["students"] = [];
  for (const s of form.students) {
    const cents = eurosToCents(s.price);
    if (cents === null) return fail(`Escribe un precio válido para ${s.name} (por ejemplo 30 o 12,50)`);
    if (cents > SCHOOL_MAX_PRICE_CENTS) return fail(`El precio de ${s.name} no puede pasar de 100.000 €`);
    students.push({ clubCustomerId: s.clubCustomerId, priceCents: cents });
  }

  return {
    ok: true,
    value: {
      coachStaffId: form.coachStaffId || null,
      courtId: form.courtId,
      date: form.date,
      startTime: form.startTime,
      durationMinutes: duration,
      students,
      notes: notes || null,
    },
  };
}

