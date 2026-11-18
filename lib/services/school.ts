import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CancelRecoveries } from "@/types/school-recovery";
import type {
  AttendanceEntryPayload,
  GenerateSessionsResult,
  SchoolAttendanceSheet,
  SchoolCoach,
  SchoolGroupDetail,
  SchoolGroupListItem,
  SchoolGroupPayload,
  SchoolMember,
  SchoolSession,
  UpdateSchoolGroupPayload,
  UpdateSchoolSessionPayload,
} from "@/types/school";

/**
 * Escuela del club: grupos con su horario semanal, alumnos, clases (con la
 * pista que el sistema reserva) y asistencia. Un entrenador solo ve los
 * grupos que lleva y solo puede pasar lista; el back lo hace cumplir.
 */

export const schoolQK = {
  all:     (clubId: string) => ["school", clubId] as const,
  groups:  (clubId: string, archived: boolean) => ["school", clubId, "groups", archived] as const,
  group:   (clubId: string, groupId: string) => ["school", clubId, "group", groupId] as const,
  session: (clubId: string, sessionId: string) => ["school", clubId, "session", sessionId] as const,
  coaches: (clubId: string) => ["school", clubId, "coaches"] as const,
};

/**
 * Refresca lo de la escuela y la ocupación del calendario del club: la pista
 * de cada clase es un bloqueo, así que moverla, cancelarla o regenerarla
 * cambia también lo que ve el calendario.
 */
export function invalidateSchool(qc: QueryClient, clubId: string): void {
  void qc.invalidateQueries({ queryKey: schoolQK.all(clubId) });
  void qc.invalidateQueries({ queryKey: ["bookings", "occupations", clubId] });
}

const base = (clubId: string) => `/admin/clubs/${clubId}/school`;

export const schoolService = {
  groups: {
    list: (clubId: string, archived = false) =>
      api
        .get<SchoolGroupListItem[]>(`${base(clubId)}/groups`, { params: archived ? { archived: "true" } : undefined })
        .then((r) => r.data),
    get: (clubId: string, groupId: string) =>
      api.get<SchoolGroupDetail>(`${base(clubId)}/groups/${groupId}`).then((r) => r.data),
    create: (clubId: string, payload: SchoolGroupPayload) =>
      api.post<SchoolGroupDetail>(`${base(clubId)}/groups`, payload).then((r) => r.data),
    update: (clubId: string, groupId: string, payload: UpdateSchoolGroupPayload) =>
      api.patch<SchoolGroupDetail>(`${base(clubId)}/groups/${groupId}`, payload).then((r) => r.data),
    /** Archiva el grupo y libera la pista de sus clases futuras sin asistencia. */
    archive: (clubId: string, groupId: string) =>
      api.post<SchoolGroupDetail>(`${base(clubId)}/groups/${groupId}/archive`).then((r) => r.data),
    restore: (clubId: string, groupId: string) =>
      api.post<SchoolGroupDetail>(`${base(clubId)}/groups/${groupId}/restore`).then((r) => r.data),
  },

  members: {
    add: (clubId: string, groupId: string, clubCustomerId: string) =>
      api.post<SchoolMember>(`${base(clubId)}/groups/${groupId}/members`, { clubCustomerId }).then((r) => r.data),
    /** Baja del alumno (se queda su historial de asistencia). */
    leave: (clubId: string, groupId: string, memberId: string) =>
      api.post<SchoolMember>(`${base(clubId)}/groups/${groupId}/members/${memberId}/leave`).then((r) => r.data),
  },

  sessions: {
    /** Genera o regenera las clases de la temporada: borra solo las futuras sin asistencia y vuelve a generar. */
    generate: (clubId: string, groupId: string) =>
      api.post<GenerateSessionsResult>(`${base(clubId)}/groups/${groupId}/sessions/generate`).then((r) => r.data),
    sheet: (clubId: string, sessionId: string) =>
      api.get<SchoolAttendanceSheet>(`${base(clubId)}/sessions/${sessionId}`).then((r) => r.data),
    update: (clubId: string, sessionId: string, payload: UpdateSchoolSessionPayload) =>
      api.patch<SchoolSession>(`${base(clubId)}/sessions/${sessionId}`, payload).then((r) => r.data),
    /**
     * Cancela la clase. Con `grantRecovery` (por defecto, sí) cada alumno gana una
     * recuperación; a quien recuperaba en ella se le devuelve el crédito siempre.
     */
    cancel: (clubId: string, sessionId: string, reason?: string, grantRecovery = true) =>
      api
        .post<SchoolSession & { recoveries: CancelRecoveries }>(`${base(clubId)}/sessions/${sessionId}/cancel`, {
          reason,
          grantRecovery,
        })
        .then((r) => r.data),
    setAttendance: (clubId: string, sessionId: string, entries: AttendanceEntryPayload[]) =>
      api.put<SchoolAttendanceSheet>(`${base(clubId)}/sessions/${sessionId}/attendance`, { entries }).then((r) => r.data),
  },

  coaches: {
    list: (clubId: string) => api.get<SchoolCoach[]>(`${base(clubId)}/coaches`).then((r) => r.data),
    update: (clubId: string, staffId: string, coachBio: string | null) =>
      api.patch<SchoolCoach>(`${base(clubId)}/coaches/${staffId}`, { coachBio }).then((r) => r.data),
  },
};
