"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Rol de la cuenta tal como está en la BD. El del token (useRole) es 'admin'
 * tanto para ADMIN como para SUPERADMIN: para distinguirlos hay que leer este.
 */
export type AccountRole = "PLAYER" | "ADMIN" | "SUPERADMIN" | "CLUB";

export interface Me {
  id:    string;
  name:  string;
  // Opcional: una versión anterior del back no lo devuelve
  role?: AccountRole;
}

/** La cuenta con la que se ha entrado al panel (/auth/me). */
export function useMe() {
  return useQuery({
    queryKey:  ["admin-me"],
    queryFn:   () => api.get<Me>("/auth/me").then((r) => r.data),
    staleTime: Infinity,
  });
}

const ROLE_LABEL: Record<AccountRole, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN:      "Admin",
  CLUB:       "Admin de club",
  PLAYER:     "Jugador",
};

/** El rol para pantalla; vacío mientras no se sabe. */
export function roleLabel(role: string | undefined): string {
  return (role && ROLE_LABEL[role as AccountRole]) || "";
}

/** Solo un SUPERADMIN invita, cambia el rol o revoca administradores. */
export function canManageAdmins(me: Me | undefined): boolean {
  return me?.role === "SUPERADMIN";
}
