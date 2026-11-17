/**
 * Qué puede hacer cada rol del equipo de un club. Es la única tabla del panel:
 * el menú, la portada y el aviso de «sin acceso» salen de aquí. El back es
 * quien manda de verdad (devuelve 403 CLUB_ROLE_FORBIDDEN); esto evita enseñar
 * lo que el rol no puede ni leer. Sin dependencias de navegador.
 */

export const CLUB_STAFF_ROLES = [
  "OWNER", "MANAGER", "TOURNAMENTS", "RESULTS", "RECEPTION", "COACH",
] as const;
export type ClubStaffRole = (typeof CLUB_STAFF_ROLES)[number];

/** Con qué clubes trabaja una persona y con qué roles (viene en el login y en /auth/me). */
export interface ClubMembership {
  clubId:   string;
  clubName: string;
  roles:    ClubStaffRole[];
}

export const CLUB_AREAS = [
  // Datos básicos del club que cualquier pantalla necesita (el club, sus pistas,
  // horarios y excepciones, su config de reservas): lo lee todo el equipo. No es
  // un área de menú ni de página (areaForPath nunca la devuelve).
  "club", "tournaments", "results", "bookings", "customers", "cash", "settings", "staff",
] as const;
export type ClubArea = (typeof CLUB_AREAS)[number];

export type AccessLevel = "read" | "write";

/** Lo que se enseña cuando el back rechaza una acción por el rol. */
export const CLUB_ROLE_FORBIDDEN_MESSAGE = "Tu rol en este club no permite esta acción";

/** Lo que se enseña al entrar en una sección que el rol no puede ni leer. */
export const NO_SECTION_ACCESS_MESSAGE = "Tu rol en este club no da acceso a esta sección";

export const ROLE_LABEL: Record<ClubStaffRole, string> = {
  OWNER:       "Propietario",
  MANAGER:     "Gestor",
  TOURNAMENTS: "Torneos",
  RESULTS:     "Resultados",
  RECEPTION:   "Recepción",
  COACH:       "Entrenador",
};

/** Qué puede hacer quien tiene el rol, en una línea para el gestor. */
export const ROLE_DESCRIPTION: Record<ClubStaffRole, string> = {
  OWNER:       "Todo, también añadir y quitar al equipo. Siempre tiene que haber un propietario.",
  MANAGER:     "Todo el club menos gestionar el equipo (lo ve, pero no lo cambia).",
  TOURNAMENTS: "Crea y lleva los torneos y sus resultados. Ve reservas y clientes.",
  RESULTS:     "Mete los resultados de los partidos. Ve los torneos, nada más.",
  RECEPTION:   "Reservas, clientes y caja. Ve los torneos y la configuración del club.",
  COACH:       "Ve las reservas (para saber cuándo da clase). No cambia nada.",
};

type Grant = Partial<Record<ClubArea, AccessLevel>>;

const ALL_WRITE: Grant = {
  club: "write", tournaments: "write", results: "write", bookings: "write", customers: "write",
  cash: "write", settings: "write", staff: "write",
};

const PERMISSIONS: Record<ClubStaffRole, Grant> = {
  OWNER:       ALL_WRITE,
  MANAGER:     { ...ALL_WRITE, staff: "read" },
  TOURNAMENTS: { club: "read", tournaments: "write", results: "write", bookings: "read", customers: "read" },
  RESULTS:     { club: "read", tournaments: "read", results: "write" },
  RECEPTION:   { club: "read", bookings: "write", customers: "write", cash: "write", tournaments: "read", settings: "read" },
  COACH:       { club: "read", bookings: "read" },
};

/** Si alguno de los roles da ese nivel en el área (escribir incluye leer). */
export function canAccess(
  roles: readonly ClubStaffRole[],
  area: ClubArea,
  level: AccessLevel,
): boolean {
  return roles.some((role) => {
    const granted = PERMISSIONS[role]?.[area];
    return granted === "write" || (granted === "read" && level === "read");
  });
}

/**
 * El área de una página del panel del club, o null si es de libre acceso
 * (portada, perfil...). Reservas: calendario y listado son del área
 * «bookings»; el resto de ajustes de reservas (pistas, precios, horarios...)
 * son configuración del club.
 */
export function areaForPath(pathname: string): ClubArea | null {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (under("/mi-club/equipo")) return "staff";
  if (under("/mi-club/clientes")) return "customers";
  if (under("/mi-club/torneos") || under("/torneos") || under("/inscripciones")) return "tournaments";
  if (under("/resultados")) return "results";
  if (under("/caja")) return "cash";
  if (under("/mi-club/reservas/calendario") || under("/mi-club/reservas/bookings")) return "bookings";
  if (under("/mi-club") || under("/patrocinadores")) return "settings";
  return null;
}
