"use client";

import { useMe } from "@/lib/use-me";
import { useRole } from "@/lib/use-role";
import { canAccess, type AccessLevel, type ClubArea, type ClubStaffRole } from "@/lib/club-permissions";

export interface ClubAccess {
  /** Roles en el club activo; null si aún no se sabe (o el back no los manda). */
  roles: ClubStaffRole[] | null;
  /** Si puede ese nivel en el área. AMT, todo; sin saber los roles, sí (el back decide). */
  can: (area: ClubArea, level?: AccessLevel) => boolean;
}

/** Lo que puede hacer quien tiene la sesión puesta, en el club con el que trabaja. */
export function useClubAccess(): ClubAccess {
  const { role, clubId } = useRole();
  const { data: me } = useMe();

  const activeId = me?.activeClubId ?? clubId;
  const roles = role === "club" ? me?.clubs?.find((c) => c.clubId === activeId)?.roles ?? null : null;

  return {
    roles,
    can: (area, level = "read") => (roles ? canAccess(roles, area, level) : true),
  };
}
