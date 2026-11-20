import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ClubVoucher } from "@/lib/services/club-vouchers";
import type { SchoolCoach } from "@/types/school";
import type {
  GenerateFeesResult,
  PaySchoolStudentPayload,
  SchoolFee,
  SchoolFeeFilters,
  SchoolPrivateClass,
  SchoolPrivateClassPayload,
  UpdateSchoolPrivateClassPayload,
} from "@/types/school-billing";

/**
 * Cobro de la escuela del club: las cuotas mensuales de los grupos y las
 * clases privadas con su precio por alumno. Todo se cobra en el mostrador (o,
 * una clase privada, con un bono de clases privadas) y sale en la caja y en
 * «Pendiente de cobro». Los importes van en céntimos.
 */

export const schoolBillingQK = {
  all:            (clubId: string) => ["school-billing", clubId] as const,
  fees:           (clubId: string, filters: SchoolFeeFilters) => ["school-billing", clubId, "fees", filters] as const,
  privateClasses: (clubId: string, from: string, to: string) =>
    ["school-billing", clubId, "private-classes", from, to] as const,
  classVouchers:  (clubId: string, classId: string, studentId: string) =>
    ["school-billing", clubId, "class-vouchers", classId, studentId] as const,
};

/**
 * Refresca lo del cobro de la escuela y lo que cambia con él: la caja y lo
 * pendiente, los bonos (una sesión gastada o devuelta) y la ocupación del
 * calendario (la pista de una clase privada es un bloqueo).
 */
export function invalidateSchoolBilling(qc: QueryClient, clubId: string): void {
  void qc.invalidateQueries({ queryKey: schoolBillingQK.all(clubId) });
  void qc.invalidateQueries({ queryKey: ["club-cash", clubId] });
  void qc.invalidateQueries({ queryKey: ["club-vouchers", clubId] });
  void qc.invalidateQueries({ queryKey: ["bookings", "occupations", clubId] });
}

const base = (clubId: string) => `/admin/clubs/${clubId}/school`;

export const schoolBillingService = {
  fees: {
    list: (clubId: string, filters: SchoolFeeFilters = {}) =>
      api
        .get<SchoolFee[]>(`${base(clubId)}/fees`, { params: filters })
        .then((r) => r.data),
    /** Crea las cuotas del mes de los grupos con cuota (o solo de uno), sin duplicar. */
    generate: (clubId: string, month: string, groupId?: string) =>
      api
        .post<GenerateFeesResult>(`${base(clubId)}/fees/generate`, { month, ...(groupId ? { groupId } : {}) })
        .then((r) => r.data),
    update: (clubId: string, feeId: string, payload: { amountCents?: number; note?: string | null }) =>
      api.patch<SchoolFee>(`${base(clubId)}/fees/${feeId}`, payload).then((r) => r.data),
    pay: (clubId: string, feeId: string, paymentMethod: string) =>
      api.post<SchoolFee>(`${base(clubId)}/fees/${feeId}/pay`, { paymentMethod }).then((r) => r.data),
    unpay: (clubId: string, feeId: string) =>
      api.post<SchoolFee>(`${base(clubId)}/fees/${feeId}/unpay`).then((r) => r.data),
    /** Anula la cuota (solo sin cobrar): deja de contar como pendiente y no se vuelve a generar. */
    cancel: (clubId: string, feeId: string, note?: string) =>
      api.post<SchoolFee>(`${base(clubId)}/fees/${feeId}/cancel`, note ? { note } : {}).then((r) => r.data),
  },

  privateClasses: {
    /** Las clases entre dos días («AAAA-MM-DD», inclusive), por hora. */
    list: (clubId: string, from: string, to: string) =>
      api
        .get<SchoolPrivateClass[]>(`${base(clubId)}/private-classes`, { params: { from, to } })
        .then((r) => r.data),
    create: (clubId: string, payload: SchoolPrivateClassPayload) =>
      api.post<SchoolPrivateClass>(`${base(clubId)}/private-classes`, payload).then((r) => r.data),
    update: (clubId: string, classId: string, payload: UpdateSchoolPrivateClassPayload) =>
      api.patch<SchoolPrivateClass>(`${base(clubId)}/private-classes/${classId}`, payload).then((r) => r.data),
    /** Cancela la clase: libera la pista y devuelve a su bono las sesiones gastadas. */
    cancel: (clubId: string, classId: string, reason?: string) =>
      api
        .post<SchoolPrivateClass>(`${base(clubId)}/private-classes/${classId}/cancel`, { reason })
        .then((r) => r.data),
    /** Los bonos de clases privadas del alumno con los que se le puede cobrar. */
    vouchers: (clubId: string, classId: string, studentId: string) =>
      api
        .get<ClubVoucher[]>(`${base(clubId)}/private-classes/${classId}/students/${studentId}/vouchers`)
        .then((r) => r.data),
    pay: (clubId: string, classId: string, studentId: string, payload: PaySchoolStudentPayload) =>
      api
        .post<SchoolPrivateClass>(`${base(clubId)}/private-classes/${classId}/students/${studentId}/pay`, payload)
        .then((r) => r.data),
    unpay: (clubId: string, classId: string, studentId: string) =>
      api
        .post<SchoolPrivateClass>(`${base(clubId)}/private-classes/${classId}/students/${studentId}/unpay`)
        .then((r) => r.data),
  },

  /** La tarifa de clase privada de un entrenador (precio total de una hora); null la quita. */
  coachRate: {
    update: (clubId: string, staffId: string, privateClassRateCents: number | null) =>
      api
        .patch<SchoolCoach>(`${base(clubId)}/coaches/${staffId}`, { privateClassRateCents })
        .then((r) => r.data),
  },
};
