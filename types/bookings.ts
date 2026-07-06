/**
 * Tipos del módulo Reservas (Sprint 1) — admin web.
 *
 * Espejo de los modelos Prisma del backend (no incluye relaciones cuando
 * no las necesitamos en admin).
 */

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
  | "CASH_AT_VENUE"
  | "ONLINE"
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
}

export interface ClubBookingConfig {
  id: string;
  clubId: string;
  cancellationWindowHours: number;
  minBookingAheadMinutes: number;
  maxBookingAheadDays: number;
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

export interface ActivationState {
  bookingEnabled: boolean;
  bookingPublicAt: string | null;
  status: ClubActivationStatus;
  activeTesterCount: number;
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
  paymentMethod: BookingPaymentMethod;
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
}

export interface UpdateScheduleExceptionPayload {
  isClosed?: boolean;
  customOpen?: string | null;
  customClose?: string | null;
  reason?: string | null;
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
}

export interface ReplaceCourtPricingPayload {
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

export interface BookingFiltersQuery {
  clubId?: string;
  courtId?: string;
  userId?: string;
  statuses?: BookingStatus[];
  matchMode?: BookingMatchMode;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedBookings {
  items: Booking[];
  total: number;
}
