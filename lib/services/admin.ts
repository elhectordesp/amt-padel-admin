import { api } from "@/lib/api";
import type {
  AdminStats, Tournament, AdminRegistration,
  Player, MatchResult, CreateTournamentPayload,
} from "@/types";

export const adminService = {
  stats: () =>
    api.get<AdminStats>("/admin/stats").then((r) => r.data),

  tournaments: {
    list:   ()           => api.get<Tournament[]>("/tournaments").then((r) => r.data),
    detail: (id: string) => api.get<Tournament>(`/tournaments/${id}`).then((r) => r.data),
    create: (data: CreateTournamentPayload) =>
      api.post<Tournament>("/admin/tournaments", data).then((r) => r.data),
    update: (id: string, data: Partial<Tournament>) =>
      api.patch<Tournament>(`/admin/tournaments/${id}`, data).then((r) => r.data),
    publish: (id: string) =>
      api.patch<Tournament>(`/admin/tournaments/${id}/publish`).then((r) => r.data),
  },

  registrations: {
    list: (tournamentId: string) =>
      api.get<AdminRegistration[]>(`/admin/tournaments/${tournamentId}/registrations`)
        .then((r) => r.data),
    updateStatus: (registrationId: string, status: string) =>
      api.patch(`/admin/registrations/${registrationId}/status`, { status })
        .then((r) => r.data),
  },

  matches: {
    list:      (tournamentId: string) =>
      api.get<MatchResult[]>(`/admin/tournaments/${tournamentId}/matches`).then((r) => r.data),
    setResult: (matchId: string, sets1: number[], sets2: number[]) =>
      api.patch<MatchResult>(`/admin/matches/${matchId}/result`, { sets1, sets2 })
        .then((r) => r.data),
  },

  players: {
    list:         (params?: { q?: string; gender?: string; level?: string }) =>
      api.get<Player[]>("/ranking", { params: { gender: "M", ...params } })
        .then((r) => r.data),
    search:       (q: string) =>
      api.get<Player[]>("/players/search", { params: { q } }).then((r) => r.data),
    detail:       (id: string) =>
      api.get<Player>(`/players/${id}`).then((r) => r.data),
    changeLevel:  (id: string, level: string, reason: string) =>
      api.patch(`/admin/players/${id}/category`, { level, reason }).then((r) => r.data),
  },

  rankings: {
    list:        (gender: string) =>
      api.get<Player[]>("/ranking", { params: { gender } }).then((r) => r.data),
    recalculate: () =>
      api.post("/admin/rankings/recalculate").then((r) => r.data),
  },
};
