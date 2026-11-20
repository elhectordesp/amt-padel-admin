/**
 * Cobro de la escuela del club: las cuotas mensuales de los grupos y las
 * clases privadas, con lo que paga cada alumno. Los tipos de lo que devuelve
 * /admin/clubs/:clubId/school/fees y .../private-classes. Los importes van en
 * céntimos; los instantes, ISO; los meses, «AAAA-MM» en la zona del club.
 */

/** Cómo está una cuota: sin cobrar, cobrada o anulada. */
export type SchoolFeeStatus = "pending" | "paid" | "cancelled";

export interface SchoolFee {
  id:             string;
  groupId:        string;
  groupName:      string;
  clubCustomerId: string;
  customerName:   string | null;
  /** AAAA-MM */
  month:          string;
  amountCents:    number;
  status:         SchoolFeeStatus;
  /** Método de cobro (los del mostrador); null: sin cobrar. */
  paymentMethod:  string | null;
  paidAt:         string | null;
  cancelledAt:    string | null;
  note:           string | null;
  createdAt:      string;
}

/** Qué ha pasado al generar las cuotas de un mes. */
export interface GenerateFeesResult {
  month:    string;
  /** Grupos con cuota, sin archivar y con temporada en el mes. */
  groups:   number;
  /** Cuotas que tocaban (un alumno por grupo). */
  due:      number;
  created:  number;
  /** Las que ya estaban (pendientes, cobradas o anuladas). */
  existing: number;
}

export interface SchoolFeeFilters {
  month?:   string;
  status?:  SchoolFeeStatus;
  groupId?: string;
}

/** Un alumno de una clase privada con lo que paga. */
export interface SchoolPrivateClassStudent {
  id:             string;
  clubCustomerId: string;
  name:           string | null;
  priceCents:     number;
  /** Método de cobro (los del mostrador o VOUCHER, con una sesión de bono); null: sin cobrar. */
  paymentMethod:  string | null;
  paidAt:         string | null;
  paid:           boolean;
}

export interface SchoolPrivateClass {
  id:           string;
  coachStaffId: string | null;
  coachName:    string | null;
  startsAt:     string;
  endsAt:       string;
  status:       "SCHEDULED" | "CANCELLED";
  cancelReason: string | null;
  notes:        string | null;
  /** null: la pista se borró (hay que elegir otra al moverla). */
  court:        { id: string; name: string } | null;
  students:     SchoolPrivateClassStudent[];
  totalCents:   number;
  createdAt:    string;
}

export interface SchoolPrivateClassStudentPayload {
  clubCustomerId: string;
  priceCents:     number;
}

export interface SchoolPrivateClassPayload {
  coachStaffId?:   string | null;
  courtId:         string;
  /** AAAA-MM-DD en la zona del club. */
  date:            string;
  /** HH:MM */
  startTime:       string;
  durationMinutes: number;
  students:        SchoolPrivateClassStudentPayload[];
  notes?:          string | null;
}

export type UpdateSchoolPrivateClassPayload = Partial<SchoolPrivateClassPayload>;

/** Cobrar a un alumno: con un método del mostrador o con una sesión de un bono suyo; uno de los dos. */
export type PaySchoolStudentPayload =
  | { paymentMethod: string; voucherId?: undefined }
  | { voucherId: string; paymentMethod?: undefined };
