/**
 * Escuela del club: lo que no es pantalla. Las franjas y su texto, el
 * formulario del grupo con las mismas reglas que el back (que es quien manda),
 * y cuándo se puede pasar lista.
 */

import type {
  GenerateSessionsResult,
  SchoolAttendanceStatus,
  SchoolAttendanceStudent,
  SchoolGroup,
  SchoolGroupPayload,
  SchoolSession,
  SchoolSlot,
} from "@/types/school";
import { formatInTimeZone, zonedDayKey, zonedMinutes, zonedTime } from "@/lib/utils/time-zone";

export const SCHOOL_MAX_STUDENTS = 40;
export const SCHOOL_MAX_SLOTS = 14;
export const SCHOOL_MIN_DURATION = 15;
export const SCHOOL_MAX_DURATION = 240;
/** Lo que más puede durar la temporada de un grupo (13 meses). */
export const SCHOOL_MAX_SEASON_DAYS = 400;
export const SCHOOL_NOTES_MAX = 1000;
export const SCHOOL_BIO_MAX = 1000;

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.label ?? "";
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** La hora de fin de una franja («HH:MM», «24:00» si acaba a medianoche), o null si pasa del día. */
export function endTimeOf(startTime: string, durationMinutes: number): string | null {
  const end = toMinutes(startTime) + durationMinutes;
  return end > 24 * 60 ? null : `${pad2(Math.floor(end / 60))}:${pad2(end % 60)}`;
}

/** «Lunes 18:00–19:00». */
export function slotText(slot: Pick<SchoolSlot, "weekday" | "startTime" | "durationMinutes">): string {
  const end = endTimeOf(slot.startTime, slot.durationMinutes);
  return `${weekdayLabel(slot.weekday)} ${slot.startTime}${end ? `–${end}` : ""}`;
}

/** El horario semanal de un grupo en una línea. */
export function slotsSummary(slots: readonly SchoolSlot[]): string {
  if (slots.length === 0) return "Sin horario";
  return [...slots]
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map(slotText)
    .join(" · ");
}

// ── Formulario del grupo ────────────────────────────────────────────────────

export interface SlotFormValues {
  /** Clave de la fila en pantalla (el id si la franja ya existe). */
  key:              string;
  id?:              string;
  weekday:          string;
  startTime:        string;
  durationMinutes:  string;
  preferredCourtId: string;
}

export interface GroupFormValues {
  name:         string;
  level:        string;
  coachStaffId: string;
  maxStudents:  string;
  startDate:    string;
  endDate:      string;
  notes:        string;
  slots:        SlotFormValues[];
}

let slotCounter = 0;

export function newSlotForm(): SlotFormValues {
  slotCounter += 1;
  return {
    key: `new-${slotCounter}`,
    weekday: "1",
    startTime: "18:00",
    durationMinutes: "60",
    preferredCourtId: "",
  };
}

export function emptyGroupForm(): GroupFormValues {
  return {
    name: "",
    level: "",
    coachStaffId: "",
    maxStudents: "8",
    startDate: "",
    endDate: "",
    notes: "",
    slots: [newSlotForm()],
  };
}

export function groupFormOf(group: SchoolGroup): GroupFormValues {
  return {
    name: group.name,
    level: group.level ?? "",
    coachStaffId: group.coach?.staffId ?? "",
    maxStudents: String(group.maxStudents),
    startDate: group.startDate,
    endDate: group.endDate,
    notes: group.notes ?? "",
    slots: group.slots.map((s) => ({
      key: s.id,
      id: s.id,
      weekday: String(s.weekday),
      startTime: s.startTime,
      durationMinutes: String(s.durationMinutes),
      preferredCourtId: s.preferredCourtId ?? "",
    })),
  };
}

/** Días entre dos «YYYY-MM-DD» válidos (b - a). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Si «YYYY-MM-DD» es un día que existe (no «2026-02-30»). */
export function isRealDay(day: string): boolean {
  const m = DAY.exec(day);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export type CheckedGroupForm =
  | { ok: true; value: SchoolGroupPayload }
  | { ok: false; message: string };

/** Valida el formulario del grupo con las reglas del back y lo deja listo para mandar. */
export function checkGroupForm(form: GroupFormValues): CheckedGroupForm {
  const fail = (message: string): CheckedGroupForm => ({ ok: false, message });

  const name = form.name.trim();
  if (!name) return fail("Escribe el nombre del grupo");
  if (name.length > 80) return fail("El nombre del grupo no puede pasar de 80 caracteres");
  const level = form.level.trim();
  if (level.length > 40) return fail("El nivel no puede pasar de 40 caracteres");
  const notes = form.notes.trim();
  if (notes.length > SCHOOL_NOTES_MAX) return fail(`Las notas no pueden pasar de ${SCHOOL_NOTES_MAX} caracteres`);

  const maxStudents = Number(form.maxStudents);
  if (!Number.isInteger(maxStudents) || maxStudents < 1 || maxStudents > SCHOOL_MAX_STUDENTS) {
    return fail(`Las plazas tienen que ser un número entre 1 y ${SCHOOL_MAX_STUDENTS}`);
  }

  if (!isRealDay(form.startDate) || !isRealDay(form.endDate)) return fail("Elige el inicio y el fin de la temporada");
  const span = daysBetween(form.startDate, form.endDate);
  if (span < 0) return fail("La temporada no puede acabar antes de empezar");
  if (span > SCHOOL_MAX_SEASON_DAYS) return fail("La temporada no puede pasar de 13 meses");

  if (form.slots.length === 0) return fail("Añade al menos una franja del horario semanal");
  if (form.slots.length > SCHOOL_MAX_SLOTS) return fail(`Un grupo no puede tener más de ${SCHOOL_MAX_SLOTS} franjas`);

  const slots: SchoolGroupPayload["slots"] = [];
  for (const s of form.slots) {
    const weekday = Number(s.weekday);
    const duration = Number(s.durationMinutes);
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return fail("Elige el día de cada franja");
    if (!HHMM.test(s.startTime)) return fail("Escribe la hora de cada franja (HH:MM)");
    if (!Number.isInteger(duration) || duration < SCHOOL_MIN_DURATION || duration > SCHOOL_MAX_DURATION) {
      return fail(`La duración de cada clase tiene que estar entre ${SCHOOL_MIN_DURATION} y ${SCHOOL_MAX_DURATION} minutos`);
    }
    if (endTimeOf(s.startTime, duration) === null) {
      return fail(`La franja de las ${s.startTime} no cabe en el día (acaba después de las 24:00)`);
    }
    slots.push({
      ...(s.id ? { id: s.id } : {}),
      weekday,
      startTime: s.startTime,
      durationMinutes: duration,
      preferredCourtId: s.preferredCourtId || null,
    });
  }
  for (const day of WEEKDAYS) {
    const ranges = slots
      .filter((s) => s.weekday === day.value)
      .map((s) => ({ from: toMinutes(s.startTime), to: toMinutes(s.startTime) + s.durationMinutes }))
      .sort((a, b) => a.from - b.from);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].from < ranges[i - 1].to) return fail(`Dos franjas del ${day.label.toLowerCase()} se solapan`);
    }
  }

  return {
    ok: true,
    value: {
      name,
      level: level || null,
      coachStaffId: form.coachStaffId || null,
      maxStudents,
      startDate: form.startDate,
      endDate: form.endDate,
      notes: notes || null,
      slots,
    },
  };
}

const slotKey = (s: { weekday: number; startTime: string; durationMinutes: number; preferredCourtId?: string | null }) =>
  `${s.weekday}|${s.startTime}|${s.durationMinutes}|${s.preferredCourtId ?? ""}`;

/** Si lo guardado cambia el horario o las fechas del grupo: entonces hay que regenerar sus clases. */
export function scheduleChanged(
  group: Pick<SchoolGroup, "startDate" | "endDate" | "slots">,
  next: Pick<SchoolGroupPayload, "startDate" | "endDate" | "slots">,
): boolean {
  if (group.startDate !== next.startDate || group.endDate !== next.endDate) return true;
  const before = group.slots.map(slotKey).sort();
  const after = next.slots.map(slotKey).sort();
  return before.length !== after.length || before.some((k, i) => k !== after[i]);
}

// ── Clases y asistencia ─────────────────────────────────────────────────────

/** Lo que pasó al generar las clases, en una línea para el aviso. */
export function generateSummaryText(r: GenerateSessionsResult): string {
  const parts = [
    r.created === 0
      ? "No había clases nuevas que crear"
      : r.created === 1
        ? "Se ha creado 1 clase"
        : `Se han creado ${r.created} clases`,
  ];
  if (r.removed > 0) parts.push(`${r.removed} ${r.removed === 1 ? "futura sustituida" : "futuras sustituidas"}`);
  if (r.withoutCourt > 0) parts.push(`${r.withoutCourt} sin pista libre: asígnala a mano`);
  if (r.skippedClosedDays > 0) {
    parts.push(`${r.skippedClosedDays} ${r.skippedClosedDays === 1 ? "saltada" : "saltadas"} porque el club cierra`);
  }
  return parts.join(" · ");
}

/** «lun, 23 nov · 18:00–19:00» en la zona del club. */
export function sessionLabel(session: Pick<SchoolSession, "startsAt" | "endsAt">, tz: string): string {
  const day = formatInTimeZone(session.startsAt, tz, { weekday: "short", day: "numeric", month: "short" });
  return `${day} · ${zonedTime(session.startsAt, tz)}–${zonedTime(session.endsAt, tz)}`;
}

/** Lo que dura la clase en reloj de pared del club (minutos); una que acaba a medianoche cuenta hasta las 24:00. */
export function sessionDuration(session: Pick<SchoolSession, "startsAt" | "endsAt">, tz: string): number {
  const diff = zonedMinutes(session.endsAt, tz) - zonedMinutes(session.startsAt, tz);
  return diff <= 0 ? diff + 24 * 60 : diff;
}

/** Si la clase está para pasar lista: no cancelada y de hoy o de un día pasado (en la zona del club). */
export function canTakeAttendance(
  session: Pick<SchoolSession, "status" | "startsAt">,
  now: Date,
  tz: string,
): boolean {
  return session.status === "SCHEDULED" && zonedDayKey(session.startsAt, tz) <= zonedDayKey(now, tz);
}

export const ATTENDANCE_LABEL: Record<SchoolAttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  EXCUSED: "Justificada",
};

export interface AttendanceTotals {
  present: number;
  absent: number;
  excused: number;
  /** Sin apuntar. */
  pending: number;
}

export function attendanceTotals(students: readonly Pick<SchoolAttendanceStudent, "status">[]): AttendanceTotals {
  const totals: AttendanceTotals = { present: 0, absent: 0, excused: 0, pending: 0 };
  for (const s of students) {
    if (s.status === "PRESENT") totals.present += 1;
    else if (s.status === "ABSENT") totals.absent += 1;
    else if (s.status === "EXCUSED") totals.excused += 1;
    else totals.pending += 1;
  }
  return totals;
}
