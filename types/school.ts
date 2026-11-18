/**
 * Escuela del club: grupos con su entrenador y su horario semanal, sus
 * alumnos (clientes del club), las clases de la temporada con su pista y la
 * asistencia. Los tipos de lo que devuelve /admin/clubs/:clubId/school.
 *
 * Las fechas de calendario son «YYYY-MM-DD»; las horas de pared de las
 * franjas, «HH:MM» en la zona del club; los instantes de las clases, ISO.
 */

export type SchoolSessionStatus = "SCHEDULED" | "CANCELLED";
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
}

/** Una clase dentro de la ficha de su grupo (el grupo ya se sabe). */
export type SchoolGroupSession = Omit<SchoolSession, "groupId">;

export interface SchoolGroupDetail extends SchoolGroup {
  members:        SchoolMember[];
  activeStudents: number;
  sessions:       SchoolGroupSession[];
}

export interface SchoolAttendanceStudent {
  clubCustomerId: string;
  name:           string | null;
  /** null: aún sin apuntar. */
  status:         SchoolAttendanceStatus | null;
}

export interface SchoolAttendanceSheet {
  session:  SchoolSession;
  group:    { id: string; name: string };
  students: SchoolAttendanceStudent[];
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
