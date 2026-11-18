/**
 * Tipos del módulo Reservas (Sprint 1) — admin web.
 *
 * Espejo de los modelos Prisma del backend (no incluye relaciones cuando
 * no las necesitamos en admin).
 */

import type { CounterPaymentMethod } from "@/lib/utils/payment-methods";

export type CourtType = "SINGLES" | "DOUBLES";
export type WallType = "GLASS" | "WALL";

export type ClubBookingPlan = "FREE" | "SUBSCRIPTION" | "COMMISSION" | "CUSTOM";

export type BookingType = "FREE" | "CLASS" | "EVENT";
export type BookingMatchMode =
  | "INDIVIDUAL"
  | "PRIVATE_AMT"
  | "PRIVATE_WITH_GUESTS"
  | "OPEN"
  | "ADMIN_MANUAL";
export type BookingStatus =
  | "PENDING_INVITES"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "WITHOUT_RESULT";
export type BookingPaymentMethod =
  | "PENDING"
  | "CASH"
  | "CARD"
  | "BIZUM"
  | "TRANSFER"
  | "OTHER"
  | "ONLINE"
  // Pagada con una sesión de un bono del club: solo la pone el uso del bono
  | "VOUCHER"
  // Solo reservas antiguas
  | "CASH_AT_VENUE"
  | "PAID_MANUAL";
export type BookingParticipantStatus =
  | "INVITED"
  | "ACCEPTED"
  | "DECLINED"
  | "AUTO_ACCEPTED"
  | "REMOVED";

export type ClubActivationStatus = "INACTIVE" | "TESTER_MODE" | "PUBLIC";

// ── Config club-level ──────────────────────────────────────────────────────

export interface ClubOperatingHours {
  id: string;
  clubId: string;
  dayOfWeek: number; // 1=lunes...7=domingo (ISO)
  openTime: string;  // "HH:mm"
  closeTime: string;
  active: boolean;
}

export interface ClubScheduleException {
  id: string;
  clubId: string;
  date: string; // "YYYY-MM-DD"
  isClosed: boolean;
  customOpen: string | null;
  customClose: string | null;
  reason: string | null;
  /** Festivo que se cobra como ese día de la semana (1=lunes … 7=domingo). */
  priceAsDayOfWeek: number | null;
}

/** Una clase de la escuela (de grupo o privada) que una excepción de horario deja fuera de él. */
export interface AffectedSchoolClass {
  kind: "GROUP" | "PRIVATE";
  id: string;
  /** El grupo, o «Clase privada». */
  name: string;
  startsAt: string;
  endsAt: string;
}

/** Lo que devuelve el back al crear o editar una excepción: la excepción y las clases que se quedan fuera de horario (no se cancelan solas). */
export interface SavedScheduleException extends ClubScheduleException {
  affectedSchoolClasses: AffectedSchoolClass[];
}

export interface ClubBookingConfig {
  id: string;
  clubId: string;
  cancellationWindowHours: number;
  minBookingAheadMinutes: number;
  maxBookingAheadDays: number;
  strictModeEnabled: boolean;
  strictFrom: string | null; // "HH:mm", hora local del club
  strictTo: string | null;
  advanceRuleEnabled: boolean;
  advanceRuleFrom: string | null;
  advanceRuleTo: string | null;
  advanceRuleMinutes: number;
  openMatchEnabled: boolean;
  openMatchMinPlayers: number;
  openMatchAdminWarnHoursBefore: number;
  openMatchAutoCancelHoursBefore: number;
  resultEntryWindowDays: number;
  resultMaxExtensions: number;
  autoAcceptThreshold: number;
  allowGuestPlayers: boolean;
  welcomeMessageMarkdown: string | null;
  notifyAdminViaPush: boolean;
  notifyAdminViaEmail: boolean;
  /** Descuento (%) para los clientes socios; 0 = sin descuento. */
  memberDiscountPercent: number;
}

export interface ClubRulesResponse {
  rulesMarkdown: string | null;
  version: string | null;
}

// ── Court-level ────────────────────────────────────────────────────────────

export interface CourtAvailableDuration {
  id: string;
  courtId: string;
  minutes: number;
  isDefault: boolean;
}

export interface CourtPriceSlot {
  id: string;
  courtId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCents: number;
  label?: string | null;
  /** null = precio base de todo el año. */
  seasonId?: string | null;
}

export interface ClubSeason {
  id: string;
  clubId: string;
  name: string;
  startDate: string; // ISO; se lee como día de calendario
  endDate: string;
}

export interface ClubPriceOffer {
  id: string;
  clubId: string;
  name: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[]; // 1=lunes … 7=domingo
  startTime: string;
  endTime: string;
  /** Vacío = todas las pistas. */
  courtIds: string[];
  discountPercent: number;
  membersOnly: boolean;
}

export interface ClubSeasonPayload {
  name: string;
  startDate: string;
  endDate: string;
}

export interface ClubPriceOfferPayload {
  name: string;
  startDate: string;
  endDate: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  courtIds: string[];
  discountPercent: number;
  membersOnly: boolean;
}

export interface BookingExtra {
  id: string;
  clubId: string;
  name: string;
  description: string | null;
  priceCents: number;
  mandatory: boolean;
  autoApplyAfterSunset: boolean;
  active: boolean;
  displayOrder: number;
  createdAt: string;
}

// ── Activation + testers ───────────────────────────────────────────────────

export type ActivationCheckCode =
  | "COURTS"
  | "OPERATING_HOURS"
  | "COURT_DURATIONS"
  | "COURT_PRICES";

export interface ActivationCheck {
  code: ActivationCheckCode;
  ok: boolean;
  /** Lo que falta, listo para enseñar: pistas sin duraciones o duraciones sin precio. */
  missing: string[];
}

/** Lo que falta para que, al activarse, haya huecos que reservar. */
export interface ActivationReadiness {
  ready: boolean;
  checks: ActivationCheck[];
}

export interface ActivationState {
  bookingEnabled: boolean;
  bookingPublicAt: string | null;
  /** Cuándo pidió el club la activación; null si no hay solicitud pendiente. */
  bookingActivationRequestedAt: string | null;
  status: ClubActivationStatus;
  activeTesterCount: number;
  /** Solo con el módulo inactivo; null en los demás estados. */
  readiness: ActivationReadiness | null;
}

export interface ClubTesterUser {
  id: string;
  clubId: string;
  userId: string;
  validUntil: string;
  addedAt: string;
  addedByUserId: string | null;
  user?: { id: string; name: string; email: string | null };
}

// ── Bookings ───────────────────────────────────────────────────────────────

export interface BookingParticipant {
  id: string;
  bookingId: string;
  userId: string | null;
  guestName: string | null;
  isCreator: boolean;
  status: BookingParticipantStatus;
  invitedAt: string;
  respondedAt: string | null;
  user?: { id: string; name: string; email: string | null };
  /**
   * Equipo con el que puntúa el partido (solo en el detalle): en los
   * jugadores con cuenta aceptados cuando son justo 2 o 4; si no, null.
   * No viene con un back anterior.
   */
  team?: 1 | 2 | null;
}

/** Resultado de una reserva («Home» = equipo 1). */
export interface BookingResult {
  set1Home: number;
  set1Away: number;
  set2Home: number;
  set2Away: number;
  set3Home: number | null;
  set3Away: number | null;
  winnerTeam: 1 | 2 | null;
  enteredByUserId: string | null;
  enteredAt: string;
  /** Firme: los jugadores ya no lo cambian (lo cerró la ventana o el club). */
  finalizedAt: string | null;
  /** Ya puntuó el SPA con este resultado. */
  processedLspaAt: string | null;
}

export interface ResultEntryPayload {
  set1Home: number;
  set1Away: number;
  set2Home: number;
  set2Away: number;
  set3Home?: number;
  set3Away?: number;
}

export interface Booking {
  id: string;
  shortCode: string;
  clubId: string;
  courtId: string;
  creatorUserId: string;
  type: BookingType;
  matchMode: BookingMatchMode;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  priceCents: number;
  priceBreakdown: {
    slot: number;
    extras: { id: string; name: string; cents: number }[];
  };
  status: BookingStatus;
  // null: no consta (el back borra los datos de cobro a los 6 años)
  paymentMethod: BookingPaymentMethod | null;
  paidAt: string | null;
  paidAmountCents: number | null;
  paymentNotes: string | null;
  refundedAt: string | null;
  refundAmountCents: number | null;
  amtCommissionCents: number | null;
  clubPayoutCents: number | null;
  cancellationFeeChargedCents: number | null;
  openMatchMinLspa: number | null;
  openMatchMaxLspa: number | null;
  openMatchSlotsRemaining: number | null;
  isCompetitive: boolean;
  competitiveLockedAt: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  notes: string | null;
  rulesAcceptedAt: string | null;
  rulesVersion: string | null;
  reminder24hSentAt: string | null;
  reminder2hSentAt: string | null;
  recurringGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  court?: { id: string; name: string; type: CourtType; isIndoor: boolean };
  club?: { id: string; name: string; city: string };
  participants?: BookingParticipant[];
  // El cliente del club a quien se reservó (null: sin cliente). Un bono solo
  // paga reservas de su dueño
  clubCustomerId?: string | null;
  // Solo en el listado del personal del club: el titular (el cliente del club
  // y quien la apuntó). No vienen con un back anterior
  clubCustomer?: { id: string; name: string | null; phone: string | null } | null;
  creator?: { id: string; name: string | null };
  // Solo en el detalle (GET /bookings/:id). No vienen con un back anterior
  result?: BookingResult | null;
  /** Hasta cuándo meten o cambian el resultado los jugadores. */
  resultEntryDeadlineAt?: string | null;
  /** Hasta cuándo lo puede poner o corregir el club (fin del partido + 30 días). */
  resultAdminDeadlineAt?: string | null;
}

// ── DTOs de input ──────────────────────────────────────────────────────────

export interface OperatingHourInput {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  active?: boolean;
}

export interface ReplaceOperatingHoursPayload {
  hours: OperatingHourInput[];
}

export interface CreateScheduleExceptionPayload {
  date: string;
  isClosed?: boolean;
  customOpen?: string;
  customClose?: string;
  reason?: string;
  priceAsDayOfWeek?: number;
}

export interface UpdateScheduleExceptionPayload {
  isClosed?: boolean;
  customOpen?: string | null;
  customClose?: string | null;
  reason?: string | null;
  /** null lo quita. */
  priceAsDayOfWeek?: number | null;
}

export type UpdateBookingConfigPayload = Partial<
  Omit<ClubBookingConfig, "id" | "clubId">
>;

export interface UpdateClubRulesPayload {
  rulesMarkdown?: string | null;
}

export interface CourtDurationInput {
  minutes: number;
  isDefault?: boolean;
}

export interface ReplaceCourtDurationsPayload {
  durations: CourtDurationInput[];
}

export interface PriceSlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  priceCents: number;
  /** Nombre de la franja («Valle», «Punta»), máx. 40 caracteres. */
  label?: string;
}

export interface ReplaceCourtPricingPayload {
  /** Sin ella, los precios base. */
  seasonId?: string;
  slots: PriceSlotInput[];
}

export interface ReplaceClubPriceSlotsPayload {
  courtIds: string[];
  /** Sin ella, los precios base. */
  seasonId?: string;
  slots: PriceSlotInput[];
}

export interface CreateBookingExtraPayload {
  name: string;
  description?: string;
  priceCents: number;
  mandatory?: boolean;
  autoApplyAfterSunset?: boolean;
  displayOrder?: number;
  active?: boolean;
}

export type UpdateBookingExtraPayload = Partial<CreateBookingExtraPayload>;

export interface AddTesterUserPayload {
  userId: string;
  validUntil?: string;
}

export interface CreateBookingPayload {
  courtId: string;
  matchMode: BookingMatchMode;
  startsAt: string; // ISO UTC
  durationMinutes: number;
  participants?: { userId?: string; guestName?: string }[];
  isCompetitive?: boolean;
  openMatchMinLspa?: number;
  openMatchMaxLspa?: number;
  notes?: string;
  /** Cliente del club a quien se reserva (solo el personal del club). */
  clubCustomerId?: string;
  /** Cobrada en el mostrador: nace cobrada, en la misma operación (solo el personal del club). */
  payNow?: { method: CounterPaymentMethod; amountCents?: number };
}

export interface AvailabilityQuery {
  clubId: string;
  date: string; // "YYYY-MM-DD"
  duration?: number;
  courtType?: CourtType;
  indoor?: boolean;
}

export interface AvailableSlot {
  courtId: string;
  courtName: string;
  courtType: string;
  isIndoor: boolean;
  startsAt: string; // ISO UTC
  endsAt: string;
  startsAtLocal: string; // "HH:mm" local del club
  durationMinutes: number;
  /** Precio final (con el descuento). */
  priceCents: number;
  /** Precio sin descuento. */
  basePriceCents: number;
  /** «-20 % Mañanas de agosto»; null si no hay descuento. */
  discountLabel: string | null;
  priceBreakdown: {
    slot: number;
    extras: { id: string; name: string; cents: number }[];
  };
}

export interface BookingFiltersQuery {
  clubId?: string;
  courtId?: string;
  userId?: string;
  statuses?: BookingStatus[];
  matchMode?: BookingMatchMode;
  /** "true": solo las que se deben (sin cobrar, con importe, no canceladas). */
  unpaid?: "true";
  fromDate?: string;
  toDate?: string;
  /** Por hora de inicio; el back, por defecto «desc» (las más lejanas primero). */
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
  /** Nombre o email de quien está en la reserva (titular, participantes e invitados). */
  q?: string;
}

export interface PaginatedBookings {
  items: Booking[];
  total: number;
}

/** Cambio de hora, pista o duración de una reserva (PATCH /bookings/:id). */
export interface UpdateBookingPayload {
  courtId: string;
  startsAt: string; // ISO UTC
  durationMinutes: number;
}

export interface BookingPriceChange {
  previousCents: number;
  newCents: number;
  /** newCents - previousCents (negativo: sale más barata). */
  differenceCents: number;
  /** Estaba pagada: el precio se mantiene. */
  kept: boolean;
}

export interface RescheduleSlot {
  courtId: string;
  courtName: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string; // "HH:mm" del club
  durationMinutes: number;
  /** Lo que costaría la reserva en este hueco, con sus mismos extras. */
  priceCents: number;
  differenceCents: number;
}

export interface RescheduleOptions {
  currentPriceCents: number;
  priceKept: boolean;
  durations: number[];
  slots: RescheduleSlot[];
}

export interface CancelManyResult {
  cancelled: string[];
  failed: { id: string; code: string }[];
}
