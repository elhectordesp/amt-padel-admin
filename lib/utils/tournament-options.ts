import { charCount } from "./char-count";
import type { ClubTournamentConfig, ParticipantsVisibility, UpdateClubTournamentConfigPayload } from "@/types";

/** Límites del back (MaxLength del DTO), contados como él (charCount). */
export const TOURNAMENT_DESCRIPTION_MAX = 5000;
export const TOURNAMENT_RULES_MAX = 10000;
export const HIDE_FROM_APP_MAX_DAYS = 365;

/** Formatos del asistente de «Nuevo torneo»: los mismos en las opciones del club, que lo alimentan. */
export const WIZARD_FORMAT_OPTIONS = [
  { value: "eliminatoria",        label: "Eliminatoria + Consolación" },
  { value: "grupos+eliminatoria", label: "Grupos + Eliminatoria" },
  { value: "round-robin",         label: "Round Robin" },
  { value: "cuadro",              label: "Cuadro" },
];

const MATCH_DURATIONS = [60, 90, 120];

/**
 * Las duraciones del asistente. Si la que hay es otra (el back admite de 15 a
 * 180), también sale: si no, el desplegable enseñaría la primera sin serlo.
 */
export function matchDurationOptions(current?: number): { value: string; label: string }[] {
  const minutes =
    current !== undefined && Number.isFinite(current) && !MATCH_DURATIONS.includes(current)
      ? [...MATCH_DURATIONS, current].sort((a, b) => a - b)
      : MATCH_DURATIONS;
  return minutes.map((m) => ({ value: String(m), label: `${m} minutos` }));
}

/** Quién ve la lista de parejas inscritas, dicho para quien organiza. */
export const PARTICIPANTS_VISIBILITY_OPTIONS: {
  value: ParticipantsVisibility;
  label: string;
  help:  string;
}[] = [
  {
    value: "PUBLIC",
    label: "Todos",
    help:  "Cualquier jugador ve en la app qué parejas están inscritas.",
  },
  {
    value: "REGISTERED_ONLY",
    label: "Solo los inscritos",
    help:  "Solo quien está inscrito en el torneo (en cualquier categoría) ve la lista; los demás no ven ninguna pareja.",
  },
  {
    value: "HIDDEN_UNTIL_START",
    label: "Nadie hasta que empiece",
    help:  "Hasta el día de inicio cada jugador solo ve su propia inscripción; desde ese día, la lista la ve todo el mundo.",
  },
];

export function participantsVisibilityLabel(value: ParticipantsVisibility): string {
  return PARTICIPANTS_VISIBILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** «Ocultar de la app» en palabras (el resumen del asistente). */
export function hideFromAppLabel(days: number | null): string {
  if (days === null) return "Nunca";
  if (days === 0) return "Al acabar el último día";
  return `${days} ${days === 1 ? "día" : "días"} después del último día`;
}

/**
 * Las opciones de torneo de un club como las usan los formularios: los textos
 * vacíos son "" (en el back, null).
 */
export type TournamentDefaults = Omit<ClubTournamentConfig, "id" | "clubId" | "description" | "rules"> & {
  description: string;
  rules:       string;
};

/**
 * Los de un club que no ha guardado opciones: los `@default` del back, que son
 * los que el asistente ponía siempre. Con ellos empieza el asistente mientras
 * llegan los del club.
 */
export const DEFAULT_TOURNAMENT_DEFAULTS: TournamentDefaults = {
  format:                   "eliminatoria",
  matchDuration:            60,
  hasShirts:                false,
  useSeeding:               false,
  requirePaymentToConfirm:  false,
  categoryPrice:            25,
  categorySpots:            32,
  dayStartTime:             "16:00",
  dayEndTime:               "21:00",
  maxUnavailableTotalHours: 0,
  description:              "",
  rules:                    "",
  participantsVisibility:   "PUBLIC",
  showClubInsteadOfCourt:   false,
  hideFromAppAfterDays:     null,
};

/** Los campos de las opciones, sin id ni club (lo que se edita y se manda). */
const DEFAULT_KEYS = Object.keys(DEFAULT_TOURNAMENT_DEFAULTS) as (keyof TournamentDefaults)[];

export function tournamentDefaultsFromConfig(config: ClubTournamentConfig): TournamentDefaults {
  const values = Object.fromEntries(DEFAULT_KEYS.map((key) => [key, config[key]])) as TournamentDefaults;
  return { ...values, description: config.description ?? "", rules: config.rules ?? "" };
}

/**
 * Lo que cambia en un formulario al pasar de unos valores de partida
 * (`applied`, los que se pusieron) a otros (`next`, p. ej. los del club):
 * solo los campos que siguen como se pusieron o sin valor. Lo que el admin
 * ha cambiado a mano se queda. Se compara con el valor y no con el «tocado»
 * del formulario: volver a un paso anterior lo reinicia y se perdería lo
 * cambiado.
 */
export function untouchedChanges<T extends object, K extends keyof T>(
  current: Partial<Pick<T, K>>,
  applied: Pick<T, K>,
  next:    Pick<T, K>,
  keys:    readonly K[],
): Partial<Pick<T, K>> {
  const changes: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = current[key];
    const untouched = value === undefined || Object.is(value, applied[key]);
    if (untouched && !Object.is(value, next[key])) changes[key] = next[key];
  }
  return changes;
}

/** El texto como se manda: sin espacios en los bordes. */
export const plainText = (value: string | null | undefined): string => (value ?? "").trim();

/** Si un texto pasa del límite del back (contado sin los espacios de los bordes, que no se mandan). */
export const textTooLong = (value: string | null | undefined, max: number): boolean =>
  charCount(plainText(value)) > max;

export const tooLongMessage = (max: number) => `Máximo ${max.toLocaleString("es-ES")} caracteres`;

/** Un texto opcional como lo guarda el back: sin espacios en los bordes, y vacío es null. */
export const plainTextOrNull = (value: string | null | undefined): string | null => plainText(value) || null;

/** Lo que manda «Guardar» en las opciones del club: todos sus campos. */
export function tournamentDefaultsPayload(values: TournamentDefaults): UpdateClubTournamentConfigPayload {
  return { ...values, description: plainTextOrNull(values.description), rules: plainTextOrNull(values.rules) };
}

const TIME_RE = /^\d{2}:\d{2}$/;

const isIntBetween = (n: number, min: number, max = Infinity) =>
  Number.isInteger(n) && n >= min && n <= max;

/** Qué falla en las opciones de torneo de un club, por campo (vacío si nada). Las reglas del back. */
export function tournamentDefaultsIssues(
  values: TournamentDefaults,
): Partial<Record<keyof TournamentDefaults, string>> {
  const issues: Partial<Record<keyof TournamentDefaults, string>> = {};
  if (!isIntBetween(values.matchDuration, 15, 180)) {
    issues.matchDuration = "Entre 15 y 180 minutos";
  }
  if (!isIntBetween(values.categorySpots, 4, 128)) {
    issues.categorySpots = "Entre 4 y 128 plazas";
  }
  if (!isIntBetween(values.categoryPrice, 0)) {
    issues.categoryPrice = "En euros, sin céntimos (0 si es gratis)";
  }
  if (!TIME_RE.test(values.dayStartTime)) issues.dayStartTime = "Pon la hora de inicio";
  if (!TIME_RE.test(values.dayEndTime)) {
    issues.dayEndTime = "Pon la hora de fin";
  } else if (!issues.dayStartTime && values.dayStartTime >= values.dayEndTime) {
    issues.dayEndTime = "La hora de fin debe ser posterior a la de inicio";
  }
  if (!isIntBetween(values.maxUnavailableTotalHours, 0)) {
    issues.maxUnavailableTotalHours = "Un número entero (0 = sin límite)";
  }
  if (values.hideFromAppAfterDays !== null && !isIntBetween(values.hideFromAppAfterDays, 0, HIDE_FROM_APP_MAX_DAYS)) {
    issues.hideFromAppAfterDays = `Entre 0 y ${HIDE_FROM_APP_MAX_DAYS} días`;
  }
  if (textTooLong(values.description, TOURNAMENT_DESCRIPTION_MAX)) {
    issues.description = tooLongMessage(TOURNAMENT_DESCRIPTION_MAX);
  }
  if (textTooLong(values.rules, TOURNAMENT_RULES_MAX)) {
    issues.rules = tooLongMessage(TOURNAMENT_RULES_MAX);
  }
  return issues;
}
