/**
 * Escuela del club: grupos con su entrenador y su horario semanal, sus
 * alumnos (clientes del club), las clases de la temporada con su pista y la
 * asistencia. Los tipos de lo que devuelve /admin/clubs/:clubId/school.
 *
 * Las fechas de calendario son «YYYY-MM-DD»; las horas de pared de las
 * franjas, «HH:MM» en la zona del club; los instantes de las clases, ISO.
 */

export type SchoolSessionStatus = "SCHEDULED" | "CANCELLED";
/** Academia o equipo de competición: separa sus ingresos en el resumen. */
export type SchoolActivity = "ACADEMY" | "TEAM";
/** Cómo paga un alumno su plaza: la cuota mensual del grupo o un bono de clases de la escuela. */
export type SchoolMemberBilling = "MONTHLY" | "VOUCHER";
export type SchoolAttendanceStatus = "PRESENT" | "ABSENT" | "EXCUSED";

/** Franja semanal de un grupo: día (1 lunes ... 7 domingo), hora y duración. */
export interface SchoolSlot {
  id:               string;
  weekday:          number;
  startTime:        string;
  durationMinutes:  number;
  /** La pista que se prefiere; sin ella, la primera libre del club. */
  preferredCourtId: string | null;
}

export interface SchoolCoachRef {
  /** Id de ClubStaff. */
  staffId: string;
  userId:  string;
  name:    string;
}

export interface SchoolGroup {
  id:          string;
  clubId:      string;
  name:        string;
  level:       string | null;
  maxStudents: number;
  /** Cuota mensual por alumno, en céntimos; null: el grupo no cobra cuota. */
  monthlyFeeCents: number | null;
  startDate:   string;
  endDate:     string;
  notes:       string | null;
  /** Academia (por defecto) o equipo de competición. */
  activity:    SchoolActivity;
  archivedAt:  string | null;
  createdAt:   string;
  coach:       SchoolCoachRef | null;
  slots:       SchoolSlot[];
}

/** Un grupo en el listado: con sus plazas ocupadas y las clases que quedan. */
export interface SchoolGroupListItem extends SchoolGroup {
  activeStudents:       number;
  upcomingSessions:     number;
  /** De las que quedan, las que no tienen pista. */
  upcomingWithoutCourt: number;
}

export interface SchoolMember {
  id:             string;
  clubCustomerId: string;
  name:           string | null;
  joinedAt:       string;
  /** Fecha de baja; null: sigue en el grupo. */
  leftAt:         string | null;
}

/**
 * Edad y tutor de un alumno de las listas de la escuela: el entrenador avisa
 * al tutor de un menor. No vienen con un back anterior: sin ellos, es un adulto.
 */
export interface SchoolStudentMinor {
  /** «YYYY-MM-DD»; null si no se conoce. */
  birthDate?:     string | null;
  /** Años cumplidos hoy en la zona del club; null sin fecha de nacimiento. */
  age?:           number | null;
  /** Menos de 18 años. */
  isMinor?:       boolean;
  guardianName?:  string | null;
  guardianPhone?: string | null;
}

/** Un alumno en la ficha de su grupo (el alta y la baja devuelven solo SchoolMember). */
export interface SchoolGroupMember extends SchoolMember, SchoolStudentMinor {
  billing:         SchoolMemberBilling;
  /** Descuento fijo en cada cuota, en céntimos; null: sin descuento (y para quien no lleva el dinero de la escuela). */
  discountCents:   number | null;
  discountReason:  string | null;
  /** Baja temporal: «AAAA-MM-DD» del día de la baja; null: no está de baja. */
  pausedFrom:      string | null;
  /** El día en que vuelve (el primero que ya paga); null: sin fecha de vuelta. */
  pausedUntil:     string | null;
  pauseReason:     string | null;
  /** Quien paga con bono: las clases que le quedan en sus bonos vigentes; null si paga cuota. */
  voucherRemaining: number | null;
}

/** Lo que cambia de un alumno dentro del grupo; lo que no va no cambia, y null quita el descuento o la baja. */
export interface UpdateSchoolMemberPayload {
  billing?:        SchoolMemberBilling;
  discountCents?:  number | null;
  discountReason?: string | null;
  pausedFrom?:     string | null;
  pausedUntil?:    string | null;
  pauseReason?:    string | null;
}

/** El alumno tras cambiarlo, con los avisos de las cuotas que no se pudieron tocar. */
export interface SchoolMemberUpdateResult extends SchoolMember {
  billing:        SchoolMemberBilling;
  discountCents:  number | null;
  discountReason: string | null;
  pausedFrom:     string | null;
  pausedUntil:    string | null;
  pauseReason:    string | null;
  warnings:       string[];
}

export interface SchoolSession {
  id:              string;
  groupId:         string;
  slotId:          string | null;
  startsAt:        string;
  endsAt:          string;
  status:          SchoolSessionStatus;
  cancelReason:    string | null;
  /** null: la clase está «sin pista». */
  court:           { id: string; name: string } | null;
  attendanceCount: number;
  /** Quien da la clase (el del grupo o una sustitución); null: sin entrenador. */
  coachStaffId:    string | null;
  coachName:       string | null;
}

/** Una clase dentro de la ficha de su grupo (el grupo ya se sabe). */
export type SchoolGroupSession = Omit<SchoolSession, "groupId">;

export interface SchoolGroupDetail extends SchoolGroup {
  members:        SchoolGroupMember[];
  activeStudents: number;
  sessions:       SchoolGroupSession[];
}

export interface SchoolAttendanceStudent extends SchoolStudentMinor {
  clubCustomerId: string;
  name:           string | null;
  /** null: aún sin apuntar. */
  status:         SchoolAttendanceStatus | null;
  /** Cuándo avisó de que falta (ausencia avisada); null si no ha avisado. */
  noticedAt:      string | null;
  /** La recuperación que ganó con ese aviso; null si avisó tarde. */
  earnedCreditId: string | null;
  /** Si está en la lista porque recupera (no es alumno del grupo). */
  recovery:       boolean;
  /** El crédito que ha gastado para estar en esta clase (solo si recupera). */
  usedCreditId:   string | null;
  /** Si paga con bono de clases: al marcarlo presente se gasta una clase de su bono. */
  paysWithVoucher?: boolean;
}

/** Un alumno al que no se le pudo gastar una clase de su bono al pasar lista. */
export interface SchoolVoucherWarning {
  clubCustomerId: string;
  name:           string | null;
  /** NO_VOUCHER: sin bono vigente; EXHAUSTED: con bono, pero sin clases. */
  reason:         "NO_VOUCHER" | "EXHAUSTED";
}

/** La hoja tras pasar lista: con los avisos de bono si los hay. */
export interface SchoolAttendanceResult extends SchoolAttendanceSheet {
  voucherWarnings?: SchoolVoucherWarning[];
}

export interface SchoolAttendanceSheet {
  session:  SchoolSession;
  group:    { id: string; name: string };
  students: SchoolAttendanceStudent[];
  /** Plazas del grupo y cuántas quedan libres (descontando avisos y recuperaciones). */
  capacity: { maxStudents: number; freeSpots: number };
}

export interface SchoolCoach {
  staffId:  string;
  userId:   string;
  name:     string;
  coachBio: string | null;
  /** Lo que cuesta una hora de clase privada con él (precio total), en céntimos; null: sin tarifa. */
  privateClassRateCents: number | null;
  groups:   { id: string; name: string }[];
}

/** Qué ha pasado al generar las clases de un grupo. */
export interface GenerateSessionsResult {
  created:           number;
  /** De las nuevas, las que se quedaron sin pista libre. */
  withoutCourt:      number;
  /** Clases que no se crean porque el club cierra ese día. */
  skippedClosedDays: number;
  /** Clases que no se crean porque caen fuera del horario del club de ese día. */
  skippedOutsideHours: number;
  /** Clases futuras sin asistencia que se borraron para volver a generarlas. */
  removed:           number;
}

export interface SchoolSlotPayload {
  /** Al editar: la franja que ya existe; sin id, es nueva. */
  id?:               string;
  weekday:           number;
  startTime:         string;
  durationMinutes:   number;
  preferredCourtId?: string | null;
}

export interface SchoolGroupPayload {
  name:          string;
  level?:        string | null;
  coachStaffId?: string | null;
  maxStudents:   number;
  /** En céntimos; null quita la cuota. */
  monthlyFeeCents?: number | null;
  startDate:     string;
  endDate:       string;
  notes?:        string | null;
  activity?:     SchoolActivity;
  slots:         SchoolSlotPayload[];
}

export type UpdateSchoolGroupPayload = Partial<SchoolGroupPayload>;

/** Cambiar la pista, el día o la hora de una clase; lo que no va no cambia. */
export interface UpdateSchoolSessionPayload {
  /** null: la deja sin pista. */
  courtId?:         string | null;
  date?:            string;
  startTime?:       string;
  durationMinutes?: number;
}

export interface AttendanceEntryPayload {
  clubCustomerId: string;
  status:         SchoolAttendanceStatus;
}
