import type { Club } from "@/types";

/**
 * Estado de un club en el panel (D5). Lo calcula el back (`club.status`); el
 * panel no lo deduce de `active` y `deactivatedAt`:
 * - `active`: sale en la app.
 * - `deactivated`: lo desactivó AMT: su admin no entra al panel hasta que AMT
 *   lo reactive.
 * - `pending`: por configurar (alta rápida): su admin entra a ponerle los
 *   datos y se activa solo.
 * - `inactive`: inactivo con un back anterior, que no manda `status`: se
 *   trata como antes (se ofrece activarlo).
 */
export type ClubStatus = "active" | "deactivated" | "pending" | "inactive";

export function clubStatus(club: Pick<Club, "active" | "status">): ClubStatus {
  if (club.status) return club.status;
  return club.active === false ? "inactive" : "active";
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

/** Lo que dice la confirmación de cada acción (y el botón de la tarjeta). */
export interface ToggleConfirm {
  action:      ClubToggle;
  label:       string;
  title:       string;
  description: string;
  danger:      boolean;
}

/**
 * La confirmación para un club, tal como está al abrirla: se guarda entera
 * para que un refresco de la lista mientras está abierta no la cambie.
 */
export function toggleConfirm(club: Pick<Club, "active" | "status" | "pendingSetup">): ToggleConfirm {
  const status = clubStatus(club);
  const action = clubToggle(status);
  switch (action) {
    case "deactivate":
      return {
        action,
        label:       "Desactivar",
        title:       "¿Desactivar el club?",
        description: status === "pending"
          ? "Su admin perderá el acceso al panel. Ya no se activará solo al poner sus datos: habrá que reactivarlo a mano."
          : "Dejará de salir en la app y su admin no podrá entrar al panel hasta que lo reactives. Sus torneos se quedan como están.",
        danger:      true,
      };
    case "reactivate":
      return {
        action,
        label:       "Reactivar",
        title:       "¿Reactivar el club?",
        description: club.pendingSetup === false
          ? "Volverá a salir en la app y su admin podrá entrar."
          : "Su admin podrá volver a entrar al panel. Si aún está por configurar, no saldrá en la app hasta que su admin ponga el nombre y la ciudad reales.",
        danger:      false,
      };
    case "activate":
      return {
        action,
        label:       "Activar",
        title:       "¿Activar el club?",
        description: "Volverá a salir en la app.",
        danger:      false,
      };
  }
}
