/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { groupByPair, pairKeyOf, pairPlayers, playerPayment } from '../../../lib/utils/registration-pairs';

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
    expect(pair).toMatchObject({ ids: [r.id], primary: r, status: 'CONFIRMED', categoryId: 'cat-1' });
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

  it('la misma pareja en dos categorías: dos parejas', () => {
    const pairs = groupByPair([reg(), reg({ categoryId: 'cat-2' })]);
    expect(pairs.map((p) => p.categoryId)).toEqual(['cat-1', 'cat-2']);
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
