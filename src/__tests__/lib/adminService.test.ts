import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/api', () => ({
  api: {
    get:    vi.fn(),
    post:   vi.fn(),
    patch:  vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
  },
}));

import { adminService } from '../../../lib/services/admin';
import { api } from '../../../lib/api';

const mockGet    = api.get    as ReturnType<typeof vi.fn>;
const mockPost   = api.post   as ReturnType<typeof vi.fn>;
const mockPatch  = api.patch  as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

describe('adminService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Stats / Alerts / Activity ────────────────────────────────────────

  describe('stats', () => {
    it('llama a GET /admin/stats', async () => {
      mockGet.mockResolvedValueOnce({ data: { activeTournaments: 3 } });
      const result = await adminService.stats();
      expect(mockGet).toHaveBeenCalledWith('/admin/stats');
      expect(result).toEqual({ activeTournaments: 3 });
    });
  });

  describe('alerts', () => {
    it('devuelve array vacío si la petición falla', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      const result = await adminService.alerts();
      expect(result).toEqual([]);
    });

    it('devuelve los datos si la petición tiene éxito', async () => {
      const alerts = [{ id: 'a1', type: 'match', message: 'Sin pista', href: '/resultados' }];
      mockGet.mockResolvedValueOnce({ data: alerts });
      const result = await adminService.alerts();
      expect(result).toEqual(alerts);
    });
  });

  describe('activity', () => {
    it('devuelve array vacío si la petición falla', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      const result = await adminService.activity();
      expect(result).toEqual([]);
    });
  });

  // ── Tournaments — normalización de status ────────────────────────────

  describe('tournaments.list', () => {
    it('normaliza status a mayúsculas', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 't1', status: 'open', name: 'Test' }] });
      const result = await adminService.tournaments.list();
      expect(result[0].status).toBe('OPEN');
    });

    it('devuelve array vacío si data es null', async () => {
      mockGet.mockResolvedValueOnce({ data: null });
      const result = await adminService.tournaments.list();
      expect(result).toEqual([]);
    });
  });

  describe('tournaments.detail', () => {
    it('normaliza status a mayúsculas', async () => {
      mockGet.mockResolvedValueOnce({ data: { id: 't1', status: 'scheduled' } });
      const result = await adminService.tournaments.detail('t1');
      expect(result?.status).toBe('SCHEDULED');
    });

    it('devuelve el dato original si status ya está en mayúsculas', async () => {
      mockGet.mockResolvedValueOnce({ data: { id: 't1', status: 'FINISHED' } });
      const result = await adminService.tournaments.detail('t1');
      expect(result?.status).toBe('FINISHED');
    });
  });

  describe('tournaments.create', () => {
    it('llama a POST /admin/tournaments con el payload', async () => {
      const payload = { name: 'Nuevo torneo' } as any;
      mockPost.mockResolvedValueOnce({ data: { id: 't2', ...payload } });
      await adminService.tournaments.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/admin/tournaments', payload);
    });
  });

  describe('tournaments.delete', () => {
    it('llama a DELETE /admin/tournaments/:id', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });
      await adminService.tournaments.delete('t1');
      expect(mockDelete).toHaveBeenCalledWith('/admin/tournaments/t1');
    });
  });

  // ── Matches — lógica de transformación ──────────────────────────────

  describe('matches.list', () => {
    it('extrae team1/team2 desde el array players', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{
          id: 'm1', status: 'FINISHED',
          players: [
            { team: 1, isWinner: true,  user: { name: 'Ana López' } },
            { team: 1, isWinner: true,  user: { name: 'Bea Gil'  } },
            { team: 2, isWinner: false, user: { name: 'Carlos M' } },
            { team: 2, isWinner: false, user: { name: 'David R'  } },
          ],
          sets: [],
        }],
      });
      const result = await adminService.matches.list('t1');
      expect(result[0].team1).toEqual(['Ana López', 'Bea Gil']);
      expect(result[0].team2).toEqual(['Carlos M', 'David R']);
    });

    it('extrae sets1/sets2 desde el array sets', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{
          id: 'm1', status: 'FINISHED', players: [],
          sets: [{ score1: 6, score2: 2 }, { score1: 6, score2: 3 }],
        }],
      });
      const result = await adminService.matches.list('t1');
      expect(result[0].sets1).toEqual([6, 6]);
      expect(result[0].sets2).toEqual([2, 3]);
    });

    it('determina winner como team1 cuando el jugador isWinner pertenece al equipo 1', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{
          id: 'm1', status: 'FINISHED',
          players: [
            { team: 1, isWinner: true,  user: { name: 'Ana' } },
            { team: 2, isWinner: false, user: { name: 'Bob' } },
          ],
          sets: [],
        }],
      });
      const result = await adminService.matches.list('t1');
      expect(result[0].winner).toBe('team1');
    });

    it('determina winner como team2 cuando el jugador isWinner pertenece al equipo 2', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{
          id: 'm1', status: 'FINISHED',
          players: [
            { team: 1, isWinner: false, user: { name: 'Ana' } },
            { team: 2, isWinner: true,  user: { name: 'Bob' } },
          ],
          sets: [],
        }],
      });
      const result = await adminService.matches.list('t1');
      expect(result[0].winner).toBe('team2');
    });

    it('marca isResult=true cuando status es FINISHED', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 'm1', status: 'FINISHED', players: [], sets: [] }] });
      const result = await adminService.matches.list('t1');
      expect(result[0].isResult).toBe(true);
    });

    it('devuelve array vacío si data es null', async () => {
      mockGet.mockResolvedValueOnce({ data: null });
      const result = await adminService.matches.list('t1');
      expect(result).toEqual([]);
    });
  });

  // ── Players — lógica de transformación ──────────────────────────────

  describe('players.list', () => {
    it('usa "4a" como level por defecto si falta', async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: [{ id: 'p1', name: 'Ana' }], total: 1, page: 1, pageSize: 50 },
      });
      const result = await adminService.players.list();
      expect(result.data[0].level).toBe('4a');
    });

    it('preserva el level si viene en la respuesta', async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: [{ id: 'p1', name: 'Ana', level: '2a' }], total: 1, page: 1, pageSize: 50 },
      });
      const result = await adminService.players.list();
      expect(result.data[0].level).toBe('2a');
    });

    it('devuelve data vacío si la respuesta no tiene data', async () => {
      mockGet.mockResolvedValueOnce({ data: null });
      const result = await adminService.players.list();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('players.detail', () => {
    it('construye name desde firstName + lastName si name falta', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 'p1', firstName: 'Ana', lastName: 'García', level: '2a' },
      });
      const result = await adminService.players.detail('p1');
      expect(result?.name).toBe('Ana García');
    });

    it('construye el objeto spa desde campos individuales', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 'p1', name: 'Ana', level: '2a', spaPoints: '320.7', spaMatches: 25 },
      });
      const result = await adminService.players.detail('p1');
      expect(result?.spa?.spaPoints).toBe(321);
      expect(result?.spa?.spaMatches).toBe(25);
      expect(result?.spa?.isCalibrating).toBe(false);
    });

    it('marca isCalibrating=true si spaMatches < 20', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 'p1', name: 'Ana', level: '2a', spaPoints: '100', spaMatches: 5 },
      });
      const result = await adminService.players.detail('p1');
      expect(result?.spa?.isCalibrating).toBe(true);
    });
  });

  // ── Rankings — lógica de transformación ────────────────────────────

  describe('rankings.list', () => {
    it('usa categoryLevel como fallback de level', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 'p1', name: 'Ana', gender: 'M', categoryLevel: '3a' }] });
      const result = await adminService.rankings.list('M');
      expect(result[0].level).toBe('3a');
    });

    it('usa circuitPoints como fallback de points', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 'p1', name: 'Ana', gender: 'M', circuitPoints: 500 }] });
      const result = await adminService.rankings.list('M');
      expect(result[0].points).toBe(500);
    });

    it('construye spa con Math.round en spaPoints', async () => {
      mockGet.mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'Ana', gender: 'M', spaPoints: '250.6', spaMatches: 30 }],
      });
      const result = await adminService.rankings.list('M');
      expect(result[0].spa?.spaPoints).toBe(251);
      expect(result[0].spa?.isCalibrating).toBe(false);
    });

    it('spa es undefined si spaPoints es null', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 'p1', name: 'Ana', gender: 'M', spaPoints: null }] });
      const result = await adminService.rankings.list('M');
      expect(result[0].spa).toBeUndefined();
    });

    it('incluye season y level en params cuando se proporcionan', async () => {
      mockGet.mockResolvedValueOnce({ data: [] });
      await adminService.rankings.list('F', 'circuit', 2025, '1a');
      expect(mockGet).toHaveBeenCalledWith('/ranking', {
        params: { gender: 'F', type: 'circuit', limit: 500, season: 2025, level: '1a' },
      });
    });
  });

  // ── Registrations ────────────────────────────────────────────────────

  describe('registrations.updateStatus', () => {
    it('llama a PATCH /admin/registrations/:id/status', async () => {
      mockPatch.mockResolvedValueOnce({ data: {} });
      await adminService.registrations.updateStatus('reg-1', 'CONFIRMED');
      expect(mockPatch).toHaveBeenCalledWith('/admin/registrations/reg-1/status', { status: 'CONFIRMED' });
    });
  });

  describe('registrations.bulkStatus', () => {
    it('llama a PATCH /admin/registrations/bulk-status con ids y status', async () => {
      mockPatch.mockResolvedValueOnce({ data: {} });
      await adminService.registrations.bulkStatus(['r1', 'r2'], 'CONFIRMED');
      expect(mockPatch).toHaveBeenCalledWith('/admin/registrations/bulk-status', {
        ids: ['r1', 'r2'],
        status: 'CONFIRMED',
      });
    });
  });
});
