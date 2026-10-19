/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const invalidateQueries = vi.fn();
let mutationOptions: any;
let pending = false;
vi.mock('@tanstack/react-query', () => ({
  useMutation:    vi.fn((opts: any) => {
    mutationOptions = opts;
    return { mutate: vi.fn(), isPending: pending };
  }),
  useQueryClient: vi.fn(() => ({ invalidateQueries })),
}));

vi.mock('@/lib/services/admin', () => ({
  adminService: {
    registrations: { updatePayment: vi.fn().mockResolvedValue({}) },
  },
  registrationsQK: { list: (tournamentId: string) => ['registrations', tournamentId] },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PaymentModal from '../../../components/admin/payment-modal';
import { adminService } from '@/lib/services/admin';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

const registration: any = {
  id:            'reg-1',
  tournamentId:  't1',
  categoryId:    'cat-1',
  userId:        'u-ana',
  partnerId:     'u-bea',
  user:          { name: 'Ana López' },
  partner:       { name: 'Bea Ruiz' },
  category:      { gender: 'F', level: '3a', price: 30 },
  status:        'CONFIRMED',
  paid:          true,
  paymentMethod: 'TPV',
  paidAt:        '2026-05-02T00:00:00.000Z',
  paymentNote:   'nota de Ana',
  partnerPayment: { paid: true, paymentMethod: 'Efectivo', paidAt: '2026-05-03T00:00:00.000Z', paymentNote: 'nota de Bea' },
  createdAt:     '2026-05-01T10:00:00Z',
};

describe('PaymentModal (pago por jugador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationOptions = undefined;
    pending = false;
  });

  it('del compañero: su nombre y su pago (no el del titular)', () => {
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={vi.fn()} />);
    expect(screen.getByText('Bea Ruiz')).toBeInTheDocument();
    expect(screen.getByDisplayValue('nota de Bea')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-05-03')).toBeInTheDocument();
  });

  it('del titular: su nombre y el pago de la fila', () => {
    render(<PaymentModal registration={registration} player="titular" tournamentId="t1" onClose={vi.fn()} />);
    expect(screen.getByText('Ana López')).toBeInTheDocument();
    expect(screen.getByDisplayValue('nota de Ana')).toBeInTheDocument();
  });

  it('guarda el del compañero con player y playerId (si le cambian la pareja entretanto, el back no se lo marca a otro)', async () => {
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue('nota de Bea'), { target: { value: 'pagó en efectivo' } });
    await mutationOptions.mutationFn();
    expect(adminService.registrations.updatePayment).toHaveBeenCalledWith('reg-1', {
      paid:          true,
      paymentMethod: 'Efectivo',
      paidAt:        '2026-05-03',
      paymentNote:   'pagó en efectivo',
      player:        'partner',
      playerId:      'u-bea',
    });
  });

  it('guarda el del titular con su id', async () => {
    render(<PaymentModal registration={registration} player="titular" tournamentId="t1" onClose={vi.fn()} />);
    await mutationOptions.mutationFn();
    expect(adminService.registrations.updatePayment).toHaveBeenCalledWith('reg-1', expect.objectContaining({
      player: 'titular', playerId: 'u-ana', paymentNote: 'nota de Ana',
    }));
  });

  it('al guardar, recarga la lista de inscripciones del torneo (la clave que usan las páginas) y cierra', () => {
    const onClose = vi.fn();
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={onClose} />);
    mutationOptions.onSuccess();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['registrations', 't1'] });
    expect(onClose).toHaveBeenCalled();
  });

  it('si la inscripción cambió entretanto, enseña el mensaje del back, recarga la lista y cierra (con la pareja vieja, cada reintento fallaría)', () => {
    const onClose = vi.fn();
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={onClose} />);
    // Como rechaza el interceptor de lib/api.ts
    mutationOptions.onError(
      new ApiError('La inscripción acaba de cambiar: vuelve a cargarla.', 400, 'REGISTRATION_INVALID_TRANSITION'),
    );
    expect(toast.error).toHaveBeenCalledWith('La inscripción acaba de cambiar: vuelve a cargarla.');
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['registrations', 't1'] });
    expect(onClose).toHaveBeenCalled();
  });

  it('con otro error (red, validación), avisa y sigue abierto con lo escrito', () => {
    const onClose = vi.fn();
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={onClose} />);
    mutationOptions.onError(new ApiError('Error de conexión'));
    expect(toast.error).toHaveBeenCalledWith('Error de conexión');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('nota de Bea')).toBeInTheDocument();
  });

  it('mientras guarda no se cierra (la respuesta cerraría el modal que se abriera después)', () => {
    pending = true;
    const onClose = vi.fn();
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('al marcar pagado sin fecha, pone la de hoy en hora local', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 4, 3, 0, 30)); // 00:30 locales del 3 de mayo
    try {
      render(
        <PaymentModal
          registration={{ ...registration, partnerPayment: { paid: false, paymentMethod: null, paidAt: null, paymentNote: null } }}
          player="partner"
          tournamentId="t1"
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText('Pagado').parentElement!.querySelector('button')!);
      expect(screen.getByDisplayValue('2026-05-03')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
