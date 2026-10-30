import { ApiError } from "@/lib/api";
import { DEFAULT_TIME_ZONE, formatInTimeZone } from "@/lib/utils/time-zone";
import type { ClubAdminInvitation } from "@/types";

/** La query de los admins y las invitaciones de un club. */
export const clubAdminsQueryKey = (clubId: string) => ["admin-club-admins", clubId] as const;

/** Fecha corta (6/11/26), en la hora de España como el resto de Clubes. */
function shortDate(value: string): string {
  return formatInTimeZone(value, DEFAULT_TIME_ZONE, { dateStyle: "short" });
}

/** Desde cuándo administra el club (cuándo aceptó la invitación). */
export function adminSinceLabel(createdAt: string): string {
  return `Desde el ${shortDate(createdAt)}`;
}

/** La etiqueta del estado de una invitación sin aceptar (lo calcula el back). */
export function invitationStatusLabel(status: ClubAdminInvitation["status"]): string {
  return status === "expired" ? "Caducada" : "Pendiente";
}

/** Cuándo se mandó, quién la mandó y cuándo caduca o caducó. */
export function invitationDetail(
  invitation: Pick<ClubAdminInvitation, "status" | "createdAt" | "expiresAt" | "invitedBy">,
): string {
  const by = invitation.invitedBy ? ` por ${invitation.invitedBy.name}` : "";
  const expiry = invitation.status === "expired" ? "caducó" : "caduca";
  return `Enviada el ${shortDate(invitation.createdAt)}${by} · ${expiry} el ${shortDate(invitation.expiresAt)}`;
}

/**
 * Lo que dice la API cuando la invitación ya no es la que se ve: se aceptó o
 * se anuló mientras tanto, o se reenvió pero el email no salió (la nueva ya
 * está creada). Hay que volver a pedir la lista.
 */
const CHANGED_MEANWHILE = new Set([
  "CLUB_INVITATION_NOT_FOUND",
  "CLUB_INVITATION_ALREADY_ACCEPTED",
  "INVITE_EMAIL_FAILED",
]);

export function invitationsChangedMeanwhile(err: unknown): boolean {
  return err instanceof ApiError && !!err.code && CHANGED_MEANWHILE.has(err.code);
}
