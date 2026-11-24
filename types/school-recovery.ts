/**
 * Recuperaciones y bandeja de la escuela del club: los créditos de recuperación
 * (lo que gana quien avisa de que falta, o a quien el club le cancela la
 * clase), los ajustes del club y las solicitudes que el entrenador apunta y
 * recepción decide. Los tipos de lo que devuelve /admin/clubs/:clubId/school.
 *
 * Los instantes van en ISO; las clases se enseñan en la zona del club.
 */

export type SchoolCreditOrigin = "ABSENCE" | "CLUB_CANCELLED" | "MANUAL";
export type SchoolCreditStatus = "available" | "used" | "expired" | "voided";

/** La clase donde se perdió o se gastó un crédito. */
export interface SchoolCreditSession {
  id:        string;
  startsAt:  string;
  groupName: string;
}

export interface SchoolCredit {
  id:             string;
  clubCustomerId: string;
  customerName:   string | null;
  origin:         SchoolCreditOrigin;
  status:         SchoolCreditStatus;
  /** Último instante en que se puede gastar (fin del día local del club). */
  expiresAt:      string;
  /** La clase perdida; null en las concedidas a mano. */
  sourceSession:  SchoolCreditSession | null;
  /** La clase donde se gastó; null si no se ha gastado. */
  usedSession:    SchoolCreditSession | null;
  usedAt:         string | null;
  voidedAt:       string | null;
  note:           string | null;
  createdAt:      string;
}

export interface SchoolCreditFilters {
  clubCustomerId?: string;
  status?:         SchoolCreditStatus;
}

/** Los ajustes de la escuela del club: las ventanas de las recuperaciones y lo de las cuotas. */
export interface SchoolConfig {
  /** Horas de antelación con las que hay que avisar para ganar la recuperación. */
  recoveryNoticeHours: number;
  /** Días que dura el crédito desde la clase perdida. */
  recoveryValidDays:   number;
  /** Último día del mes (1-28) para pagar la cuota sin estar «atrasada». */
  feeDueDay:           number;
  /** Generar las cuotas del mes en curso solas, cada hora y sin duplicar. */
  autoGenerateFees:    boolean;
}

/** Qué ha pasado al avisar una ausencia. */
export interface AbsenceResult {
  clubCustomerId: string;
  noticedAt:      string;
  /** La recuperación ganada; null si el aviso llegó tarde. */
  credit:         { id: string; expiresAt: string } | null;
}

export interface RegisterAbsencePayload {
  clubCustomerId: string;
  /** Cuándo avisó el alumno (ISO; no puede ser futuro); sin él, ahora. */
  noticedAt?:     string;
}

/** Lo que pasó con los créditos al cancelar una clase. */
export interface CancelRecoveries {
  /** Recuperaciones nuevas para los alumnos de la clase. */
  granted:  number;
  /** Créditos devueltos a quienes recuperaban en ella. */
  returned: number;
}

// ── Bandeja ─────────────────────────────────────────────────────────────────

export type SchoolRequestKind = "JOIN_GROUP" | "ABSENCE" | "PRIVATE_CLASS" | "OTHER";
export type SchoolRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";
/** `RESOLVED`: las aceptadas y las rechazadas (el historial). */
export type SchoolRequestFilter = SchoolRequestStatus | "RESOLVED";

export interface SchoolRequest {
  id:             string;
  kind:           SchoolRequestKind;
  status:         SchoolRequestStatus;
  clubCustomerId: string | null;
  customerName:   string | null;
  /** Quien aún no es cliente del club. */
  contactName:    string | null;
  contactPhone:   string | null;
  group:          { id: string; name: string } | null;
  session:        { id: string; startsAt: string; groupName: string } | null;
  coach:          { staffId: string; name: string } | null;
  message:        string | null;
  /** Nombre de quien la apuntó. */
  createdBy:      string;
  createdAt:      string;
  resolvedBy:     string | null;
  resolvedAt:     string | null;
  resolutionNote: string | null;
}

export interface CreateSchoolRequestPayload {
  kind:            SchoolRequestKind;
  clubCustomerId?: string | null;
  contactName?:    string | null;
  contactPhone?:   string | null;
  groupId?:        string | null;
  sessionId?:      string | null;
  coachStaffId?:   string | null;
  message?:        string | null;
}

export interface AcceptSchoolRequestPayload {
  /** Hace falta si la solicitud de alta no trae un cliente del club. */
  clubCustomerId?: string;
  note?:           string | null;
}
