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
  // Escuela del club: grupos, alumnos, clases y asistencia
  "school",
  // Cuentas del club (módulo F8): socios del Bizum y precios especiales. Solo propietario y gestor
  "accounts",
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
  TOURNAMENTS: "Crea y lleva los torneos y sus resultados, y cobra sus inscripciones. Ve reservas y clientes.",
  RESULTS:     "Mete los resultados de los partidos. Ve los torneos, nada más.",
  RECEPTION:   "Reservas, clientes, caja y escuela. Ve los torneos y la configuración del club.",
  COACH:       "Ve las reservas y sus grupos de la escuela, y pasa lista. No cambia nada más.",
};

type Grant = Partial<Record<ClubArea, AccessLevel>>;

const ALL_WRITE: Grant = {
  club: "write", tournaments: "write", results: "write", bookings: "write", customers: "write",
  cash: "write", settings: "write", staff: "write", school: "write", accounts: "write",
};

const PERMISSIONS: Record<ClubStaffRole, Grant> = {
  OWNER:       ALL_WRITE,
  MANAGER:     { ...ALL_WRITE, staff: "read" },
  TOURNAMENTS: { club: "read", tournaments: "write", results: "write", bookings: "read", customers: "read" },
  RESULTS:     { club: "read", tournaments: "read", results: "write" },
  RECEPTION:   { club: "read", bookings: "write", customers: "write", cash: "write", tournaments: "read", settings: "read", school: "write" },
  // Lee la escuela y pasa lista de sus grupos (el back lo comprueba: solo los suyos)
  COACH:       { club: "read", bookings: "read", school: "read" },
};

/**
 * Áreas con las que se cobra una inscripción de torneo o de liga: basta con
 * escribir en la caja o en los torneos (el organizador de la mesa cobra sin
 * tener la caja del club). Son las mismas que el back pide en los dos
 * endpoints de cobro de inscripciones.
 */
export const REGISTRATION_PAYMENT_AREAS = ["cash", "tournaments"] as const satisfies readonly ClubArea[];

/**
 * Las acciones del club sin área propia (como anonimizar a un cliente) solo las
 * abren el propietario y el gestor, igual que en el back. Sin saber los roles,
 * no: aquí es mejor no ofrecer que ofrecer algo que dará 403.
 */
export function isOwnerOrManager(roles: readonly ClubStaffRole[] | null): boolean {
  return !!roles && (roles.includes("OWNER") || roles.includes("MANAGER"));
}

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
 * son configuración del club. La escuela (`/mi-club/escuela`) es la suya, antes
 * del comodín de `/mi-club`.
 */
export function areaForPath(pathname: string): ClubArea | null {
  const under = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  if (under("/mi-club/equipo") || under("/historial")) return "staff";
  if (under("/mi-club/escuela")) return "school";
  if (under("/mi-club/cuentas")) return "accounts";
  if (under("/mi-club/clientes") || under("/mi-club/mensajes")) return "customers";
  // Patrocinadores: el back los lee y los escribe con «tournaments»
  if (
    under("/mi-club/torneos") || under("/torneos") || under("/ligas") || under("/inscripciones") ||
    under("/patrocinadores")
  ) return "tournaments";
  if (under("/resultados")) return "results";
  if (under("/caja")) return "cash";
  if (under("/mi-club/reservas/calendario") || under("/mi-club/reservas/bookings")) return "bookings";
  if (under("/mi-club")) return "settings";
  return null;
}
