import { api } from "@/lib/api";
import type {
  AdminStats, Tournament, AdminRegistration,
  Player, MatchResult, CreateTournamentPayload,
  FinanceStats, AdminAlert, CategoryChange, ActivityItem,
  SpaConfig, RankingType,
} from "@/types";

export interface AdminUser { name: string; email: string }

export const adminService = {
  me: () =>
    api.get<AdminUser>("/users/me").then((r) => r.data),

  stats: () =>
    api.get<AdminStats>("/admin/stats").then((r) => r.data),

  alerts: () =>
    api.get<AdminAlert[]>("/admin/alerts").then((r) => r.data).catch((e) => { console.error("[admin] alerts:", e); return [] as AdminAlert[]; }),

  activity: () =>
    api.get<ActivityItem[]>("/admin/activity").then((r) => r.data).catch((e) => { console.error("[admin] activity:", e); return [] as ActivityItem[]; }),

  tournaments: {
    list:            ()                             => api.get<Tournament[]>("/tournaments").then((r) => r.data ?? []),
    detail:          (id: string)                  => api.get<Tournament>(`/tournaments/${id}`).then((r) => r.data),
    create:          (data: CreateTournamentPayload) => api.post<Tournament>("/admin/tournaments", data).then((r) => r.data),
    update:          (id: string, data: Partial<Tournament>) => api.patch<Tournament>(`/admin/tournaments/${id}`, data).then((r) => r.data),
    delete:          (id: string)                  => api.delete(`/admin/tournaments/${id}`).then((r) => r.data),
    duplicate:       (id: string)                  => api.post<Tournament>(`/admin/tournaments/${id}/duplicate`).then((r) => r.data),
    publish:         (id: string)                  => api.patch<Tournament>(`/admin/tournaments/${id}/publish`).then((r) => r.data),
    previewBracket:  (id: string, categoryId: string) => api.get(`/admin/tournaments/${id}/bracket/preview`, { params: { categoryId } }).then((r) => r.data),
    generateBracket: (id: string, categoryId: string, customGroups?: string[][]) => api.post(`/admin/tournaments/${id}/bracket/generate`, { categoryId, customGroups }).then((r) => r.data),
    autoSchedule:    (id: string)                  => api.post<{ count: number }>(`/admin/tournaments/${id}/auto-schedule`).then((r) => r.data),
  },

  registrations: {
    list:         (tournamentId: string)               => api.get<AdminRegistration[]>(`/admin/tournaments/${tournamentId}/registrations`).then((r) => r.data ?? []),
    updateStatus: (registrationId: string, status: string) => api.patch(`/admin/registrations/${registrationId}/status`, { status }).then((r) => r.data),
    bulkStatus:   (ids: string[], status: string)      => api.patch("/admin/registrations/bulk-status", { ids, status }).then((r) => r.data),
  },

  matches: {
    list:      (tournamentId: string)                     => api.get<MatchResult[]>(`/admin/tournaments/${tournamentId}/matches`).then((r) => r.data ?? []),
    setResult: (matchId: string, sets1: number[], sets2: number[]) => api.patch<MatchResult>(`/admin/matches/${matchId}/result`, { sets1, sets2 }).then((r) => r.data),
  },

  players: {
    list:            (params?: { gender?: string; level?: string }) => api.get<Player[]>("/ranking", { params: { gender: "M", ...params } }).then((r) => r.data ?? []),
    search:          (q: string)                   => api.get<Player[]>("/players/search", { params: { q } }).then((r) => r.data ?? []),
    detail:          (id: string)                  => api.get<Player>(`/players/${id}`).then((r) => r.data),
    changeLevel:     (id: string, level: string, reason: string) => api.patch(`/admin/players/${id}/category`, { level, reason }).then((r) => r.data),
    categoryHistory: (id: string)                  => api.get<CategoryChange[]>(`/admin/players/${id}/category-history`).then((r) => r.data ?? []).catch((e) => { console.error("[admin] categoryHistory:", e); return [] as CategoryChange[]; }),
  },

  finance: {
    stats: (period: "month" | "year") => api.get<FinanceStats>("/admin/stats/finance", { params: { period } }).then((r) => r.data),
  },

  spa: {
    config:      ()                        => api.get<SpaConfig>("/admin/spa/config").then((r) => r.data),
    updateConfig:(data: Partial<SpaConfig>)=> api.put<SpaConfig>("/admin/spa/config", data).then((r) => r.data),
    recalculate: ()                        => api.post("/admin/spa/recalculate").then((r) => r.data),
  },

  rankings: {
    list:        (gender: string, type: RankingType = "circuit", season?: number) =>
      api.get<Player[]>("/ranking", { params: { gender, type, ...(season ? { season } : {}) } }).then((r) => r.data ?? []),
    recalculate: () => api.post("/admin/rankings/recalculate").then((r) => r.data),
  },
};
