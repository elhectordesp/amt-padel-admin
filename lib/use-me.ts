"use client";

import { useQuery } from "@tanstack/react-query";
import { adminService, type AccountRole, type AdminUser } from "@/lib/services/admin";

export type { AccountRole };
export type Me = AdminUser;

/** Clave de caché de la cuenta; el login y el logout la vacían. */
export const ME_QUERY_KEY = ["admin-me"] as const;

/**
 * La cuenta con la que se ha entrado al panel (/auth/me). Se vuelve a pedir
 * al cabo de un minuto y al volver a la pestaña: si a un admin le cambian el
 * rol, deja de ver lo que ya no le toca sin recargar.
 */
export function useMe() {
  return useQuery({
    queryKey:             ME_QUERY_KEY,
    queryFn:              adminService.me,
    staleTime:            60_000,
    refetchOnWindowFocus: true,
  });
}

const ROLE_LABEL: Record<AccountRole, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN:      "Admin",
  CLUB:       "Admin de club",
  PLAYER:     "Jugador",
};

/** El rol para pantalla; vacío mientras no se sabe. */
export function roleLabel(role: string | undefined | null): string {
  return (role && ROLE_LABEL[role as AccountRole]) || "";
}

/**
 * Si se le enseñan los botones de gestionar administradores: solo al Super
 * Admin. Si el back no manda el rol (versión anterior), sí: decide el back.
 * Mientras no se sabe quién es, no.
 */
export function canManageAdmins(me: Me | undefined): boolean {
  if (!me) return false;
  return me.role === undefined || me.role === "SUPERADMIN";
}
