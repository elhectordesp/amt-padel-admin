/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { compareWaitlist, groupByPair, pairKeyOf, pairPlayers, paymentCsvColumns, playerPayment, waitlistPositions } from '../../../lib/utils/registration-pairs';
import { needsForce } from '../../../lib/utils/registration-force';
import { ApiError } from '../../../lib/api';

let seq = 0;
const reg = (overrides: any = {}): any => ({
  id:         `reg-${++seq}`,
  tournamentId: 't1',
  categoryId: 'cat-1',
  userId:     'a',
  partnerId:  'b',
  user:       { name: 'Ana López' },
  partner:    { name: 'Bea Ruiz' },
  category:   { gender: 'F', level: '3a', price: 30 },
  status:     'CONFIRMED',
  paid:       false,
  createdAt:  '2026-05-01T10:00:00Z',
  ...overrides,
});

describe('pairKeyOf', () => {
  it('la misma clave para A+B y B+A en la misma categoría', () => {
    expect(pairKeyOf({ userId: 'a', partnerId: 'b', categoryId: 'c' }))
      .toBe(pairKeyOf({ userId: 'b', partnerId: 'a', categoryId: 'c' }));
  });

  it('distinta en otra categoría o sin pareja', () => {
    const ab = pairKeyOf({ userId: 'a', partnerId: 'b', categoryId: 'c' });
    expect(pairKeyOf({ userId: 'a', partnerId: 'b', categoryId: 'otra' })).not.toBe(ab);
    expect(pairKeyOf({ userId: 'a', partnerId: null, categoryId: 'c' })).not.toBe(ab);
  });
});

describe('groupByPair', () => {
  it('pareja en una fila (app o panel nuevo): una pareja con esa fila', () => {
    const r = reg();
    const [pair, ...rest] = groupByPair([r]);
    expect(rest).toHaveLength(0);
    expect(pair).toMatchObject({ ids: [r.id], primary: r, status: 'CONFIRMED' });
  });

  it('pareja espejo con las dos filas vivas: una pareja, las dos filas para cambiar el estado', () => {
    const ab = reg();
    const ba = reg({ userId: 'b', partnerId: 'a', user: { name: 'Bea Ruiz' }, partner: { name: 'Ana López' } });
    const pairs = groupByPair([ab, ba]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].ids).toEqual([ab.id, ba.id]);
    expect(pairs[0].primary).toBe(ab);
  });

  it('con una fila cancelada delante (más reciente), la principal es la viva y solo ella se cambia', () => {
    const cancelled = reg({ userId: 'b', partnerId: 'a', status: 'CANCELLED' });
    const live      = reg({ status: 'PENDING' });
    const [pair] = groupByPair([cancelled, live]);
    expect(pair.primary).toBe(live);
    expect(pair.status).toBe('PENDING');
    // Reactivar la cancelada a la vez crearía otra inscripción de la pareja
    expect(pair.ids).toEqual([live.id]);
  });

  it('cancelada entera: la más reciente, sola (el back reactiva con ella su espejo)', () => {
    const newer = reg({ status: 'CANCELLED' });
    const older = reg({ userId: 'b', partnerId: 'a', status: 'CANCELLED' });
    const [pair] = groupByPair([newer, older]);
    expect(pair.primary).toBe(newer);
    expect(pair.status).toBe('CANCELLED');
    expect(pair.ids).toEqual([newer.id]);
  });

  it('no junta a A+B con la inscripción de B con otro compañero (antes la tomaba por su espejo)', () => {
    const ab = reg({ status: 'CANCELLED' });
    const bx = reg({ userId: 'b', partnerId: 'x', partner: { name: 'Xia' } });
    const pairs = groupByPair([ab, bx]);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].ids).toEqual([ab.id]);
    expect(pairs[1].ids).toEqual([bx.id]);
  });

  it('pareja espejo antigua con la disponibilidad en una sola fila: la principal es esa (el aviso y el modal miran la principal)', () => {
    const without = reg({ hasAvailability: false });
    const withIt  = reg({ userId: 'b', partnerId: 'a', hasAvailability: true });
    const [pair] = groupByPair([without, withIt]);
    expect(pair.primary).toBe(withIt);
    expect(pair.ids).toEqual([without.id, withIt.id]);
  });

  it('la disponibilidad de una cancelada no la hace principal', () => {
    const live      = reg({ hasAvailability: false });
    const cancelled = reg({ userId: 'b', partnerId: 'a', status: 'CANCELLED', hasAvailability: true });
    expect(groupByPair([live, cancelled])[0].primary).toBe(live);
  });

  it('la misma pareja en dos categorías: dos parejas', () => {
    const pairs = groupByPair([reg(), reg({ categoryId: 'cat-2' })]);
    expect(pairs.map((p) => p.primary.categoryId)).toEqual(['cat-1', 'cat-2']);
  });

  it('respeta el orden de llegada (de la más reciente a la más antigua)', () => {
    const first  = reg({ userId: 'c', partnerId: 'd' });
    const second = reg();
    const mirror = reg({ userId: 'd', partnerId: 'c' });
    expect(groupByPair([first, second, mirror]).map((p) => p.primary)).toEqual([first, second]);
  });
});

describe('playerPayment', () => {
  it('titular: el pago de la propia fila', () => {
    const r = reg({ paid: true, paymentMethod: 'TPV', paidAt: '2026-05-02T00:00:00Z', paymentNote: 'nota A' });
    expect(playerPayment(r, 'titular')).toEqual({
      paid: true, paymentMethod: 'TPV', paidAt: '2026-05-02T00:00:00Z', paymentNote: 'nota A',
    });
  });

  it('compañero: el que resuelve el back en partnerPayment, no el del titular', () => {
    const r = reg({
      paid: true,
      partnerPayment: { paid: false, paymentMethod: null, paidAt: null, paymentNote: 'paga el sábado' },
    });
    expect(playerPayment(r, 'partner')).toEqual({
      paid: false, paymentMethod: null, paidAt: null, paymentNote: 'paga el sábado',
    });
  });

  it('compañero sin partnerPayment (fila de otro endpoint) o sin pareja: sin pagar', () => {
    expect(playerPayment(reg({ paid: true }), 'partner').paid).toBe(false);
    expect(playerPayment(reg({ partnerId: null, partner: null, paid: true }), 'partner').paid).toBe(false);
  });
});

describe('paymentCsvColumns', () => {
  it('una columna por jugador', () => {
    expect(paymentCsvColumns(reg({ paid: true, partnerPayment: { paid: false } }))).toEqual({
      'Pago J1': 'Sí', 'Pago J2': 'No',
    });
  });

  it('sin pareja, la del compañero vacía', () => {
    expect(paymentCsvColumns(reg({ partnerId: null, partner: null }))).toEqual({ 'Pago J1': 'No', 'Pago J2': '' });
  });
});

describe('pairPlayers', () => {
  it('el titular y el compañero, cada uno con su id, nombre y pago', () => {
    const r = reg({ paid: true, partnerPayment: { paid: false } });
    expect(pairPlayers(r).map(({ player, id, name, payment }) => [player, id, name, payment.paid])).toEqual([
      ['titular', 'a', 'Ana López', true],
      ['partner', 'b', 'Bea Ruiz', false],
    ]);
  });

  it('sin pareja, solo el titular', () => {
    expect(pairPlayers(reg({ partnerId: null, partner: null })).map((p) => p.player)).toEqual(['titular']);
  });
});

describe('cola de espera (compareWaitlist, waitlistPositions)', () => {
  it('manda la fecha de entrada en la cola, no la de inscripción: quien bajó a la espera va detrás', () => {
    const oldButDemoted = reg({ userId: 'a', status: 'WAITLIST', createdAt: '2026-05-01T10:00:00Z', waitlistedAt: '2026-05-05T10:00:00Z' });
    const waiting       = reg({ userId: 'c', status: 'WAITLIST', createdAt: '2026-05-03T10:00:00Z', waitlistedAt: '2026-05-03T10:00:00Z' });
    expect([oldButDemoted, waiting].sort(compareWaitlist)).toEqual([waiting, oldButDemoted]);
  });

  it('sin fecha de cola (filas de antes, seeds), cuenta su inscripción; empate, por id', () => {
    const noDate = reg({ id: 'r-a', createdAt: '2026-05-03T10:00:00Z', waitlistedAt: null });
    const later  = reg({ id: 'r-c', createdAt: '2026-05-01T10:00:00Z', waitlistedAt: '2026-05-04T10:00:00Z' });
    const tieB   = reg({ id: 'r-e', createdAt: '2026-05-01T09:00:00Z', waitlistedAt: '2026-05-02T10:00:00Z' });
    const tieA   = reg({ id: 'r-d', createdAt: '2026-05-01T08:00:00Z', waitlistedAt: '2026-05-02T10:00:00Z' });
    expect([noDate, later, tieB, tieA].sort(compareWaitlist)).toEqual([tieA, tieB, noDate, later]);
  });

  it('puesto en la cola de su categoría, solo las parejas en espera', () => {
    const pairs = groupByPair([
      reg({ userId: 'a', partnerId: 'b', status: 'WAITLIST', waitlistedAt: '2026-05-05T10:00:00Z' }),
      reg({ userId: 'c', partnerId: 'd', status: 'WAITLIST', waitlistedAt: '2026-05-03T10:00:00Z' }),
      reg({ userId: 'e', partnerId: 'f', status: 'WAITLIST', categoryId: 'cat-2', waitlistedAt: '2026-05-09T10:00:00Z' }),
      reg({ userId: 'g', partnerId: 'h', status: 'CONFIRMED' }),
    ]);
    const positions = waitlistPositions(pairs);
    expect(positions.get(pairKeyOf({ userId: 'c', partnerId: 'd', categoryId: 'cat-1' }))).toBe(1);
    expect(positions.get(pairKeyOf({ userId: 'a', partnerId: 'b', categoryId: 'cat-1' }))).toBe(2);
    expect(positions.get(pairKeyOf({ userId: 'e', partnerId: 'f', categoryId: 'cat-2' }))).toBe(1);
    expect(positions.has(pairKeyOf({ userId: 'g', partnerId: 'h', categoryId: 'cat-1' }))).toBe(false);
  });
});

describe('needsForce', () => {
  it('solo los códigos de categoría llena o con cola piden forzar', () => {
    expect(needsForce(new ApiError('llena', 409, 'CATEGORY_FULL'))).toBe(true);
    expect(needsForce(new ApiError('cola', 409, 'CATEGORY_WAITLIST_AHEAD'))).toBe(true);
    expect(needsForce(new ApiError('ya inscrito', 409, 'ALREADY_REGISTERED'))).toBe(false);
    expect(needsForce(new Error('red'))).toBe(false);
  });
});
