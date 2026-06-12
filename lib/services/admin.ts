import { api } from "@/lib/api";
import type {
  AdminStats, Tournament, AdminRegistration,
  Player, MatchResult, CreateTournamentPayload,
  FinanceStats, AdminAlert, CategoryChange, ActivityItem,
  SpaConfig, RankingType, GrowthStats, Sponsor, SponsorScope, Club,
  CreatePlayerPayload, UpdatePlayerPayload,
  AppConfigAll, AppConfigGeneral, AppConfigCircuit, AppConfigSeason,
  AppConfigEmail, AppConfigPush, AppConfigTournamentDefaults, AppConfigFaqs, AdminMember,
  SupportMessage, SupportStatus,
  Court, TournamentCourt, CourtBlock,
  AuditLogEntry,
} from "@/types";

export type ConflictType = 'MISSING_ASSIGNMENT' | 'COURT_OVERLAP' | 'PLAYER_DOUBLE_BOOKED' | 'AVAILABILITY_VIOLATION';
export interface ScheduleConflict {
  type:             ConflictType;
  matchId:          string;
  conflictMatchId?: string;
  description:      string;
}

export interface AdminUser { name: string; email: string }

export const adminService = {
  me: () =>
    api.get<AdminUser>("/auth/me").then((r) => r.data),

  stats: () =>
    api.get<AdminStats>("/admin/stats").then((r) => r.data),

  growthStats: (season?: number) =>
    api.get<GrowthStats>("/admin/stats/growth", { params: season ? { season } : {} }).then((r) => r.data),

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
    update:          (id: string, data: Partial<Tournament> | Record<string, unknown>) => api.patch<Tournament>(`/admin/tournaments/${id}`, data).then((r) => r.data),
    delete:          (id: string)                  => api.delete(`/admin/tournaments/${id}`).then((r) => r.data),
    duplicate:       (id: string, body?: { name?: string; startDate?: string; endDate?: string }) => api.post<Tournament>(`/admin/tournaments/${id}/duplicate`, body ?? {}).then((r) => r.data),
    publish:         (id: string)                  => api.patch<Tournament>(`/admin/tournaments/${id}/publish`).then((r) => r.data),
    previewBracket:  (id: string, categoryId: string, format?: string) => api.get(`/admin/tournaments/${id}/bracket/preview`, { params: { categoryId, ...(format ? { format } : {}) } }).then((r) => r.data),
    generateBracket: (id: string, categoryId: string, customGroups?: string[][], format?: string) => api.post(`/admin/tournaments/${id}/bracket/generate`, { categoryId, customGroups, ...(format !== undefined ? { format } : {}) }).then((r) => r.data),
    registrationAvailability: (regId: string) => api.get(`/admin/registrations/${regId}/availability`).then((r) => r.data),
    regenerateBracket:     (id: string, categoryId: string) => api.post(`/admin/tournaments/${id}/bracket/regenerate`, { categoryId }).then((r) => r.data),
    regenerateElimination: (id: string, categoryId: string) => api.post(`/admin/tournaments/${id}/bracket/regenerate-elimination`, { categoryId }).then((r) => r.data),
    groups:            (id: string, categoryId: string) => api.get(`/tournaments/${id}/categories/${categoryId}/groups`).then((r) => r.data ?? []),
    autoSchedule:    (id: string, force?: boolean)  => api.post<{ count: number; failures?: string[]; unscheduledPlayers?: { pair: string; phase: string; category: string }[] }>(`/admin/tournaments/${id}/auto-schedule`, { force }).then((r) => r.data),
    status:          (id: string)                   => api.get(`/admin/tournaments/${id}/status`).then((r) => r.data),
    auditLog:        (id: string, limit = 100)      => api.get<AuditLogEntry[]>(`/admin/tournaments/${id}/audit`, { params: { limit } }).then((r) => r.data),
    initBracketManual: (id: string, catId: string, numGroups?: number) =>
      api.post(`/admin/tournaments/${id}/categories/${catId}/bracket/init-manual`, numGroups !== undefined ? { numGroups } : {}).then((r) => r.data),
    updateGroupMembers: (id: string, catId: string, groupId: string, members: { userId: string; partnerId?: string | null }[]) =>
      api.patch(`/admin/tournaments/${id}/categories/${catId}/groups/${groupId}/members`, { members }).then((r) => r.data),
  },

  registrations: {
    list:         (tournamentId: string)               => api.get<any>(`/admin/tournaments/${tournamentId}/registrations`).then((r) => (r.data?.data ?? r.data ?? []) as AdminRegistration[]),
    count:        (tournamentId: string)               => api.get<{ total: number }>(`/admin/tournaments/${tournamentId}/registrations`, { params: { pageSize: 1 } }).then((r) => (r.data as any)?.total ?? 0),
    updateStatus: (registrationId: string, status: string) => api.patch(`/admin/registrations/${registrationId}/status`, { status }).then((r) => r.data),
    bulkStatus:   (ids: string[], status: string)      => api.patch("/admin/registrations/bulk-status", { ids, status }).then((r) => r.data),
    moveCategory: (registrationId: string, newCategoryId: string) => api.patch(`/admin/registrations/${registrationId}/category`, { newCategoryId }).then((r) => r.data),
  },

  categories: {
    updateRoundFormats: (tournamentId: string, categoryId: string, roundFormats: Record<string, string> | null) =>
      api.patch<{ success: boolean }>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/round-formats`, { roundFormats }).then(r => r.data),
    updatePrizes: (
      tournamentId: string,
      categoryId:   string,
      prizes: { prizeChampion?: string; prizeRunnerUp?: string; prizeConsolation?: string; hasConsolation?: boolean },
    ) =>
      api.patch(`/admin/tournaments/${tournamentId}/categories/${categoryId}/prizes`, prizes).then(r => r.data),
  },

  schedule: {
    validate:   (tournamentId: string, categoryId: string) =>
      api.get<ScheduleConflict[]>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/schedule/validate`).then(r => r.data),
    publish:    (tournamentId: string, categoryId: string, force?: boolean) =>
      api.post<{ published: boolean; conflicts: ScheduleConflict[] }>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/schedule/publish`, { force }).then(r => r.data),
    unpublish:  (tournamentId: string, categoryId: string) =>
      api.delete<{ unpublished: boolean }>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/schedule/publish`).then(r => r.data),
    patchMatch: (matchId: string, data: { date?: string; court?: string; force?: boolean }) =>
      api.patch<{ match: any; conflicts: ScheduleConflict[] }>(`/admin/matches/${matchId}/schedule`, data).then(r => r.data),
  },

  matches: {
    list: (tournamentId: string, params?: { categoryId?: string; phase?: string; status?: string; page?: number; pageSize?: number }) => {
      const query = new URLSearchParams();
      if (params?.categoryId) query.set('categoryId', params.categoryId);
      if (params?.phase)      query.set('phase',      params.phase);
      if (params?.status)     query.set('status',     params.status);
      if (params?.page)       query.set('page',       String(params.page));
      if (params?.pageSize)   query.set('pageSize',   String(params.pageSize));
      const qs = query.toString();
      return api.get<any>(`/admin/tournaments/${tournamentId}/matches${qs ? `?${qs}` : ''}`).then((r) => {
        const items: any[] = r.data?.data ?? r.data ?? [];
        return items.map((m: any): MatchResult => ({
          ...m,
          categoryId: m.categoryId ?? m.category?.id,
          group:    m.group?.name ?? m.groupName ?? null,
          team1:    m.team1  ?? m.players?.filter((p: any) => p.team === 1).map((p: any) => p.user?.name ?? p.userId) ?? [],
          team2:    m.team2  ?? m.players?.filter((p: any) => p.team === 2).map((p: any) => p.user?.name ?? p.userId) ?? [],
          sets1:    m.sets1  ?? m.sets?.map((s: any) => s.score1) ?? [],
          sets2:    m.sets2  ?? m.sets?.map((s: any) => s.score2) ?? [],
          isResult: m.isResult ?? m.status === "FINISHED",
          winner:   m.winner ?? (m.players?.find((p: any) => p.isWinner && p.team === 1) ? "team1" : m.players?.find((p: any) => p.isWinner && p.team === 2) ? "team2" : undefined),
          phase:    m.phase,
          status:   m.status,
          scoringFormat: m.category?.scoringFormat ?? m.scoringFormat ?? "BEST_OF_3",
        }));
      });
    },
    setResult: (matchId: string, sets1: number[], sets2: number[], walkover?: boolean, walkoverWinnerTeam?: 1 | 2) =>
      api.patch<MatchResult>(`/admin/matches/${matchId}/result`, { sets1, sets2, ...(walkover ? { walkover, walkoverWinnerTeam } : {}) }).then((r) => r.data),
  },

  players: {
    list: (params?: { gender?: string; level?: string; page?: number; pageSize?: number; q?: string; sortBy?: string; sortDir?: string }) =>
      api.get<{ data: any[]; total: number; page: number; pageSize: number }>(
        "/admin/players",
        { params: { pageSize: 50, ...params } },
      ).then((r) => {
        const raw = r.data ?? { data: [], total: 0, page: 1, pageSize: 50 };
        return {
          data: (raw.data ?? []).map((u: any): Player => ({
            ...u,
            level: u.level ?? "4a",
            spa: u.spa ?? undefined,
          })),
          total:    raw.total,
          page:     raw.page,
          pageSize: raw.pageSize,
        };
      }),
    search:          (q: string)                   => api.get<Player[]>("/players/search", { params: { q } }).then((r) => r.data ?? []),
    detail: (id: string): Promise<Player> =>
      api.get<Player>(`/admin/players/${id}`).then((r) => {
        const d = r.data as any;
        if (!d) return d;
        return {
          ...d,
          name:  d.name ?? `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim(),
          level: d.level ?? d.spaLevel ?? "4a",
          spa:   d.spa ?? (d.spaPoints != null ? {
            spaPoints:      Math.round(Number(d.spaPoints)),
            spaLevel:       d.spaLevel ?? "iniciacion",
            spaProgression: Number(d.spaProgression ?? 0),
            spaReliability: Number(d.spaReliability ?? 0),
            spaMatches:     d.spaMatches ?? 0,
            isCalibrating:  (d.spaMatches ?? 0) < 20,
          } : undefined),
        } as Player;
      }),
    changeLevel:     (id: string, level: string, reason: string) => api.patch(`/admin/players/${id}/category`, { level, reason }).then((r) => r.data),
    categoryHistory: (id: string) => api.get<CategoryChange[]>(`/admin/players/${id}/category-history`).then((r) => r.data ?? []).catch((e) => { console.error("[admin] categoryHistory:", e); return [] as CategoryChange[]; }),
    create:       (data: CreatePlayerPayload)            => api.post<{ id: string; name: string; email: string | null }>("/admin/players", data).then((r) => r.data),
    update:       (id: string, data: UpdatePlayerPayload) => api.patch(`/admin/players/${id}/profile`, data).then((r) => r.data),
    delete:       (id: string)                            => api.delete(`/admin/players/${id}`).then((r) => r.data),
    resendInvite: (id: string)                            => api.post(`/admin/players/${id}/resend-invite`).then((r) => r.data),
  },

  finance: {
    stats: (period: "month" | "year") => api.get<FinanceStats>("/admin/stats/finance", { params: { period } }).then((r) => r.data),
  },

  spa: {
    config:      ()                        => api.get<SpaConfig>("/admin/spa/config").then((r) => r.data),
    updateConfig:(data: Partial<SpaConfig>)=> api.put<SpaConfig>("/admin/spa/config", data).then((r) => r.data),
    recalculate: ()                        => api.post("/admin/spa/recalculate").then((r) => r.data),
  },

  upload: {
    tournamentImage: (file: File) => {
      const form = new FormData();
      form.append("image", file);
      return api.post<{ imageUrl: string }>("/admin/upload/tournament", form, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
    sponsorImage: (file: File) => {
      const form = new FormData();
      form.append("image", file);
      return api.post<{ imageUrl: string }>("/admin/upload/sponsor-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      }).then((r) => r.data);
    },
  },

  clubs: {
    list:       (includeInactive?: boolean) =>
      api.get<Club[]>("/admin/clubs", { params: includeInactive ? { includeInactive: true } : {} }).then((r) => r.data ?? []),
    listPublic: () =>
      api.get<Club[]>("/clubs").then((r) => r.data ?? []),
    create:     (data: Omit<Club, "id" | "active" | "tournamentCount">) =>
      api.post<Club>("/admin/clubs", data).then((r) => r.data),
    update:     (id: string, data: Partial<Omit<Club, "id" | "tournamentCount">>) =>
      api.patch<Club>(`/admin/clubs/${id}`, data).then((r) => r.data),
    deactivate:   (id: string) =>
      api.delete(`/admin/clubs/${id}`).then((r) => r.data),
    geocodeBatch: () =>
      api.post<{ updated: number; skipped: number; errors: string[] }>('/admin/clubs/geocode-batch').then((r) => r.data),
  },

  courts: {
    list:   (clubId: string) =>
      api.get<Court[]>(`/admin/clubs/${clubId}/courts`).then((r) => r.data ?? []),
    create: (clubId: string, data: { name: string; isIndoor?: boolean; isCentral?: boolean }) =>
      api.post<Court>(`/admin/clubs/${clubId}/courts`, data).then((r) => r.data),
    update: (clubId: string, courtId: string, data: Partial<{ name: string; isIndoor: boolean; isCentral: boolean }>) =>
      api.patch<Court>(`/admin/clubs/${clubId}/courts/${courtId}`, data).then((r) => r.data),
    remove: (clubId: string, courtId: string) =>
      api.delete(`/admin/clubs/${clubId}/courts/${courtId}`).then((r) => r.data),
    blocks: {
      list:   (clubId: string, courtId: string) =>
        api.get<CourtBlock[]>(`/admin/clubs/${clubId}/courts/${courtId}/blocks`).then((r) => r.data ?? []),
      create: (clubId: string, courtId: string, data: { startDate: string; endDate: string; startTime?: string; endTime?: string; reason?: string }) =>
        api.post<CourtBlock>(`/admin/clubs/${clubId}/courts/${courtId}/blocks`, data).then((r) => r.data),
      remove: (clubId: string, courtId: string, blockId: string) =>
        api.delete(`/admin/clubs/${clubId}/courts/${courtId}/blocks/${blockId}`).then((r) => r.data),
    },
  },

  tournamentCourts: {
    list: (tournamentId: string) =>
      api.get<TournamentCourt[]>(`/admin/tournaments/${tournamentId}/courts`).then((r) => r.data ?? []),
  },

  sponsors: {
    list:    (scope?: SponsorScope, tournamentId?: string) =>
      api.get<Sponsor[]>("/admin/sponsors", { params: { ...(scope ? { scope } : {}), ...(tournamentId ? { tournamentId } : {}) } }).then((r) => r.data ?? []),
    create:  (data: Omit<Sponsor, "id" | "createdAt" | "tournament" | "clickCount">) =>
      api.post<Sponsor>("/admin/sponsors", data).then((r) => r.data),
    update:  (id: string, data: Partial<Omit<Sponsor, "id" | "createdAt" | "tournament" | "clickCount">>) =>
      api.patch<Sponsor>(`/admin/sponsors/${id}`, data).then((r) => r.data),
    delete:  (id: string) =>
      api.delete(`/admin/sponsors/${id}`).then((r) => r.data),
    reorder: (ids: string[]) =>
      api.post("/admin/sponsors/reorder", { ids }).then((r) => r.data),
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
            spaLevel:       u.spa?.spaLevel ?? u.spaLevel ?? "iniciacion",
            spaProgression: Number(u.spaProgression ?? u.spa?.spaProgression ?? 0),
            spaReliability: Number(u.spaReliability ?? 0),
            spaMatches:     u.spaMatches ?? 0,
            isCalibrating:  (u.spaMatches ?? 0) < 20,
          } : undefined,
        }))
      ),
    recalculate: () => api.post("/admin/rankings/recalculate").then((r) => r.data),
  },

  config: {
    getAll:           ()                                                  => api.get<AppConfigAll>("/admin/config").then((r) => r.data),
    getSection:       (section: string)                                   => api.get(`/admin/config/${section}`).then((r) => r.data),
    updateGeneral:    (data: Partial<AppConfigGeneral>)                   => api.put("/admin/config/general", data).then((r) => r.data),
    updateCircuit:    (data: Partial<AppConfigCircuit>)                   => api.put("/admin/config/circuit", data).then((r) => r.data),
    updateSeason:     (data: Partial<AppConfigSeason>)                    => api.put("/admin/config/season", data).then((r) => r.data),
    updateEmail:      (data: Partial<AppConfigEmail>)                     => api.put("/admin/config/email", data).then((r) => r.data),
    updatePush:       (data: Partial<AppConfigPush>)                      => api.put("/admin/config/push", data).then((r) => r.data),
    updateTournamentDefaults: (data: Partial<AppConfigTournamentDefaults>) => api.put("/admin/config/tournamentDefaults", data).then((r) => r.data),
    updateFaqs:       (data: AppConfigFaqs)                               => api.put("/admin/config/faqs", data).then((r) => r.data),
    closeSeason:      ()                                                  => api.post<{ previousSeason: number; newSeason: number }>("/admin/config/season/close").then((r) => r.data),
    advanceSeason:    ()                                                  => api.post<{ newSeason: number }>("/admin/config/season/advance").then((r) => r.data),
  },

  admins: {
    list:       ()                                                        => api.get<AdminMember[]>("/admin/admins").then((r) => r.data ?? []),
    invite:     (data: { email: string; firstName: string; lastName: string; role?: "ADMIN" | "SUPERADMIN" }) =>
      api.post<AdminMember>("/admin/admins/invite", data).then((r) => r.data),
    updateRole: (id: string, role: "ADMIN" | "SUPERADMIN")               => api.patch(`/admin/admins/${id}/role`, { role }).then((r) => r.data),
    revoke:     (id: string)                                              => api.delete(`/admin/admins/${id}`).then((r) => r.data),
  },

  support: {
    list:         (status?: SupportStatus)  => api.get<SupportMessage[]>("/admin/support", { params: status ? { status } : {} }).then((r) => r.data ?? []),
    updateStatus: (id: string, status: SupportStatus) => api.patch(`/admin/support/${id}/status`, { status }).then((r) => r.data),
  },
};
