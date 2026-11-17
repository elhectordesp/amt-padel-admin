import { api } from "@/lib/api";

/** Lo que admite el back (también lo valida él). */
export const CLUB_MESSAGE_TITLE_MAX = 80;
export const CLUB_MESSAGE_BODY_MAX  = 1000;
/** Clientes a los que llega un mensaje como mucho. */
export const CLUB_MESSAGE_MAX_RECIPIENTS = 2000;

/** A quién se manda: todos los filtros que se den, a la vez. Sin filtros, a todos. */
export interface ClubMessageSegment {
  members?:      boolean;
  tags?:         string[];
  levels?:       string[];
  inactiveDays?: number;
}

export interface ClubMessagePreview {
  recipients: number;
  withPush:   number;
  withEmail:  number;
}

/** Un envío del historial del club. */
export interface ClubMessage {
  id:               string;
  title:            string;
  body:             string;
  sendPush:         boolean;
  sendEmail:        boolean;
  segment:          ClubMessageSegment;
  recipientCount:   number;
  pushCount:        number;
  emailCount:       number;
  emailFailedCount: number;
  sentBy:           { id: string; name: string };
  /** ISO 8601 */
  createdAt:        string;
}

export interface ClubMessagesPage {
  items:    ClubMessage[];
  total:    number;
  page:     number;
  pageSize: number;
}

export interface SendClubMessagePayload {
  title:     string;
  body:      string;
  sendPush:  boolean;
  sendEmail: boolean;
  segment:   ClubMessageSegment;
}

export interface SentClubMessage {
  id:             string;
  recipientCount: number;
  pushCount:      number;
  emailsQueued:   number;
  createdAt:      string;
}

export const clubMessagesQK = {
  all:  (clubId: string) => ["club-messages", clubId] as const,
  list: (clubId: string, page: number) => ["club-messages", clubId, "list", page] as const,
};

const base = (clubId: string) => `/admin/clubs/${clubId}/messages`;

/** Mensajes del club a un grupo de sus clientes (push, aviso en la app y email). */
export const clubMessagesService = {
  list: (clubId: string, page: number) =>
    api.get<ClubMessagesPage>(base(clubId), { params: { page } }).then((r) => r.data),
  preview: (clubId: string, segment: ClubMessageSegment) =>
    api.post<ClubMessagePreview>(`${base(clubId)}/preview`, { segment }).then((r) => r.data),
  send: (clubId: string, data: SendClubMessagePayload) =>
    api.post<SentClubMessage>(base(clubId), data).then((r) => r.data),
};
