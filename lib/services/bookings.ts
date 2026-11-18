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
  BookingPriceChange,
  CancelManyResult,
  RescheduleOptions,
  UpdateBookingPayload,
  BookingResult,
  ClubBookingConfig,
  ClubOperatingHours,
  ClubRulesResponse,
  ClubScheduleException,
  SavedScheduleException,
  ClubSeason,
  ClubSeasonPayload,
  ClubPriceOffer,
  ClubPriceOfferPayload,
  ClubTesterUser,
  CourtAvailableDuration,
  CourtPriceSlot,
  ReplaceClubPriceSlotsPayload,
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
  ResultEntryPayload,
  UpdateBookingConfigPayload,
  UpdateBookingExtraPayload,
  UpdateClubRulesPayload,
  UpdateScheduleExceptionPayload,
} from "@/types/bookings";
import type { CourtOccupation } from "@/types";

const base = (clubId: string) => `/admin/clubs/${clubId}/booking-config`;

/** Lo más que devuelve el back en una página de GET /bookings. */
const BOOKINGS_PAGE_SIZE = 100;

/** Lo más que cancela el back en una petición de «cancelar varias». */
const CANCEL_MANY_MAX = 100;

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
        .post<SavedScheduleException>(`${base(clubId)}/exceptions`, payload)
        .then((r) => r.data),

    update: (
      clubId: string,
      exceptionId: string,
      payload: UpdateScheduleExceptionPayload,
    ) =>
      api
        .patch<SavedScheduleException>(
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
    /** Sin temporada, los precios base; con ella, solo los de esa temporada. */
    list: (clubId: string, courtId: string, seasonId?: string | null) =>
      api
        .get<CourtPriceSlot[]>(`${base(clubId)}/courts/${courtId}/pricing`, {
          params: seasonId ? { seasonId } : undefined,
        })
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

    /** Mismos precios para varias pistas, en una transacción. */
    replaceMany: (clubId: string, payload: ReplaceClubPriceSlotsPayload) =>
      api
        .put<{ courtId: string; slots: CourtPriceSlot[] }[]>(
          `/admin/clubs/${clubId}/price-slots`,
          payload,
        )
        .then((r) => r.data),
  },

  // ── Temporadas de precios ───────────────────────────────────────────────

  seasons: {
    list: (clubId: string) =>
      api.get<ClubSeason[]>(`/admin/clubs/${clubId}/seasons`).then((r) => r.data),

    create: (clubId: string, payload: ClubSeasonPayload) =>
      api
        .post<ClubSeason>(`/admin/clubs/${clubId}/seasons`, payload)
        .then((r) => r.data),

    update: (clubId: string, seasonId: string, payload: Partial<ClubSeasonPayload>) =>
      api
        .patch<ClubSeason>(`/admin/clubs/${clubId}/seasons/${seasonId}`, payload)
        .then((r) => r.data),

    /** Borra también los precios de la temporada. */
    remove: (clubId: string, seasonId: string) =>
      api.delete(`/admin/clubs/${clubId}/seasons/${seasonId}`).then(() => undefined),
  },

  // ── Ofertas de precio ───────────────────────────────────────────────────

  priceOffers: {
    list: (clubId: string) =>
      api.get<ClubPriceOffer[]>(`/admin/clubs/${clubId}/price-offers`).then((r) => r.data),

    create: (clubId: string, payload: ClubPriceOfferPayload) =>
      api
        .post<ClubPriceOffer>(`/admin/clubs/${clubId}/price-offers`, payload)
        .then((r) => r.data),

    update: (clubId: string, offerId: string, payload: Partial<ClubPriceOfferPayload>) =>
      api
        .patch<ClubPriceOffer>(`/admin/clubs/${clubId}/price-offers/${offerId}`, payload)
        .then((r) => r.data),

    remove: (clubId: string, offerId: string) =>
      api.delete(`/admin/clubs/${clubId}/price-offers/${offerId}`).then(() => undefined),
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

    /** Cambia la reserva de hora, pista o duración; avisa a los jugadores. */
    update: (id: string, payload: UpdateBookingPayload) =>
      api
        .patch<{ booking: Booking; price: BookingPriceChange }>(`/bookings/${id}`, payload)
        .then((r) => r.data),

    /** Huecos libres de un día para esta reserva (el suyo cuenta como libre), con su precio. */
    rescheduleOptions: (id: string, params: { date: string; durationMinutes?: number }) =>
      api
        .get<RescheduleOptions>(`/bookings/${id}/reschedule-options`, { params })
        .then((r) => r.data),

    /**
     * Cancela varias: el back admite 100 por petición, así que de 100 en 100.
     * Cada una va por su cuenta; las que no se pueden vuelven con su código.
     */
    cancelMany: async (ids: string[], reason?: string): Promise<CancelManyResult> => {
      const result: CancelManyResult = { cancelled: [], failed: [] };
      for (let i = 0; i < ids.length; i += CANCEL_MANY_MAX) {
        const part = await api
          .post<CancelManyResult>(`/bookings/cancel-many`, {
            ids: ids.slice(i, i + CANCEL_MANY_MAX),
            reason,
          })
          .then((r) => r.data);
        result.cancelled.push(...part.cancelled);
        result.failed.push(...part.failed);
      }
      return result;
    },

    /**
     * El club pone o corrige el resultado (hasta 30 días después del partido).
     * Queda firme: los jugadores ya no lo cambian.
     */
    setResult: (id: string, payload: ResultEntryPayload) =>
      api
        .put<BookingResult>(`/bookings/${id}/result`, payload)
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

  // ── Ocupación de las pistas (calendario) ───────────────────────────────

  /** Bloqueos y partidos de torneo que ocupan las pistas del club en `[from, to)` (ISO). */
  occupations: {
    list: (clubId: string, params: { from: string; to: string }) =>
      api
        .get<{ occupations: CourtOccupation[] }>(`/admin/clubs/${clubId}/occupations`, { params })
        .then((r) => r.data?.occupations ?? []),
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
  courtPricing: (clubId: string, courtId: string, seasonId?: string | null) =>
    ["bookings", "courtPricing", clubId, courtId, seasonId ?? "base"] as const,
  seasons: (clubId: string) => ["bookings", "seasons", clubId] as const,
  priceOffers: (clubId: string) => ["bookings", "priceOffers", clubId] as const,
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
  occupations: (clubId: string, from: string, to: string) =>
    ["bookings", "occupations", clubId, from, to] as const,
  availability: (clubId: string, courtId: string, date: string, duration: number) =>
    ["bookings", "availability", clubId, courtId, date, duration] as const,
};
