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
  BookingPaymentMethod,
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
  AvailabilityQuery,
  AvailableSlot,
  CreateBookingPayload,
  ReplaceCourtDurationsPayload,
  ReplaceCourtPricingPayload,
  ReplaceOperatingHoursPayload,
  UpdateBookingConfigPayload,
  UpdateBookingExtraPayload,
  UpdateClubRulesPayload,
  UpdateScheduleExceptionPayload,
} from "@/types/bookings";

const base = (clubId: string) => `/admin/clubs/${clubId}/booking-config`;

/** Lo más que devuelve el back en una página de GET /bookings. */
const BOOKINGS_PAGE_SIZE = 100;

function listBookings(filters: BookingFiltersQuery = {}) {
  return api
    .get<PaginatedBookings>(`/bookings`, {
      params: filters,
      // Los estados, como claves repetidas (statuses=A&statuses=B): el back
      // (Express 5) no entiende «statuses[]=A», el formato por defecto de
      // axios, y el filtro se perdía
      paramsSerializer: { indexes: null },
    })
    .then((r) => r.data);
}

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
    list: listBookings,

    /**
     * Todas las reservas del filtro, página a página: el back no da más de
     * 100 por petición (pedir 200 devolvía 100 sin avisar).
     */
    listAll: async (
      filters: Omit<BookingFiltersQuery, "limit" | "offset">,
    ): Promise<Booking[]> => {
      const byId = new Map<string, Booking>();
      for (let offset = 0; ; offset += BOOKINGS_PAGE_SIZE) {
        const page = await listBookings({ ...filters, limit: BOOKINGS_PAGE_SIZE, offset });
        for (const b of page.items) byId.set(b.id, b);
        if (page.items.length < BOOKINGS_PAGE_SIZE || offset + BOOKINGS_PAGE_SIZE >= page.total) {
          return [...byId.values()];
        }
      }
    },

    detail: (id: string) =>
      api.get<Booking>(`/bookings/${id}`).then((r) => r.data),

    create: (payload: CreateBookingPayload) =>
      api.post<Booking>(`/bookings`, payload).then((r) => r.data),

    cancel: (id: string, reason?: string) =>
      api
        .delete<Booking>(`/bookings/${id}`, { data: { reason } })
        .then((r) => r.data),

    /** Registrar/marcar pago offline (efectivo/manual). method=PENDING revierte. */
    markPaid: (
      id: string,
      payload: {
        method: BookingPaymentMethod;
        amountCents?: number;
        notes?: string;
      },
    ) =>
      api
        .patch<Booking>(`/bookings/${id}/payment`, payload)
        .then((r) => r.data),
  },

  // ── Availability (público) ─────────────────────────────────────────────

  availability: (params: AvailabilityQuery) =>
    api
      .get<AvailableSlot[]>(`/availability`, { params })
      .then((r) => r.data),
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
  /** Las de `listAll` (todas las páginas). Bajo «list»: se refresca con las listas. */
  bookingsAll: (filters: BookingFiltersQuery) =>
    ["bookings", "list", "all", JSON.stringify(filters)] as const,
  bookingDetail: (id: string) => ["bookings", "detail", id] as const,
  availability: (clubId: string, courtId: string, date: string, duration: number) =>
    ["bookings", "availability", clubId, courtId, date, duration] as const,
};
