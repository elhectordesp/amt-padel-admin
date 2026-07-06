/**
 * bookingsService — wrapper de los endpoints del módulo Reservas (Sprint 1).
 *
 * Espejo del backend NestJS `BookingsModule`. Cada subsección agrupa por
 * la entidad/feature.
 *
 * Patrón heredado de adminService: funciones puras que devuelven Promises.
 * Errores se propagan; el caller los maneja con try/catch o React Query.
 */

import { api } from "@/lib/api";
import type {
  ActivationState,
  Booking,
  BookingExtra,
  BookingFiltersQuery,
  ClubBookingConfig,
  ClubOperatingHours,
  ClubRulesResponse,
  ClubScheduleException,
  ClubTesterUser,
  CourtAvailableDuration,
  CourtPriceSlot,
  CreateBookingExtraPayload,
  CreateScheduleExceptionPayload,
  PaginatedBookings,
  AddTesterUserPayload,
  ReplaceCourtDurationsPayload,
  ReplaceCourtPricingPayload,
  ReplaceOperatingHoursPayload,
  UpdateBookingConfigPayload,
  UpdateBookingExtraPayload,
  UpdateClubRulesPayload,
  UpdateScheduleExceptionPayload,
} from "@/types/bookings";

const base = (clubId: string) => `/admin/clubs/${clubId}/booking-config`;

export const bookingsService = {
  // ── Operating hours ────────────────────────────────────────────────────

  operatingHours: {
    list: (clubId: string) =>
      api
        .get<ClubOperatingHours[]>(`${base(clubId)}/operating-hours`)
        .then((r) => r.data),

    replace: (clubId: string, payload: ReplaceOperatingHoursPayload) =>
      api
        .put<ClubOperatingHours[]>(`${base(clubId)}/operating-hours`, payload)
        .then((r) => r.data),
  },

  // ── Schedule exceptions ────────────────────────────────────────────────

  exceptions: {
    list: (clubId: string, params?: { fromDate?: string; toDate?: string }) =>
      api
        .get<ClubScheduleException[]>(`${base(clubId)}/exceptions`, { params })
        .then((r) => r.data),

    create: (clubId: string, payload: CreateScheduleExceptionPayload) =>
      api
        .post<ClubScheduleException>(`${base(clubId)}/exceptions`, payload)
        .then((r) => r.data),

    update: (
      clubId: string,
      exceptionId: string,
      payload: UpdateScheduleExceptionPayload,
    ) =>
      api
        .patch<ClubScheduleException>(
          `${base(clubId)}/exceptions/${exceptionId}`,
          payload,
        )
        .then((r) => r.data),

    remove: (clubId: string, exceptionId: string) =>
      api
        .delete(`${base(clubId)}/exceptions/${exceptionId}`)
        .then(() => undefined),
  },

  // ── Booking config ─────────────────────────────────────────────────────

  config: {
    get: (clubId: string) =>
      api.get<ClubBookingConfig>(`${base(clubId)}`).then((r) => r.data),

    update: (clubId: string, payload: UpdateBookingConfigPayload) =>
      api.put<ClubBookingConfig>(`${base(clubId)}`, payload).then((r) => r.data),
  },

  // ── Club rules ─────────────────────────────────────────────────────────

  rules: {
    get: (clubId: string) =>
      api
        .get<ClubRulesResponse>(`${base(clubId)}/rules`)
        .then((r) => r.data),

    update: (clubId: string, payload: UpdateClubRulesPayload) =>
      api
        .put<ClubRulesResponse>(`${base(clubId)}/rules`, payload)
        .then((r) => r.data),
  },

  // ── Court durations + pricing ──────────────────────────────────────────

  courtDurations: {
    list: (clubId: string, courtId: string) =>
      api
        .get<CourtAvailableDuration[]>(
          `${base(clubId)}/courts/${courtId}/durations`,
        )
        .then((r) => r.data),

    replace: (
      clubId: string,
      courtId: string,
      payload: ReplaceCourtDurationsPayload,
    ) =>
      api
        .put<CourtAvailableDuration[]>(
          `${base(clubId)}/courts/${courtId}/durations`,
          payload,
        )
        .then((r) => r.data),
  },

  courtPricing: {
    list: (clubId: string, courtId: string) =>
      api
        .get<CourtPriceSlot[]>(`${base(clubId)}/courts/${courtId}/pricing`)
        .then((r) => r.data),

    replace: (
      clubId: string,
      courtId: string,
      payload: ReplaceCourtPricingPayload,
    ) =>
      api
        .put<CourtPriceSlot[]>(
          `${base(clubId)}/courts/${courtId}/pricing`,
          payload,
        )
        .then((r) => r.data),
  },

  // ── Extras ─────────────────────────────────────────────────────────────

  extras: {
    list: (clubId: string, onlyActive = false) =>
      api
        .get<BookingExtra[]>(`${base(clubId)}/extras`, {
          params: onlyActive ? { onlyActive: "true" } : undefined,
        })
        .then((r) => r.data),

    create: (clubId: string, payload: CreateBookingExtraPayload) =>
      api
        .post<BookingExtra>(`${base(clubId)}/extras`, payload)
        .then((r) => r.data),

    update: (
      clubId: string,
      extraId: string,
      payload: UpdateBookingExtraPayload,
    ) =>
      api
        .patch<BookingExtra>(`${base(clubId)}/extras/${extraId}`, payload)
        .then((r) => r.data),

    deactivate: (clubId: string, extraId: string) =>
      api.delete(`${base(clubId)}/extras/${extraId}`).then(() => undefined),
  },

  // ── Activation + testers ───────────────────────────────────────────────

  activation: {
    state: (clubId: string) =>
      api
        .get<ActivationState>(`${base(clubId)}/activation`)
        .then((r) => r.data),

    request: (clubId: string) =>
      api
        .post<{ notifiedAdminCount: number }>(
          `${base(clubId)}/activation/request`,
        )
        .then((r) => r.data),

    approve: (clubId: string) =>
      api.post(`${base(clubId)}/activation/approve`).then((r) => r.data),

    publish: (clubId: string) =>
      api.post(`${base(clubId)}/activation/publish`).then((r) => r.data),

    deactivate: (clubId: string) =>
      api.post(`${base(clubId)}/activation/deactivate`).then((r) => r.data),
  },

  testers: {
    list: (clubId: string, includeExpired = false) =>
      api
        .get<ClubTesterUser[]>(`${base(clubId)}/testers`, {
          params: includeExpired ? { includeExpired: "true" } : undefined,
        })
        .then((r) => r.data),

    add: (clubId: string, payload: AddTesterUserPayload) =>
      api
        .post<ClubTesterUser>(`${base(clubId)}/testers`, payload)
        .then((r) => r.data),

    remove: (clubId: string, testerId: string) =>
      api
        .delete(`${base(clubId)}/testers/${testerId}`)
        .then(() => undefined),
  },

  // ── Bookings (lista + acciones admin) ──────────────────────────────────

  bookings: {
    list: (filters: BookingFiltersQuery = {}) =>
      api
        .get<PaginatedBookings>(`/bookings`, { params: filters })
        .then((r) => r.data),

    detail: (id: string) =>
      api.get<Booking>(`/bookings/${id}`).then((r) => r.data),

    cancel: (id: string, reason?: string) =>
      api
        .delete<Booking>(`/bookings/${id}`, { data: { reason } })
        .then((r) => r.data),
  },
};

// ── React Query keys ─────────────────────────────────────────────────────

export const bookingsQK = {
  operatingHours: (clubId: string) =>
    ["bookings", "operatingHours", clubId] as const,
  exceptions: (clubId: string, fromDate?: string, toDate?: string) =>
    ["bookings", "exceptions", clubId, fromDate ?? "", toDate ?? ""] as const,
  config: (clubId: string) => ["bookings", "config", clubId] as const,
  rules: (clubId: string) => ["bookings", "rules", clubId] as const,
  courtDurations: (clubId: string, courtId: string) =>
    ["bookings", "courtDurations", clubId, courtId] as const,
  courtPricing: (clubId: string, courtId: string) =>
    ["bookings", "courtPricing", clubId, courtId] as const,
  extras: (clubId: string, onlyActive: boolean) =>
    ["bookings", "extras", clubId, onlyActive] as const,
  activation: (clubId: string) => ["bookings", "activation", clubId] as const,
  testers: (clubId: string, includeExpired: boolean) =>
    ["bookings", "testers", clubId, includeExpired] as const,
  bookingsList: (filters: BookingFiltersQuery) =>
    ["bookings", "list", JSON.stringify(filters)] as const,
  bookingDetail: (id: string) => ["bookings", "detail", id] as const,
};
