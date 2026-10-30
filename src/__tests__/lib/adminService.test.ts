/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    it('llama a POST /admin/tournaments con el payload y 30 s de espera (crearlo tarda)', async () => {
      const payload = { name: 'Nuevo torneo' } as any;
      mockPost.mockResolvedValueOnce({ data: { id: 't2', ...payload } });
      await adminService.tournaments.create(payload);
      expect(mockPost).toHaveBeenCalledWith('/admin/tournaments', payload, { timeout: 30_000 });
    });
  });

  describe('tournaments.delete', () => {
    it('llama a DELETE /admin/tournaments/:id', async () => {
      mockDelete.mockResolvedValueOnce({ data: {} });
      await adminService.tournaments.delete('t1');
      expect(mockDelete).toHaveBeenCalledWith('/admin/tournaments/t1', undefined);
    });
  });

  // ── Matches — lógica de transformación ──────────────────────────────

  describe('matches.setResult', () => {
    it('un walkover manda la pareja ganadora como winnerTeam (con walkoverWinnerTeam, el back la descartaba y daba 400)', async () => {
      mockPatch.mockResolvedValueOnce({ data: {} });
      await adminService.matches.setResult('m1', [], [], true, 2);
      expect(mockPatch).toHaveBeenCalledWith('/admin/matches/m1/result', {
        sets1: [], sets2: [], walkover: true, winnerTeam: 2,
      });
    });

    it('un resultado normal no manda walkover ni winnerTeam; force solo si se pide', async () => {
      mockPatch.mockResolvedValueOnce({ data: {} });
      await adminService.matches.setResult('m1', [6, 6], [3, 4], undefined, undefined, true);
      expect(mockPatch).toHaveBeenCalledWith('/admin/matches/m1/result', {
        sets1: [6, 6], sets2: [3, 4], force: true,
      });
    });
  });

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

    it('pide todas las páginas (de 500) con los filtros', async () => {
      const m = (id: string) => ({ id, status: 'SCHEDULED', players: [], sets: [] });
      mockGet
        .mockResolvedValueOnce({ data: { data: [m('m1'), m('m2')], total: 3, page: 1, pageSize: 2 } })
        .mockResolvedValueOnce({ data: { data: [m('m3')], total: 3, page: 2, pageSize: 2 } });

      const result = await adminService.matches.list('t1', { categoryId: 'c1' });

      expect(result.map((r) => r.id)).toEqual(['m1', 'm2', 'm3']);
      expect(mockGet).toHaveBeenNthCalledWith(1, '/admin/tournaments/t1/matches', {
        params: { categoryId: 'c1', phase: undefined, status: undefined, page: 1, pageSize: 500 },
      });
      expect(mockGet).toHaveBeenNthCalledWith(2, '/admin/tournaments/t1/matches', {
        params: expect.objectContaining({ page: 2, pageSize: 500 }),
      });
    });
  });

  // ── Registrations — todas las páginas ───────────────────────────────

  describe('registrations.list', () => {
    // clearAllMocks no borra las respuestas pendientes: que no lleguen a otros tests.
    afterEach(() => mockGet.mockReset());

    // Antes solo pedía la primera página (50): en torneos de más de 50
    // inscripciones faltaban filas en la lista, la CSV y el editor de grupos.
    it('junta todas las páginas hasta el total', async () => {
      const page = (ids: string[], total: number) => ({
        data: { data: ids.map((id) => ({ id })), total, page: 1, pageSize: 200 },
      });
      mockGet
        .mockResolvedValueOnce(page(['r1', 'r2'], 5))
        .mockResolvedValueOnce(page(['r3', 'r4'], 5))
        .mockResolvedValueOnce(page(['r5'], 5));

      const result = await adminService.registrations.list('t1');

      expect(result.map((r) => r.id)).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(mockGet).toHaveBeenLastCalledWith('/admin/tournaments/t1/registrations', {
        params: { page: 3, pageSize: 200 },
      });
    });

    it('para si una página llega vacía aunque el total diga más', async () => {
      mockGet
        .mockResolvedValueOnce({ data: { data: [{ id: 'r1' }], total: 10 } })
        .mockResolvedValueOnce({ data: { data: [], total: 10 } });

      const result = await adminService.registrations.list('t1');

      expect(result).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('nunca pide más de 100 páginas', async () => {
      mockGet.mockResolvedValue({ data: { data: [{ id: 'r' }], total: 1_000_000 } });

      const result = await adminService.registrations.list('t1');

      expect(mockGet).toHaveBeenCalledTimes(100);
      expect(result).toHaveLength(100);
    });
  });

  // ── Players — lógica de transformación ──────────────────────────────

  describe('players.list', () => {
    it('sin categoría: level null, nunca 4ª por defecto (D6)', async () => {
      mockGet.mockResolvedValueOnce({
        data: { data: [{ id: 'p1', name: 'Ana', level: null }], total: 1, page: 1, pageSize: 50 },
      });
      const result = await adminService.players.list();
      expect(result.data[0].level).toBeNull();
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
    it('sin categoría: level null, aunque tenga nivel SPA (D6)', async () => {
      mockGet.mockResolvedValueOnce({
        data: { id: 'p1', name: 'Ana', level: null, spaLevel: '3a' },
      });
      const result = await adminService.players.detail('p1');
      expect(result?.level).toBeNull();
    });

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
        params: { gender: 'F', type: 'circuit', season: 2025, level: '1a', page: 1, limit: 500 },
      });
    });

    it('pide páginas hasta tener el ranking entero: con más de 500 no se corta', async () => {
      const row = (i: number) => ({ id: `p${i}`, name: `J${i}`, gender: 'M' });
      mockGet
        .mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, i) => row(i)) })
        .mockResolvedValueOnce({ data: [row(500), row(501)] });
      const result = await adminService.rankings.list('M');
      expect(result).toHaveLength(502);
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenLastCalledWith('/ranking', {
        params: { gender: 'M', type: 'circuit', page: 2, limit: 500 },
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

    it('con force (categoría llena o con cola, tras preguntar), lo manda', async () => {
      mockPatch.mockResolvedValueOnce({ data: {} });
      await adminService.registrations.bulkStatus(['r1'], 'CONFIRMED', true);
      expect(mockPatch).toHaveBeenCalledWith('/admin/registrations/bulk-status', {
        ids: ['r1'],
        status: 'CONFIRMED',
        force: true,
      });
    });
  });

  // ── categories.updatePrizes ──────────────────────────────────────────

  describe('categories.updatePrizes', () => {
    it('llama a PATCH /admin/tournaments/:id/categories/:catId/prizes', async () => {
      mockPatch.mockResolvedValueOnce({ data: { id: 'cat-1', prizeChampion: '200€' } });
      const result = await adminService.categories.updatePrizes('tour-1', 'cat-1', {
        prizeChampion: '200€',
        prizeRunnerUp: '100€',
      });
      expect(mockPatch).toHaveBeenCalledWith(
        '/admin/tournaments/tour-1/categories/cat-1/prizes',
        { prizeChampion: '200€', prizeRunnerUp: '100€' },
      );
      expect(result).toHaveProperty('prizeChampion', '200€');
    });

    it('envía hasConsolation false para limpiar el premio de consolación', async () => {
      mockPatch.mockResolvedValueOnce({ data: { id: 'cat-1', hasConsolation: false, prizeConsolation: null } });
      await adminService.categories.updatePrizes('tour-1', 'cat-1', { hasConsolation: false });
      expect(mockPatch).toHaveBeenCalledWith(
        '/admin/tournaments/tour-1/categories/cat-1/prizes',
        { hasConsolation: false },
      );
    });

    it('incluye prizeConsolation cuando hasConsolation es true', async () => {
      mockPatch.mockResolvedValueOnce({ data: {} });
      await adminService.categories.updatePrizes('tour-1', 'cat-1', {
        hasConsolation: true,
        prizeConsolation: '50€',
      });
      expect(mockPatch).toHaveBeenCalledWith(
        '/admin/tournaments/tour-1/categories/cat-1/prizes',
        { hasConsolation: true, prizeConsolation: '50€' },
      );
    });
  });

  // ── Preparación, mapa de calor, nivel SPA y grupos bloqueados ─────────

  describe('preparación del torneo', () => {
    it('pasos, «Publicar y avisar» (force solo si se pide), mapa de calor y nivel', async () => {
      mockGet.mockResolvedValue({ data: {} });
      mockPost.mockResolvedValue({ data: {} });
      await adminService.tournaments.preparation('t1');
      expect(mockGet).toHaveBeenCalledWith('/admin/tournaments/t1/preparation');

      await adminService.tournaments.publishAndNotify('t1');
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/preparation/publish', {});
      await adminService.tournaments.publishAndNotify('t1', true);
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/preparation/publish', { force: true });

      await adminService.tournaments.availabilityHeatmap('t1');
      expect(mockGet).toHaveBeenLastCalledWith('/admin/tournaments/t1/availability-heatmap', undefined);
      await adminService.tournaments.availabilityHeatmap('t1', 'c1');
      expect(mockGet).toHaveBeenLastCalledWith('/admin/tournaments/t1/availability-heatmap', { params: { categoryId: 'c1' } });

      mockGet.mockResolvedValueOnce({ data: null });
      await expect(adminService.tournaments.levelBands('t1')).resolves.toEqual([]);
      expect(mockGet).toHaveBeenLastCalledWith('/admin/tournaments/t1/level-bands');
    });
  });

  describe('grupos con el cuadro publicado: forceLocked solo con «Forzar»', () => {
    const mockPut = api.put as ReturnType<typeof vi.fn>;
    const members = [{ userId: 'u1', partnerId: 'u2' }];
    const base = '/admin/tournaments/t1/categories/c1';

    beforeEach(() => {
      mockPost.mockResolvedValue({ data: {} });
      mockPut.mockResolvedValue({ data: {} });
      mockPatch.mockResolvedValue({ data: {} });
      mockDelete.mockResolvedValue({ data: {} });
    });

    it('sin forzar, las peticiones de siempre', async () => {
      await adminService.tournaments.addEmptyGroup('t1', 'c1');
      expect(mockPost).toHaveBeenLastCalledWith(`${base}/bracket/groups`);
      await adminService.tournaments.deleteGroup('t1', 'c1', 'g1');
      expect(mockDelete).toHaveBeenLastCalledWith(`${base}/bracket/groups/g1`, undefined);
      await adminService.tournaments.deleteGroup('t1', 'c1', 'g1', true);
      expect(mockDelete).toHaveBeenLastCalledWith(`${base}/bracket/groups/g1`, { params: { force: true } });
      await adminService.tournaments.updateGroupMembers('t1', 'c1', 'g1', members);
      expect(mockPatch).toHaveBeenLastCalledWith(`${base}/groups/g1/members`, { members });
      await adminService.tournaments.updateAllGroupMembers('t1', 'c1', [{ groupId: 'g1', members }], true);
      expect(mockPut).toHaveBeenLastCalledWith(`${base}/groups/members`, { groups: [{ groupId: 'g1', members }], force: true });
      await adminService.tournaments.regenerateBracket('t1', 'c1');
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/bracket/regenerate', { categoryId: 'c1' });
    });

    it('partidos de grupos y generar: sin forzar, las peticiones de siempre; forzando, con forceLocked', async () => {
      const team = { userId: 'a', partnerId: 'b' };
      await adminService.tournaments.editMatchPlayers('m1', team, team);
      expect(mockPatch).toHaveBeenLastCalledWith('/admin/matches/m1/players', { team1: team, team2: team });
      await adminService.tournaments.editMatchPlayers('m1', team, team, false, { forceLocked: true });
      expect(mockPatch).toHaveBeenLastCalledWith('/admin/matches/m1/players', { team1: team, team2: team, forceLocked: true });

      const dto = { categoryId: 'c1', groupId: 'g1' };
      await adminService.tournaments.createManualMatch('t1', dto);
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/matches', dto);
      await adminService.tournaments.createManualMatch('t1', dto, { forceLocked: true });
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/matches', { ...dto, forceLocked: true });

      await adminService.tournaments.deleteMatch('m1', true);
      expect(mockDelete).toHaveBeenLastCalledWith('/admin/matches/m1', { params: { force: true } });
      await adminService.tournaments.deleteMatch('m1', false, { forceLocked: true });
      expect(mockDelete).toHaveBeenLastCalledWith('/admin/matches/m1', { params: { forceLocked: true } });

      await adminService.tournaments.generateBracket('t1', 'c1');
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/bracket/generate', { categoryId: 'c1', customGroups: undefined });
      await adminService.tournaments.generateBracket('t1', 'c1', undefined, undefined, undefined, { forceLocked: true });
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/bracket/generate', {
        categoryId: 'c1',
        customGroups: undefined,
        forceLocked: true,
      });
    });

    it('forzando, añaden forceLocked', async () => {
      const lock = { forceLocked: true };
      await adminService.tournaments.addEmptyGroup('t1', 'c1', lock);
      expect(mockPost).toHaveBeenLastCalledWith(`${base}/bracket/groups`, { forceLocked: true });
      await adminService.tournaments.deleteGroup('t1', 'c1', 'g1', false, lock);
      expect(mockDelete).toHaveBeenLastCalledWith(`${base}/bracket/groups/g1`, { params: { forceLocked: true } });
      await adminService.tournaments.updateGroupMembers('t1', 'c1', 'g1', members, false, lock);
      expect(mockPatch).toHaveBeenLastCalledWith(`${base}/groups/g1/members`, { members, forceLocked: true });
      await adminService.tournaments.updateAllGroupMembers('t1', 'c1', [{ groupId: 'g1', members }], false, lock);
      expect(mockPut).toHaveBeenLastCalledWith(`${base}/groups/members`, { groups: [{ groupId: 'g1', members }], forceLocked: true });
      await adminService.tournaments.regenerateBracket('t1', 'c1', undefined, undefined, lock);
      expect(mockPost).toHaveBeenLastCalledWith('/admin/tournaments/t1/bracket/regenerate', { categoryId: 'c1', forceLocked: true });
    });
  });

  describe('administradores de un club (L25)', () => {
    it('la lista: GET /admin/clubs/:id/admins', async () => {
      const body = { admins: [], invitations: [] };
      mockGet.mockResolvedValueOnce({ data: body });
      await expect(adminService.clubs.admins('c1')).resolves.toEqual(body);
      expect(mockGet).toHaveBeenCalledWith('/admin/clubs/c1/admins');
    });

    it('invitar a un club que ya existe, reenviar y anular', async () => {
      const created = { data: { id: 'inv-2', expiresAt: '2026-11-06T09:00:00.000Z' } };
      mockPost.mockResolvedValueOnce(created).mockResolvedValueOnce(created);
      mockDelete.mockResolvedValueOnce({ data: '' });

      await adminService.clubs.inviteAdmin('c1', 'admin@club.com');
      expect(mockPost).toHaveBeenLastCalledWith('/admin/clubs/c1/admins/invite', { email: 'admin@club.com' });
      await adminService.clubs.resendInvitation('c1', 'inv-1');
      expect(mockPost).toHaveBeenLastCalledWith('/admin/clubs/c1/invitations/inv-1/resend');
      await adminService.clubs.revokeInvitation('c1', 'inv-1');
      expect(mockDelete).toHaveBeenLastCalledWith('/admin/clubs/c1/invitations/inv-1');
    });
  });
});
