/* eslint-disable @typescript-eslint/no-explicit-any */
import { api } from "@/lib/api";
import type {
  AdminStats, Tournament, AdminRegistration,
  Player, MatchResult, CreateTournamentPayload,
  FinanceStats, AdminAlert, CategoryChange, ActivityItem,
  SpaConfig, RankingType, GrowthStats, Sponsor, SponsorScope, Club,
  CreatePlayerPayload, UpdatePlayerPayload,
  AdminEnrollTeamPayload, AdminEnrollResult,
  AppConfigAll, AppConfigGeneral, AppConfigCircuit, AppConfigSeason,
  AppConfigEmail, AppConfigPush, AppConfigTournamentDefaults, AppConfigFaqs, AdminMember,
  SupportMessage, SupportStatus,
  Court, TournamentCourt, CourtBlock,
  AuditLogEntry, PlayerRegistrationEntry, RegistrationAvailability,
} from "@/types";
import type { QueryClient } from "@tanstack/react-query";
import type { PaymentPlayer } from "@/lib/utils/registration-pairs";
import type { AutomaticInvite } from "@/lib/player-invite";

/**
 * Claves de caché de las inscripciones de un torneo, en un solo sitio: tres
 * modales invalidaban claves que no usaba ninguna página y la lista no se
 * refrescaba (o tardaba hasta 30 s).
 */
export const registrationsQK = {
  all:  ["registrations"] as const,
  list: (tournamentId: string) => ["registrations", tournamentId] as const,
};

/**
 * Tras dar de alta, cambiar de estado o mover inscripciones: la lista y las
 * plazas del torneo (ocupadas, confirmadas, en espera), que van en el torneo
 * y con las que se genera el cuadro.
 */
export function invalidateRegistrations(qc: QueryClient, tournamentId: string): void {
  qc.invalidateQueries({ queryKey: registrationsQK.list(tournamentId) });
  qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });        // ficha del torneo
  qc.invalidateQueries({ queryKey: ["tournament-detail", tournamentId] }); // Inscripciones
  qc.invalidateQueries({ queryKey: ["admin-tournament", tournamentId] });  // Editar torneo
  qc.invalidateQueries({ queryKey: ["tournaments"] });                     // listados y alta manual
}

export type ConflictType =
  | 'MISSING_ASSIGNMENT'
  | 'COURT_OVERLAP'
  | 'PLAYER_DOUBLE_BOOKED'
  | 'AVAILABILITY_VIOLATION'
  /** No cabe en los tramos de su jornada (o ese día no hay jornada). */
  | 'OUTSIDE_SCHEDULE'
  /** Empieza antes de que acabe una ronda anterior de su categoría. */
  | 'PHASE_ORDER'
  /** Un bye (pase directo) con pista u hora: no se juega. */
  | 'BYE_SCHEDULED';
export interface ScheduleConflict {
  type:             ConflictType;
  matchId:          string;
  conflictMatchId?: string;
  description:      string;
}

/**
 * Rol de la cuenta tal como está en la BD. El del token (useRole) es 'admin'
 * tanto para ADMIN como para SUPERADMIN: para distinguirlos hay que leer este.
 */
export type AccountRole = "PLAYER" | "ADMIN" | "SUPERADMIN" | "CLUB";

/** La cuenta con la que se ha entrado (/auth/me). */
export interface AdminUser {
  id:     string;
  name:   string;
  // Opcionales: una versión anterior del back no los devuelve
  email?: string | null;
  role?:  AccountRole;
}

/**
 * Opciones avanzadas para generación/preview del cuadro (Bloque 1).
 *
 * Cuando se omiten, el backend usa el comportamiento histórico (auto-cálculo).
 * Cuando se pasan, el backend respeta los valores siempre que sean coherentes
 * entre sí (numGroups × topNPerGroup ≥ plazas de eliminationStartRound).
 */
export interface BracketGenerationOptions {
  numGroups?: number;
  /** Clasifican FIJO por grupo (base): 1-4. */
  topNPerGroup?: number;
  /** Comodines extra: nº de "mejores (base+1)os" que clasifican además de la base. */
  extraQualifiers?: number;
  eliminationStartRound?: 'R32' | 'R16' | 'QF' | 'SF' | 'F';
}

/** Tope de seguridad: 100 páginas × 200 = 20.000 filas. */
const MAX_PAGES = 100;

/**
 * Pide TODAS las páginas de un listado paginado del back ({ data, total }).
 * Pedir solo la primera dejaba los torneos grandes cortados sin avisar
 * (inscripciones a 50, partidos a 200): faltaban filas en la lista, la CSV,
 * la impresión y el editor de grupos. `pageSize` no debe pasar del máximo
 * del endpoint (el back lo recorta y las páginas se solaparían).
 */
export async function fetchAllPages<T>(
  url: string,
  params: Record<string, string | number | undefined> = {},
  pageSize = 200,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data: body } = await api.get<any>(url, { params: { ...params, page, pageSize } });
    if (Array.isArray(body)) return body as T[]; // endpoint sin paginar
    const batch: T[] = body?.data ?? [];
    items.push(...batch);
    const total: number = body?.total ?? items.length;
    if (batch.length === 0 || items.length >= total) break;
  }
  return items;
}

/** Máximo por página de /ranking. */
const RANKING_PAGE_SIZE = 500;

/**
 * Todo el ranking: /ranking devuelve una página (una lista, sin total) de
 * hasta 500 jugadores, y con una sola petición el resto no salía. Se piden
 * páginas hasta que una viene incompleta.
 */
async function fetchAllRankingPages(params: Record<string, string | number>): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await api.get<any[]>("/ranking", {
      params: { ...params, page, limit: RANKING_PAGE_SIZE },
    });
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < RANKING_PAGE_SIZE) break;
  }
  return rows;
}

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

  /** P3 — Historial de auditoría con filtros y paginación. */
  auditLogs: (filters: {
    tournamentId?: string;
    action?: string;
    adminId?: string;
    from?: string;  // ISO date
    to?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return api
      .get<{
        items: {
          id: string;
          adminId: string;
          adminName: string;
          action: string;
          actionLabel: string;
          resource: string;
          resourceId: string | null;
          entityName: string | null;
          href: string | null;
          details: unknown;
          createdAt: string;
        }[];
        total: number;
        page: number;
        pageSize: number;
        distinctActions: { value: string; label: string; count: number }[];
      }>(`/admin/audit-logs${qs ? `?${qs}` : ""}`)
      .then((r) => r.data);
  },

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
    // 30 s en vez de los 10 de siempre: con jornadas y pistas tarda más, y
    // si se corta antes el torneo se crea igual sin que el panel lo sepa
    create:          (data: CreateTournamentPayload) => api.post<Tournament>("/admin/tournaments", data, { timeout: 30_000 }).then((r) => r.data),
    update:          (id: string, data: Partial<Tournament> | Record<string, unknown>) => api.patch<Tournament>(`/admin/tournaments/${id}`, data).then((r) => r.data),
    /** Editar jornadas/tramos horarios (solo durante el montaje). Reemplaza todas las jornadas. */
    updateSchedule:  (id: string, schedule: { date: string; type?: string; isFinal?: boolean; maxUnavailableSlots?: number; blocks: { start: string; end: string }[] }[]) =>
      api.put(`/admin/tournaments/${id}/schedule`, { schedule }).then((r) => r.data),
    delete:          (id: string, force?: boolean)  => api.delete(`/admin/tournaments/${id}`, force ? { params: { force: true } } : undefined).then((r) => r.data),
    duplicate:       (id: string, body?: { name?: string; startDate?: string; endDate?: string }) => api.post<Tournament>(`/admin/tournaments/${id}/duplicate`, body ?? {}).then((r) => r.data),
    publish:         (id: string)                  => api.patch<Tournament>(`/admin/tournaments/${id}/publish`).then((r) => r.data),
    previewBracket: (
      id: string,
      categoryId: string,
      format?: string,
      options?: BracketGenerationOptions,
    ) =>
      api
        .get(`/admin/tournaments/${id}/bracket/preview`, {
          params: {
            categoryId,
            ...(format ? { format } : {}),
            ...(options?.numGroups !== undefined ? { numGroups: options.numGroups } : {}),
            ...(options?.topNPerGroup !== undefined ? { topNPerGroup: options.topNPerGroup } : {}),
            ...(options?.extraQualifiers !== undefined ? { extraQualifiers: options.extraQualifiers } : {}),
            ...(options?.eliminationStartRound
              ? { eliminationStartRound: options.eliminationStartRound }
              : {}),
          },
        })
        .then((r) => r.data),
    generateBracket: (
      id: string,
      categoryId: string,
      customGroups?: string[][],
      format?: string,
      options?: BracketGenerationOptions,
    ) =>
      api
        .post(`/admin/tournaments/${id}/bracket/generate`, {
          categoryId,
          customGroups,
          ...(format !== undefined ? { format } : {}),
          ...(options?.numGroups !== undefined ? { numGroups: options.numGroups } : {}),
          ...(options?.topNPerGroup !== undefined ? { topNPerGroup: options.topNPerGroup } : {}),
          ...(options?.extraQualifiers !== undefined ? { extraQualifiers: options.extraQualifiers } : {}),
          ...(options?.eliminationStartRound
            ? { eliminationStartRound: options.eliminationStartRound }
            : {}),
        })
        .then((r) => r.data),
    registrationAvailability: (regId: string) => api.get<RegistrationAvailability>(`/admin/registrations/${regId}/availability`).then((r) => r.data),
    updateAvailability: (regId: string, availability: { dayId: string; fullAvailability: boolean; unavailableSlots?: string[] }[]) =>
      api.patch(`/admin/registrations/${regId}/availability`, { availability }).then((r) => r.data),
    /**
     * Estado del cuadro de una categoría (Bloque 2). Usado por el dialog
     * para decidir nivel de confirmación al regenerar.
     */
    getBracketStats: (
      id: string,
      categoryId: string,
    ): Promise<{
      exists: boolean;
      totalMatches: number;
      finishedMatches: number;
      hasGroupResults: boolean;
      hasElimResults: boolean;
    }> =>
      api
        .get(`/admin/tournaments/${id}/categories/${categoryId}/bracket/stats`)
        .then((r) => r.data),
    regenerateBracket: (
      id: string,
      categoryId: string,
      options?: BracketGenerationOptions,
      // El formato elegido en el diálogo: sin él, el back rehacía el cuadro
      // con el de antes
      format?: string,
    ) =>
      api
        .post(`/admin/tournaments/${id}/bracket/regenerate`, {
          categoryId,
          ...(format !== undefined ? { format } : {}),
          ...(options?.numGroups !== undefined ? { numGroups: options.numGroups } : {}),
          ...(options?.topNPerGroup !== undefined ? { topNPerGroup: options.topNPerGroup } : {}),
          ...(options?.extraQualifiers !== undefined ? { extraQualifiers: options.extraQualifiers } : {}),
          ...(options?.eliminationStartRound
            ? { eliminationStartRound: options.eliminationStartRound }
            : {}),
        })
        .then((r) => r.data),
    regenerateElimination: (id: string, categoryId: string, opts?: { topNPerGroup?: number; extraQualifiers?: number; eliminationStartRound?: string; force?: boolean }) => api.post(`/admin/tournaments/${id}/bracket/regenerate-elimination`, { categoryId, ...(opts ?? {}) }).then((r) => r.data),
    /** Cruce MANUAL de eliminatoria (Frente 3): cada cruce = un partido de 1ª ronda; lado = {groupIdx, pos} o null=bye. */
    generateEliminationManual: (id: string, catId: string, crosses: { a: { groupIdx: number; pos: number } | null; b: { groupIdx: number; pos: number } | null }[]) =>
      api.post(`/admin/tournaments/${id}/categories/${catId}/elimination/manual`, { crosses }).then((r) => r.data),
    groups:            (id: string, categoryId: string) => api.get(`/tournaments/${id}/categories/${categoryId}/groups`).then((r) => r.data ?? []),
    autoSchedule:    (id: string, force?: boolean)  => api.post<{ count: number; failures?: string[]; unscheduledPlayers?: { pair: string; phase: string; category: string }[] }>(`/admin/tournaments/${id}/auto-schedule`, { force }).then((r) => r.data),
    status:          (id: string)                   => api.get(`/admin/tournaments/${id}/status`).then((r) => r.data),
    auditLog:        (id: string, limit = 100)      => api.get<AuditLogEntry[]>(`/admin/tournaments/${id}/audit`, { params: { limit } }).then((r) => r.data),
    /**
     * Swap parejas entre 2 matches del bracket elim (Bloque 4).
     * Backend valida que sean misma cat + phase + ninguno FINISHED.
     */
    swapMatchPair: (matchAId: string, matchBId: string, force?: boolean) =>
      api
        .post(`/admin/matches/${matchAId}/swap-pair`, { withMatchId: matchBId, ...(force ? { force: true } : {}) })
        .then((r) => r.data),

    /** Añade un grupo vacío al cuadro existente (mini-Bloque 5). */
    addEmptyGroup: (id: string, catId: string) =>
      api
        .post<{ id: string; name: string; members: never[] }>(
          `/admin/tournaments/${id}/categories/${catId}/bracket/groups`,
        )
        .then((r) => r.data),

    /** Borra un grupo vacío (mini-Bloque 5). */
    deleteGroup: (id: string, catId: string, groupId: string, force?: boolean) =>
      api
        .delete(
          `/admin/tournaments/${id}/categories/${catId}/bracket/groups/${groupId}`,
          force ? { params: { force: true } } : undefined,
        )
        .then((r) => r.data),

    /**
     * Reestructura grupos: cambia nº de grupos y redistribuye parejas (Bloque 5).
     * - assignments: opcional, mapeo "Grupo X" → registrationId[]. Si null,
     *   distribución automática (serpentine si useSeeding, random si no).
     * - force: requerido si hay partidos de grupos con resultado FINISHED.
     */
    restructureGroups: (
      id: string,
      catId: string,
      payload: {
        numGroups: number;
        assignments?: Record<string, string[]> | null;
        force?: boolean;
      },
    ) =>
      api
        .post<{
          success: boolean;
          fromNumGroups: number;
          toNumGroups: number;
          matchesCreated: number;
          hadResults: boolean;
          force: boolean;
          // H3 — schedule preservation
          slotsAvailable?: number;
          slotsPreserved?: number;
          slotsNeeded?: number;
          autoScheduled?: boolean;
          scheduleWarning?: string;
        }>(
          `/admin/tournaments/${id}/categories/${catId}/bracket/restructure-groups`,
          payload,
        )
        .then((r) => r.data),

    initBracketManual: (id: string, catId: string, numGroups?: number) =>
      api.post(`/admin/tournaments/${id}/categories/${catId}/bracket/init-manual`, numGroups !== undefined ? { numGroups } : {}).then((r) => r.data),
    updateGroupMembers: (id: string, catId: string, groupId: string, members: { userId: string; partnerId?: string | null }[], force?: boolean) =>
      api.patch(`/admin/tournaments/${id}/categories/${catId}/groups/${groupId}/members`, force ? { members, force } : { members }).then((r) => r.data),
    /** Reparto global de grupos (modo edición, atómico): reemplaza todos los grupos de una vez. */
    updateAllGroupMembers: (id: string, catId: string, groups: { groupId: string; members: { userId: string; partnerId?: string | null }[] }[], force?: boolean) =>
      api.put(`/admin/tournaments/${id}/categories/${catId}/groups/members`, force ? { groups, force } : { groups }).then((r) => r.data),
    renameGroup: (id: string, catId: string, groupId: string, name: string) =>
      api.patch(`/admin/tournaments/${id}/categories/${catId}/groups/${groupId}/name`, { name }).then((r) => r.data),
    /** Override manual de stats de una pareja en un grupo (sanciones/ajustes). */
    overrideGroupMemberStats: (id: string, catId: string, groupId: string, userId: string, stats: { played?: number; wins?: number; points?: number; setsWon?: number; setsLost?: number; gamesWon?: number; gamesLost?: number }) =>
      api.patch(`/admin/tournaments/${id}/categories/${catId}/groups/${groupId}/members/${userId}/stats`, stats).then((r) => r.data),
    /** Edición manual de partidos (Frente 2). */
    editMatchPlayers: (matchId: string, team1: { userId: string; partnerId?: string | null }, team2: { userId: string; partnerId?: string | null }, force?: boolean) =>
      api.patch(`/admin/matches/${matchId}/players`, { team1, team2, ...(force ? { force: true } : {}) }).then((r) => r.data),
    createManualMatch: (
      tournamentId: string,
      payload: { categoryId: string; groupId?: string; phase?: string; team1?: { userId: string; partnerId?: string | null }; team2?: { userId: string; partnerId?: string | null }; date?: string; court?: string },
    ) => api.post(`/admin/tournaments/${tournamentId}/matches`, payload).then((r) => r.data),
    deleteMatch: (matchId: string, force?: boolean) =>
      api.delete(`/admin/matches/${matchId}`, { params: force ? { force: true } : {} }).then((r) => r.data),
    /** Des-finalizar un partido: revierte su resultado y lo deja pendiente. */
    unfinishMatch: (matchId: string, force?: boolean) =>
      api.post(`/admin/matches/${matchId}/unfinish`, force ? { force: true } : {}).then((r) => r.data),
  },

  registrations: {
    // Todas: el back pagina (máx. 200 por página).
    list:         (tournamentId: string)               => fetchAllPages<AdminRegistration>(`/admin/tournaments/${tournamentId}/registrations`, {}, 200),
    updateStatus: (registrationId: string, status: string) => api.patch(`/admin/registrations/${registrationId}/status`, { status }).then((r) => r.data),
    /**
     * `force`: pasar a pendiente o confirmada canceladas o en espera aunque la
     * categoría esté llena o haya cola (sin él, el back responde
     * CATEGORY_FULL o CATEGORY_WAITLIST_AHEAD; ver needsForce).
     */
    bulkStatus:   (ids: string[], status: string, force?: boolean) =>
      api.patch("/admin/registrations/bulk-status", { ids, status, ...(force ? { force: true } : {}) }).then((r) => r.data),
    moveCategory: (registrationId: string, newCategoryId: string) => api.patch(`/admin/registrations/${registrationId}/category`, { newCategoryId }).then((r) => r.data),
    enroll:       (tournamentId: string, data: AdminEnrollTeamPayload) =>
      api.post<AdminEnrollResult>(`/admin/tournaments/${tournamentId}/enrollments`, data).then((r) => r.data),
    replacePartner: (registrationId: string, newPartnerId: string) =>
      api.patch(`/admin/registrations/${registrationId}/partner`, { newPartnerId }).then((r) => r.data),
    /**
     * El pago de un jugador: `player` dice de qué lado de la inscripción y
     * `playerId` quién cree el panel que está en él (si le cambiaron la
     * pareja entretanto, el back da 400 en vez de marcárselo a otro).
     */
    updatePayment: (
      registrationId: string,
      data: { paid: boolean; paymentMethod?: string; paidAt?: string; paymentNote?: string; player: PaymentPlayer; playerId: string },
    ) =>
      api.patch(`/admin/registrations/${registrationId}/payment`, data).then((r) => r.data),
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
    add: (
      tournamentId: string,
      data: { gender: "M" | "F"; level: string; totalSpots: number; price?: number; scoringFormat?: string },
    ) =>
      api.post(`/admin/tournaments/${tournamentId}/categories`, data).then(r => r.data),
    update: (
      tournamentId: string,
      categoryId:   string,
      data: { totalSpots?: number; price?: number; scoringFormat?: string; force?: boolean },
    ) =>
      api.patch(`/admin/tournaments/${tournamentId}/categories/${categoryId}`, data).then(r => r.data),
    remove: (tournamentId: string, categoryId: string, force?: boolean) =>
      api.delete(`/admin/tournaments/${tournamentId}/categories/${categoryId}`, force ? { params: { force: true } } : undefined).then(r => r.data),
  },

  schedule: {
    validate:   (tournamentId: string, categoryId: string) =>
      api.get<ScheduleConflict[]>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/schedule/validate`).then(r => r.data),
    publish:    (tournamentId: string, categoryId: string, force?: boolean) =>
      api.post<{ published: boolean; conflicts: ScheduleConflict[] }>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/schedule/publish`, { force }).then(r => r.data),
    publishAll: (tournamentId: string, force?: boolean) =>
      api.post<{ results: { categoryId: string; gender: string; level: string; published: boolean; conflicts: ScheduleConflict[] }[]; publishedCount: number; total: number }>(`/admin/tournaments/${tournamentId}/schedule/publish-all`, { force }).then(r => r.data),
    unpublish:  (tournamentId: string, categoryId: string) =>
      api.delete<{ unpublished: boolean }>(`/admin/tournaments/${tournamentId}/categories/${categoryId}/schedule/publish`).then(r => r.data),
    patchMatch: (matchId: string, data: { date?: string; court?: string; referee?: string | null; force?: boolean }) =>
      api.patch<{ match: any; conflicts: ScheduleConflict[] }>(`/admin/matches/${matchId}/schedule`, data).then(r => r.data),
  },

  matches: {
    // Todos los partidos (el back pagina, máx. 500 por página).
    list: (tournamentId: string, params?: { categoryId?: string; phase?: string; status?: string }) => {
      return fetchAllPages<any>(
        `/admin/tournaments/${tournamentId}/matches`,
        { categoryId: params?.categoryId, phase: params?.phase, status: params?.status },
        500,
      ).then((items) => {
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
          // Formato resuelto POR FASE por el backend (roundFormats override); cae al
          // formato base de la categoría si no viene. Así el hint de super-tiebreak
          // del modal respeta p.ej. "final a 3 sets" aunque la base sea super-tie.
          scoringFormat: m.effectiveScoringFormat ?? m.category?.scoringFormat ?? m.scoringFormat ?? "BEST_OF_3",
        }));
      });
    },
    setResult: (matchId: string, sets1: number[], sets2: number[], walkover?: boolean, walkoverWinnerTeam?: 1 | 2, force?: boolean) =>
      // El back espera `winnerTeam`: con `walkoverWinnerTeam` lo descartaba
      // (whitelist) y todo walkover daba 400 «Debes indicar qué equipo gana»
      api.patch<MatchResult>(`/admin/matches/${matchId}/result`, { sets1, sets2, ...(walkover ? { walkover, winnerTeam: walkoverWinnerTeam } : {}), ...(force ? { force: true } : {}) }).then((r) => r.data),
  },

  players: {
    list: (params?: { gender?: string; level?: string; page?: number; pageSize?: number; q?: string; sortBy?: string; sortDir?: string; activationStatus?: string }) =>
      api.get<{ data: any[]; total: number; page: number; pageSize: number }>(
        "/admin/players",
        { params: { pageSize: 50, ...params } },
      ).then((r) => {
        const raw = r.data ?? { data: [], total: 0, page: 1, pageSize: 50 };
        return {
          data: (raw.data ?? []).map((u: any): Player => ({
            ...u,
            // Sin categoría: null («Sin categoría»), nunca 4ª por defecto
            level: u.level ?? null,
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
          // Sin categoría: null. Ni 4ª ni el nivel SPA, que es otra cosa
          level: d.level ?? null,
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
    categoryHistory:   (id: string) => api.get<CategoryChange[]>(`/admin/players/${id}/category-history`).then((r) => r.data ?? []).catch((e) => { console.error("[admin] categoryHistory:", e); return [] as CategoryChange[]; }),
    registrations:     (id: string) => api.get<PlayerRegistrationEntry[]>(`/admin/players/${id}/registrations`).then((r) => r.data ?? []).catch(() => [] as PlayerRegistrationEntry[]),
    auditLog:          (id: string) => api.get<AuditLogEntry[]>(`/admin/players/${id}/audit`).then((r) => r.data ?? []).catch(() => [] as AuditLogEntry[]),
    // invitation: qué pasó con la invitación que sale sola (sin ella, no tocaba)
    create:       (data: CreatePlayerPayload)            => api.post<{ id: string; name: string; email: string | null; invitation?: AutomaticInvite }>("/admin/players", data).then((r) => r.data),
    update:       (id: string, data: UpdatePlayerPayload) => api.patch<{ invitation?: AutomaticInvite }>(`/admin/players/${id}/profile`, data).then((r) => r.data),
    // erasure: la baja la pide el propio jugador (supresión completa)
    delete:       (id: string, { erasure = false }: { erasure?: boolean } = {}) =>
      api.delete(`/admin/players/${id}`, { params: erasure ? { erasure: true } : undefined }).then((r) => r.data),
    resendInvite: (id: string)                            => api.post(`/admin/players/${id}/resend-invite`).then((r) => r.data),
    getInviteLink: (id: string)                           => api.post<{ url: string; name: string }>(`/admin/players/${id}/invite-link`).then((r) => r.data),
    bulkInvite:   ()                                       => api.post<{ sent: number; skipped: number; total: number }>("/admin/players/bulk-invite").then((r) => r.data),
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
    findOne:    (id: string) =>
      api.get<Club>(`/admin/clubs/${id}`).then((r) => r.data),
    create:     (data: Omit<Club, "id" | "active" | "tournamentCount">) =>
      api.post<Club>("/admin/clubs", data).then((r) => r.data),
    update:     (id: string, data: Partial<Omit<Club, "id" | "tournamentCount">>) =>
      api.patch<Club>(`/admin/clubs/${id}`, data).then((r) => r.data),
    deactivate:   (id: string) =>
      api.delete(`/admin/clubs/${id}`).then((r) => r.data),
    geocodeBatch: () =>
      api.post<{ updated: number; skipped: number; errors: string[] }>('/admin/clubs/geocode-batch').then((r) => r.data),
    // Crea un club stub + invita a su admin en un solo paso. El propio
    // admin del club completa los datos al entrar por primera vez.
    quickInvite: (email: string) =>
      api.post<{ clubId: string; invitationId: string; expiresAt: string }>(
        "/admin/clubs/quick-invite",
        { email },
      ).then((r) => r.data),
  },

  courts: {
    list:   (clubId: string) =>
      api.get<Court[]>(`/admin/clubs/${clubId}/courts`).then((r) => r.data ?? []),
    create: (clubId: string, data: { name: string; isIndoor?: boolean; isCentral?: boolean }) =>
      api.post<Court>(`/admin/clubs/${clubId}/courts`, data).then((r) => r.data),
    update: (clubId: string, courtId: string, data: Partial<{
      name: string; isIndoor: boolean; isCentral: boolean; order: number;
      type: "SINGLES" | "DOUBLES"; wallType: "GLASS" | "WALL" | null;
      allowOpenMatches: boolean;
    }>) =>
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
    sync: (tournamentId: string) =>
      api.post<TournamentCourt[]>(`/admin/tournaments/${tournamentId}/courts/sync`).then((r) => r.data ?? []),
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
      fetchAllRankingPages({
        gender, type,
        ...(season ? { season } : {}),
        ...(level  ? { level  } : {}),
      }).then((rows) =>
        rows.map((u: any): Player => ({
          ...u,
          level:        u.level ?? u.categoryLevel ?? null,
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
    testEmail:        (to?: string)                                       => api.post<{ sent: boolean; to: string }>("/admin/config/test-email", { to }).then((r) => r.data),
    // delivery: 'confirmed' si Apple/Google ya lo recibieron; 'pending' si aún no hay recibo
    testPush:         ()                                                  => api.post<{ sent: boolean; delivery?: "confirmed" | "pending" }>("/admin/config/test-push").then((r) => r.data),
  },

  admins: {
    list:       ()                                                        => api.get<AdminMember[]>("/admin/admins").then((r) => r.data ?? []),
    invite:     (data: { email: string; firstName: string; lastName: string; role?: "ADMIN" | "SUPERADMIN" }) =>
      api.post<AdminMember>("/admin/admins/invite", data).then((r) => r.data),
    // Devuelve el rol con el que queda (el toast lo enseña)
    updateRole: (id: string, role: "ADMIN" | "SUPERADMIN")               =>
      api.patch<{ id: string; role: "ADMIN" | "SUPERADMIN" }>(`/admin/admins/${id}/role`, { role }).then((r) => r.data),
    revoke:     (id: string)                                              => api.delete(`/admin/admins/${id}`).then((r) => r.data),
  },

  support: {
    list:         (status?: SupportStatus)  => api.get<SupportMessage[]>("/admin/support", { params: status ? { status } : {} }).then((r) => r.data ?? []),
    updateStatus: (id: string, status: SupportStatus) => api.patch(`/admin/support/${id}/status`, { status }).then((r) => r.data),
  },
};
