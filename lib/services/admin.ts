import { api } from "@/lib/api";
import type { AdminStats, Tournament } from "@/types";

export const adminService = {
  stats: () =>
    api.get<AdminStats>("/admin/stats").then((r) => r.data),

  tournaments: {
    list:   ()          => api.get<Tournament[]>("/tournaments").then((r) => r.data),
    detail: (id: string) => api.get<Tournament>(`/tournaments/${id}`).then((r) => r.data),
    create: (data: Partial<Tournament>) =>
      api.post<Tournament>("/admin/tournaments", data).then((r) => r.data),
    update: (id: string, data: Partial<Tournament>) =>
      api.patch<Tournament>(`/admin/tournaments/${id}`, data).then((r) => r.data),
  },

  registrations: {
    list:         (tournamentId: string) =>
      api.get(`/admin/tournaments/${tournamentId}/registrations`).then((r) => r.data),
    updateStatus: (registrationId: string, status: string) =>
      api.patch(`/admin/registrations/${registrationId}/status`, { status }).then((r) => r.data),
  },

  matches: {
    setResult: (matchId: string, sets1: number[], sets2: number[]) =>
      api.patch(`/admin/matches/${matchId}/result`, { sets1, sets2 }).then((r) => r.data),
  },

  rankings: {
    recalculate: () =>
      api.post("/admin/rankings/recalculate").then((r) => r.data),
  },
};
