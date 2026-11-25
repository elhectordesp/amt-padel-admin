/**
 * Cobro de la escuela del club: las cuotas mensuales de los grupos y las
 * clases privadas, con lo que paga cada alumno. Los tipos de lo que devuelve
 * /admin/clubs/:clubId/school/fees y .../private-classes. Los importes van en
 * céntimos; los instantes, ISO; los meses, «AAAA-MM» en la zona del club.
 */

/**
 * Cómo está una cuota: sin pagar (dentro de plazo o atrasada), con una parte
 * pagada, pagada entera o anulada. «Atrasada» gana sobre «parcial». «Archivada»:
 * de hace más de 6 años, sin datos de cobro; solo se consulta.
 */
export type SchoolFeeStatus = "PENDING" | "PARTIAL" | "OVERDUE" | "PAID" | "CANCELLED" | "ARCHIVED";

/**
 * Por qué el sistema anuló una cuota al cambiar el alumno en el grupo: baja,
 * baja temporal o pasar a pagar con bono. null: la anuló una persona.
 */
export type SchoolFeeCancelReason = "LEFT" | "PAUSED" | "VOUCHER";

/** Un pago (o parte de un cobro) de una cuota. */
export interface SchoolFeePayment {
  id:               string;
  /** Agrupa los pagos de un mismo cobro (que pudo tocar varias cuotas). */
  collectionId:     string;
  amountCents:      number;
  paymentMethod:    string;
  /** BIZUM: el socio a cuyo móvil llegó; null: la cuenta del club. */
  bizumPartnerName: string | null;
  paidAt:           string;
  paidByName:       string;
}

export interface SchoolFee {
  id:             string;
  groupId:        string;
  groupName:      string;
  clubCustomerId: string;
  customerName:   string | null;
  /** AAAA-MM */
  month:          string;
  /** Lo que hay que pagar: la cuota del grupo, prorrateada y con el descuento. */
  amountCents:    number;
  /** La cuota del grupo entera al generarla; null en las anteriores a la fase 2. */
  listCents:      number | null;
  /** El descuento aplicado, en céntimos; null si no hay. */
  discountCents:  number | null;
  /** «7 de 8 clases» si se prorrateó. */
  prorationNote:  string | null;
  paidCents:      number;
  pendingCents:   number;
  status:         SchoolFeeStatus;
  /** AAAA-MM-DD: el día límite de pago. */
  dueDate:        string;
  /** Resumen de cuando está pagada entera: el método (MIXED si hay varios); null: sin pagar entera. */
  paymentMethod:  string | null;
  paidAt:         string | null;
  cancelledAt:    string | null;
  cancelReason:   SchoolFeeCancelReason | null;
  note:           string | null;
  createdAt:      string;
  /** Quien la generó; null: la generó el cron («Automática»). */
  createdByName:  string | null;
  payments:       SchoolFeePayment[];
}

/** Qué ha pasado al cobrar de golpe las cuotas pendientes de un mes. */
export interface PayPendingFeesResult {
  /** Cuántas cuotas se han cobrado. */
  paid:       number;
  /** Su total, en céntimos. */
  totalCents: number;
}

/** Qué ha pasado al generar las cuotas de un mes. */
export interface GenerateFeesResult {
  month:    string;
  /** Grupos con cuota, sin archivar y con temporada en el mes. */
  groups:   number;
  /** Cuotas que tocaban (un alumno por grupo): sin quien paga con bono o está de baja. */
  due:      number;
  created:  number;
  /** Las que ya estaban (pendientes, cobradas o anuladas). */
  existing: number;
  /** Avisos (p. ej. grupos sin clases en el calendario). */
  warnings: string[];
}

export interface SchoolFeeFilters {
  month?:          string;
  status?:         SchoolFeeStatus;
  groupId?:        string;
  clubCustomerId?: string;
}

/** Cobrar a un alumno un importe, repartido entre sus cuotas con algo pendiente. */
export interface CollectFeesPayload {
  clubCustomerId: string;
  amountCents:    number;
  paymentMethod:  string;
  /** Con Bizum (módulo Cuentas): el socio a cuyo móvil llegó; null o sin él, la cuenta del club. */
  bizumPartnerId?: string | null;
  /** Solo estas cuotas; sin ellas, todas las no anuladas del alumno. */
  feeIds?:        string[];
}

/** Un alumno de una clase privada con lo que paga. */
/** Un entrenador (sin recepción ni gestión) recibe los alumnos sin precio ni cobro: los campos de dinero solo los ven quienes cobran. */
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
  // `bizumPartnerId`, solo con Bizum y el módulo Cuentas: el socio a cuyo móvil llegó, o null para «Club»
  | { paymentMethod: string; bizumPartnerId?: string | null; voucherId?: undefined }
  | { voucherId: string; paymentMethod?: undefined };
