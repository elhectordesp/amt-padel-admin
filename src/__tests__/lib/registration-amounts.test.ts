/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { formatEuros, isUnpaidPair, pairAmount, paymentTotals } from '../../../lib/utils/registration-amounts';
import { groupByPair } from '../../../lib/utils/registration-pairs';

let seq = 0;
const reg = (overrides: any = {}): any => ({
  id:             `reg-${++seq}`,
  tournamentId:   't1',
  categoryId:     'cat-1',
  userId:         `u-${seq}`,
  partnerId:      `p-${seq}`,
  user:           { name: 'Ana López' },
  partner:        { name: 'Bea Ruiz' },
  category:       { gender: 'F', level: '3a', price: 30 },
  status:         'CONFIRMED',
  paid:           false,
  partnerPayment: { paid: false },
  createdAt:      '2026-11-01T10:00:00Z',
  ...overrides,
});
const solo = (overrides: any = {}) => reg({ partnerId: null, partner: null, partnerPayment: null, ...overrides });

describe('pairAmount — precio por pareja, pago por jugador', () => {
  it('el total es el precio de la categoría y cada jugador que ha pagado cuenta la mitad', () => {
    expect(pairAmount(reg())).toEqual({ paid: 0, total: 30 });
    expect(pairAmount(reg({ paid: true }))).toEqual({ paid: 15, total: 30 });
    expect(pairAmount(reg({ partnerPayment: { paid: true } }))).toEqual({ paid: 15, total: 30 });
    expect(pairAmount(reg({ paid: true, partnerPayment: { paid: true } }))).toEqual({ paid: 30, total: 30 });
  });

  it('un precio impar se parte en mitades con céntimos', () => {
    expect(pairAmount(reg({ paid: true, category: { gender: 'M', level: '4a', price: 25 } }))).toEqual({ paid: 12.5, total: 25 });
  });

  it('sin compañero, el total sigue siendo el de la pareja: su mitad queda pendiente', () => {
    expect(pairAmount(solo({ paid: true }))).toEqual({ paid: 15, total: 30 });
  });

  it('el pago del titular no cuenta por el compañero', () => {
    expect(pairAmount(reg({ paid: true, partnerPayment: { paid: false } })).paid).toBe(15);
  });
});

describe('isUnpaidPair — el filtro «Sin pagar»', () => {
  const pairOf = (r: any) => groupByPair([r])[0];

  it('una viva a la que le falta pagar a alguno de sus jugadores', () => {
    expect(isUnpaidPair(pairOf(reg({ paid: true })))).toBe(true);
    expect(isUnpaidPair(pairOf(reg({ partnerPayment: { paid: true } })))).toBe(true);
    expect(isUnpaidPair(pairOf(reg({ status: 'WAITLIST' })))).toBe(true);
    expect(isUnpaidPair(pairOf(reg({ status: 'PENDING' })))).toBe(true);
  });

  it('con todos sus jugadores pagados, no', () => {
    expect(isUnpaidPair(pairOf(reg({ paid: true, partnerPayment: { paid: true } })))).toBe(false);
  });

  it('sin compañero solo cuenta el titular (no hay a quién cobrar la otra mitad)', () => {
    expect(isUnpaidPair(pairOf(solo({ paid: true })))).toBe(false);
    expect(isUnpaidPair(pairOf(solo()))).toBe(true);
  });

  it('una cancelada nunca, aunque no haya pagado nadie', () => {
    expect(isUnpaidPair(pairOf(reg({ status: 'CANCELLED' })))).toBe(false);
  });
});

describe('paymentTotals — el resumen de cobros del torneo', () => {
  it('suma lo cobrado y el total de las parejas no canceladas; lo pendiente es la resta', () => {
    const pairs = groupByPair([
      reg({ paid: true, partnerPayment: { paid: true } }),                          // 30 de 30
      reg({ paid: true }),                                                           // 15 de 30
      reg({ status: 'PENDING', category: { gender: 'M', level: '4a', price: 25 } }), // 0 de 25
      solo({ status: 'WAITLIST', paid: true }),                                      // 15 de 30
      reg({ status: 'CANCELLED', paid: true, partnerPayment: { paid: true } }),      // no cuenta
    ]);
    expect(paymentTotals(pairs)).toEqual({ collected: 60, pending: 55, total: 115 });
  });

  it('una pareja espejo antigua (dos filas) cuenta una vez', () => {
    const ab = reg({ userId: 'a', partnerId: 'b', paid: true, partnerPayment: { paid: true } });
    const ba = reg({ userId: 'b', partnerId: 'a', paid: true, partnerPayment: { paid: true } });
    expect(paymentTotals(groupByPair([ab, ba]))).toEqual({ collected: 30, pending: 0, total: 30 });
  });

  it('sin parejas, todo a cero', () => {
    expect(paymentTotals([])).toEqual({ collected: 0, pending: 0, total: 0 });
  });
});

describe('formatEuros', () => {
  it('coma decimal y siempre dos decimales, como Finanzas', () => {
    expect(formatEuros(30)).toBe('30,00 €');
    expect(formatEuros(12.5)).toBe('12,50 €');
    expect(formatEuros(0)).toBe('0,00 €');
  });
});
