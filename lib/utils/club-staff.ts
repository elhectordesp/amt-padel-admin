import { ApiError } from "@/lib/api";
import { formatInTimeZone, DEFAULT_TIME_ZONE } from "@/lib/utils/time-zone";

/** La query del equipo de un club (miembros e invitaciones). */
export const clubStaffQueryKey = (clubId: string) => ["club-staff", clubId] as const;

export const LAST_OWNER_MESSAGE = "El club necesita al menos un propietario";
export const ALREADY_MEMBER_MESSAGE = "Esa persona ya forma parte del equipo del club";

/** Lo que se enseña de un error al invitar, cambiar roles, quitar, reenviar o anular. */
export function staffErrorMessage(err: Error): string {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code === "CLUB_STAFF_LAST_OWNER") return LAST_OWNER_MESSAGE;
  if (code === "CLUB_STAFF_ALREADY_MEMBER") return ALREADY_MEMBER_MESSAGE;
  return err.message;
}

/** Fecha corta, en la hora de España como el resto del panel. */
export function staffDate(value: string): string {
  return formatInTimeZone(value, DEFAULT_TIME_ZONE, { dateStyle: "short" });
}
