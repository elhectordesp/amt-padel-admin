/**
 * Avisos del equipo del club (la campana de la cabecera): lo que hacen los
 * jugadores en el club (reservas e inscripciones). Espejo de
 * `ClubNoticesController` del back, en /admin/clubs/:clubId/notices.
 */

import { api } from "@/lib/api";

/** Los tipos que manda el back (`CLUB_NOTICE_TYPE`). */
export type ClubNoticeType =
  | "club_booking_created"
  | "club_booking_cancelled"
  | "club_registration_created"
  | "club_registration_cancelled";

export interface ClubNotice {
  id: string;
  type: ClubNoticeType | string;
  title: string;
  body: string;
  /** A dónde lleva: `bookingId` o `tournamentId` (más `categoryId`, `shortCode`…). */
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface ClubNoticesPage {
  items: ClubNotice[];
  /** Las no leídas en total (no solo las de esta página). */
  unread: number;
}

const base = (clubId: string) => `/admin/clubs/${clubId}/notices`;

export const clubNoticesService = {
  list: (clubId: string, page = 1) =>
    api.get<ClubNoticesPage>(base(clubId), { params: { page } }).then((r) => r.data),

  /** Sin `ids`, todas las no leídas. */
  markRead: (clubId: string, ids?: string[]) =>
    api.post<{ updated: number }>(`${base(clubId)}/read`, ids ? { ids } : {}).then((r) => r.data),
};

export const clubNoticesQK = {
  list: (clubId: string) => ["club-notices", clubId] as const,
};
