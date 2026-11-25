import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services/admin', () => ({
  adminService: { registrations: { updatePayment: vi.fn().mockResolvedValue({}) } },
}));
vi.mock('@/lib/services/bookings', () => ({
  bookingsService: { bookings: { markPaid: vi.fn().mockResolvedValue({}) } },
}));

import { collectDebt } from '../../../components/admin/caja-debts';
import { adminService } from '@/lib/services/admin';
import { bookingsService } from '@/lib/services/bookings';

type CounterDebt = Parameters<typeof collectDebt>[0];
const registrationDebt = {
  source: 'REGISTRATION', refId: 'reg-1', slot: 'partner', playerId: 'u-bea', amountCents: 1500,
} as CounterDebt;
const bookingDebt = { source: 'BOOKING', refId: 'b-1', amountCents: 1500 } as CounterDebt;

describe('collectDebt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('una inscripcion cobrada por Bizum lleva el movil (bizumPartnerId)', async () => {
    await collectDebt(registrationDebt, 'BIZUM', 1500, 's1');
    expect(adminService.registrations.updatePayment).toHaveBeenCalledWith('reg-1', {
      paid: true, paymentMethod: 'BIZUM', paidAmountCents: 1500, bizumPartnerId: 's1', player: 'partner', playerId: 'u-bea',
    });
  });

  it('con efectivo o sin movil elegido, no manda bizumPartnerId', async () => {
    await collectDebt(registrationDebt, 'CASH', 1500, 's1');
    await collectDebt(registrationDebt, 'BIZUM', 1500);
    for (const call of vi.mocked(adminService.registrations.updatePayment).mock.calls) {
      expect(call[1]).not.toHaveProperty('bizumPartnerId');
    }
  });

  it('una reserva cobrada por Bizum sigue mandando el movil', async () => {
    await collectDebt(bookingDebt, 'BIZUM', 1500, null);
    expect(bookingsService.bookings.markPaid).toHaveBeenCalledWith('b-1', { method: 'BIZUM', amountCents: 1500, bizumPartnerId: null });
  });
});
