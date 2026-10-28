import { api } from "@/lib/api";

/** Lo que cabe entero en la notificación del móvil (lo valida también el back). */
export const MESSAGE_TITLE_MAX = 30;
export const MESSAGE_BODY_MAX  = 145;

/** Un envío del historial del torneo. */
export interface TournamentMessage {
  id:              string;
  title:           string;
  body:            string;
  /** Las categorías a las que se mandó (las borradas después no salen). */
  categories:      { id: string; gender: string; level: string }[];
  includeWaitlist: boolean;
  recipientCount:  number;
  sentBy:          { id: string; name: string };
  /** ISO 8601 */
  createdAt:       string;
}

export interface TournamentMessagesList {
  dailyLimit:     number;
  sentToday:      number;
  remainingToday: number;
  messages:       TournamentMessage[];
}

export interface SendTournamentMessage {
  title:           string;
  body:            string;
  categoryIds:     string[];
  includeWaitlist: boolean;
}

export interface SentTournamentMessage {
  id:             string;
  recipientCount: number;
  createdAt:      string;
  remainingToday: number;
}

/** Claves de React Query del historial y del recuento de destinatarios. */
export const tournamentMessagesQK = {
  list:       (tournamentId: string) => ["tournament-messages", tournamentId] as const,
  recipients: (tournamentId: string, categoryIds: string[], includeWaitlist: boolean) =>
    ["tournament-messages", tournamentId, "recipients", [...categoryIds].sort(), includeWaitlist] as const,
};

/** Mensajes a mano a los inscritos de un torneo (push + aviso en la app). */
export const tournamentMessagesService = {
  list: (tournamentId: string) =>
    api.get<TournamentMessagesList>(`/admin/tournaments/${tournamentId}/messages`).then((r) => r.data),
  recipients: (tournamentId: string, categoryIds: string[], includeWaitlist: boolean) =>
    api
      .get<{ recipients: number }>(`/admin/tournaments/${tournamentId}/messages/recipients`, {
        params: { categoryIds: categoryIds.join(","), includeWaitlist: String(includeWaitlist) },
      })
      .then((r) => r.data),
  send: (tournamentId: string, data: SendTournamentMessage) =>
    api.post<SentTournamentMessage>(`/admin/tournaments/${tournamentId}/messages`, data).then((r) => r.data),
};
