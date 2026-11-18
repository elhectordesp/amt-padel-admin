import { api } from "@/lib/api";
import type {
  AbsenceResult,
  AcceptSchoolRequestPayload,
  CreateSchoolRequestPayload,
  RegisterAbsencePayload,
  SchoolConfig,
  SchoolCredit,
  SchoolCreditFilters,
  SchoolRequest,
  SchoolRequestFilter,
} from "@/types/school-recovery";

/**
 * Recuperaciones y bandeja de la escuela: ausencias avisadas, créditos de
 * recuperación, los ajustes del club y las solicitudes. Todo cuelga de
 * ["school", clubId], así que `invalidateSchool` lo refresca junto con el
 * resto de la escuela. El back decide quién puede qué: un entrenador solo
 * apunta y ve solicitudes de sus grupos y no ve los créditos.
 */

export const schoolRecoveryQK = {
  credits:  (clubId: string, filters: SchoolCreditFilters) => ["school", clubId, "credits", filters] as const,
  config:   (clubId: string) => ["school", clubId, "config"] as const,
  requests: (clubId: string, status: SchoolRequestFilter) => ["school", clubId, "requests", status] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/school`;

export const schoolRecoveryService = {
  absences: {
    /** Avisa de que un alumno falta; con margen suficiente gana una recuperación. */
    register: (clubId: string, sessionId: string, payload: RegisterAbsencePayload) =>
      api.post<AbsenceResult>(`${base(clubId)}/sessions/${sessionId}/absences`, payload).then((r) => r.data),
    /** Deshace el aviso y la recuperación que dio (si no se ha gastado). */
    undo: (clubId: string, sessionId: string, clubCustomerId: string) =>
      api
        .delete<{ clubCustomerId: string; creditRemoved: boolean }>(
          `${base(clubId)}/sessions/${sessionId}/absences/${clubCustomerId}`,
        )
        .then((r) => r.data),
  },

  recoveries: {
    /** Apunta un crédito disponible a una clase futura con hueco. */
    use: (clubId: string, sessionId: string, creditId: string) =>
      api
        .post<{ creditId: string; clubCustomerId: string; sessionId: string; usedAt: string }>(
          `${base(clubId)}/sessions/${sessionId}/recoveries`,
          { creditId },
        )
        .then((r) => r.data),
    /** Devuelve el crédito de quien recuperaba en la clase (solo antes de que empiece). */
    giveBack: (clubId: string, sessionId: string, creditId: string) =>
      api
        .delete<{ creditId: string; clubCustomerId: string }>(`${base(clubId)}/sessions/${sessionId}/recoveries/${creditId}`)
        .then((r) => r.data),
  },

  credits: {
    list: (clubId: string, filters: SchoolCreditFilters = {}) =>
      api.get<SchoolCredit[]>(`${base(clubId)}/credits`, { params: filters }).then((r) => r.data),
    /** Concede una recuperación a mano; la nota explica por qué. */
    grant: (clubId: string, clubCustomerId: string, note: string) =>
      api.post<SchoolCredit>(`${base(clubId)}/credits`, { clubCustomerId, note }).then((r) => r.data),
    void: (clubId: string, creditId: string) =>
      api.post<SchoolCredit>(`${base(clubId)}/credits/${creditId}/void`).then((r) => r.data),
  },

  config: {
    get: (clubId: string) => api.get<SchoolConfig>(`${base(clubId)}/config`).then((r) => r.data),
    update: (clubId: string, payload: Partial<SchoolConfig>) =>
      api.put<SchoolConfig>(`${base(clubId)}/config`, payload).then((r) => r.data),
  },

  requests: {
    list: (clubId: string, status: SchoolRequestFilter) =>
      api.get<SchoolRequest[]>(`${base(clubId)}/requests`, { params: { status } }).then((r) => r.data),
    create: (clubId: string, payload: CreateSchoolRequestPayload) =>
      api.post<SchoolRequest>(`${base(clubId)}/requests`, payload).then((r) => r.data),
    /** Acepta y hace lo que pide (apuntar al grupo, avisar la ausencia). Definitivo. */
    accept: (clubId: string, requestId: string, payload: AcceptSchoolRequestPayload = {}) =>
      api.post<SchoolRequest>(`${base(clubId)}/requests/${requestId}/accept`, payload).then((r) => r.data),
    reject: (clubId: string, requestId: string, note?: string) =>
      api.post<SchoolRequest>(`${base(clubId)}/requests/${requestId}/reject`, { note }).then((r) => r.data),
  },
};
