import { api } from "@/lib/api";
import type {
  AdminStats, Tournament, AdminRegistration,
  Player, MatchResult, CreateTournamentPayload,
  FinanceStats, AdminAlert, CategoryChange, ActivityItem,
  SpaConfig, RankingType,
} from "@/types";

export interface AdminUser { name: string; email: string }

function spaPointsToLevel(pts: number): string {
  if (pts >= 858) return "1a";
  if (pts >= 715) return "2a";
  if (pts >= 572) return "3a";
  if (pts >= 429) return "4a";
  if (pts >= 286) return "5a";
  if (pts >= 143) return "6a";
  return "iniciacion";
}

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
    list: () =>
      api.get<Tournament[]>("/admin/tournaments").then((r) =>
        (r.data ?? []).map((t) => ({ ...t, status: t.status?.toUpperCase() as Tournament["status"] }))
      ),
    detail: (id: string) =>
      api.get<Tournament>(`/tournaments/${id}`).then((r) =>
        r.data ? { ...r.data, status: r.data.status?.toUpperCase() as Tournament["status"] } : r.data
      ),
    adminDetail: (id: string) =>
      api.get<Tournament>(`/admin/tournaments/${id}`).then((r) =>
        r.data ? { ...r.data, status: r.data.status?.toUpperCase() as Tournament["status"] } : r.data
      ),
    create:          (data: CreateTournamentPayload) => api.post<Tournament>("/admin/tournaments", data).then((r) => r.data),
    update:          (id: string, data: Partial<Tournament>) => api.patch<Tournament>(`/admin/tournaments/${id}`, data).then((r) => r.data),
    delete:          (id: string)                  => api.delete(`/admin/tournaments/${id}`).then((r) => r.data),
    duplicate:       (id: string)                  => api.post<Tournament>(`/admin/tournaments/${id}/duplicate`).then((r) => r.data),
    publish:         (id: string)                  => api.patch<Tournament>(`/admin/tournaments/${id}/publish`).then((r) => r.data),
    previewBracket:  (id: string, categoryId: string) => api.get(`/admin/tournaments/${id}/bracket/preview`, { params: { categoryId } }).then((r) => r.data),
    generateBracket:   (id: string, categoryId: string, customGroups?: string[][]) => api.post(`/admin/tournaments/${id}/bracket/generate`, { categoryId, customGroups }).then((r) => r.data),
    registrationAvailability: (regId: string) => api.get(`/admin/registrations/${regId}/availability`).then((r) => r.data),
    regenerateBracket:     (id: string, categoryId: string) => api.post(`/admin/tournaments/${id}/bracket/regenerate`, { categoryId }).then((r) => r.data),
    regenerateElimination: (id: string, categoryId: string) => api.post(`/admin/tournaments/${id}/bracket/regenerate-elimination`, { categoryId }).then((r) => r.data),
    groups:            (id: string, categoryId: string) => api.get(`/tournaments/${id}/categories/${categoryId}/groups`).then((r) => r.data ?? []),
    autoSchedule:    (id: string, force?: boolean)  => api.post<{ count: number }>(`/admin/tournaments/${id}/auto-schedule`, { force }).then((r) => r.data),
  },

  registrations: {
    list:         (tournamentId: string)               => api.get<AdminRegistration[]>(`/admin/tournaments/${tournamentId}/registrations`).then((r) => r.data ?? []),
    updateStatus: (registrationId: string, status: string) => api.patch(`/admin/registrations/${registrationId}/status`, { status }).then((r) => r.data),
    bulkStatus:   (ids: string[], status: string)      => api.patch("/admin/registrations/bulk-status", { ids, status }).then((r) => r.data),
  },

  matches: {
    list: (tournamentId: string) =>
      api.get<any[]>(`/admin/tournaments/${tournamentId}/matches`).then((r) =>
        (r.data ?? []).map((m: any): MatchResult => ({
          ...m,
          categoryId: m.categoryId ?? m.category?.id,
          group:    m.group?.name ?? m.groupName ?? null,
          team1:    m.team1  ?? m.players?.filter((p: any) => p.team === 1).map((p: any) => p.user?.name ?? p.userId) ?? [],
          team2:    m.team2  ?? m.players?.filter((p: any) => p.team === 2).map((p: any) => p.user?.name ?? p.userId) ?? [],
          sets1:    m.sets1  ?? m.sets?.map((s: any) => s.score1) ?? [],
          sets2:    m.sets2  ?? m.sets?.map((s: any) => s.score2) ?? [],
          isResult: m.isResult ?? m.status === "FINISHED" ?? (m.sets?.length > 0),
          winner:   m.winner ?? (m.players?.find((p: any) => p.isWinner && p.team === 1) ? "team1" : m.players?.find((p: any) => p.isWinner && p.team === 2) ? "team2" : undefined),
          phase:    m.phase,
          status:   m.status,
          scoringFormat: m.category?.scoringFormat ?? m.scoringFormat ?? "BEST_OF_3",
        }))
      ),
    setResult: (matchId: string, sets1: number[], sets2: number[]) => api.patch<MatchResult>(`/admin/matches/${matchId}/result`, { sets1, sets2 }).then((r) => r.data),
  },

  players: {
    list: (params?: { gender?: string; level?: string }) =>
      api.get<any[]>("/ranking", { params: { limit: 200, ...params } }).then((r) =>
        (r.data ?? []).map((u: any): Player => ({
          ...u,
          level: u.level ?? u.categoryLevel ?? "4a",
          spa: u.spaPoints != null ? {
            spaPoints:      Math.round(Number(u.spaPoints)),
            spaLevel:       spaPointsToLevel(Number(u.spaPoints)),
            spaProgression: Number(u.spaProgression ?? 0),
            spaReliability: Number(u.spaReliability ?? 0),
            spaMatches:     u.spaMatches ?? 0,
            isCalibrating:  (u.spaMatches ?? 0) < 20,
          } : undefined,
        }))
      ),
    search:          (q: string)                   => api.get<Player[]>("/players/search", { params: { q } }).then((r) => r.data ?? []),
    detail: (id: string) =>
      api.get<any>(`/admin/players/${id}`).then((r) => {
        const d = r.data;
        if (!d) return d;
        return {
          ...d,
          name:  d.name ?? `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim(),
          level: d.level ?? d.categoryLevel ?? d.spaLevel ?? "4a",
          spa:   d.spa ?? (d.spaPoints != null ? {
            spaPoints:      Math.round(Number(d.spaPoints)),
            spaLevel:       spaPointsToLevel(Number(d.spaPoints)),
            spaProgression: Number(d.spaProgression ?? 0),
            spaReliability: Number(d.spaReliability ?? 0),
            spaMatches:     d.spaMatches ?? 0,
            isCalibrating:  (d.spaMatches ?? 0) < 20,
          } : undefined),
        } as Player;
      }),
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
    list: (gender: string, type: RankingType = "circuit", season?: number, level?: string) =>
      api.get<any[]>("/ranking", {
        params: {
          gender, type, limit: 500,
          ...(season ? { season } : {}),
          ...(level  ? { level  } : {}),
        },
      }).then((r) =>
        (r.data ?? []).map((u: any): Player => ({
          ...u,
          level:        u.level ?? u.categoryLevel ?? "4a",
          points:       u.points ?? u.circuitPoints ?? u.spaPoints ?? 0,
          wins:         u.wins   ?? 0,
          played:       u.played ?? 0,
          trend:        u.trend  ?? "stable",
          globalRank:   u.globalRank,
          categoryRank: u.categoryRank,
          spa: u.spaPoints != null ? {
            spaPoints:      Math.round(Number(u.spaPoints)),
            spaLevel:       spaPointsToLevel(Number(u.spaPoints)),
            spaProgression: Number(u.spaProgression ?? 0),
            spaReliability: Number(u.spaReliability ?? 0),
            spaMatches:     u.spaMatches ?? 0,
            isCalibrating:  (u.spaMatches ?? 0) < 20,
          } : undefined,
        }))
      ),
    recalculate: () => api.post("/admin/rankings/recalculate").then((r) => r.data),
  },
};
