import type { Club } from "@/types";

/**
 * Estado de un club en el panel (D5):
 * - `active`: sale en la app.
 * - `deactivated`: lo desactivó AMT (inactivo y con fecha): su admin no entra
 *   al panel hasta que AMT lo reactive.
 * - `pending`: inactivo y sin fecha: por configurar (alta rápida); su admin
 *   entra a ponerle los datos y se activa solo.
 * - `inactive`: inactivo con un back anterior, que no manda `deactivatedAt`:
 *   no se sabe cuál de los dos, y se trata como antes.
 */
export type ClubStatus = "active" | "deactivated" | "pending" | "inactive";

export function clubStatus(club: Pick<Club, "active" | "deactivatedAt">): ClubStatus {
  if (club.active !== false) return "active";
  if (club.deactivatedAt === undefined) return "inactive";
  return club.deactivatedAt ? "deactivated" : "pending";
}

/** Lo que se le puede hacer desde la tarjeta: desactivarlo o volver a activarlo. */
export type ClubToggle = "deactivate" | "reactivate" | "activate";

export function clubToggle(status: ClubStatus): ClubToggle {
  switch (status) {
    case "active":
    case "pending":
      // Un club por configurar también se desactiva: su admin queda fuera
      return "deactivate";
    case "deactivated":
      return "reactivate";
    case "inactive":
      // Back anterior: como antes, se activa
      return "activate";
  }
}
