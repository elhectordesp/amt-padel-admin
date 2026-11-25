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

// Los socios a cuyo móvil puede llegar un Bizum (undefined: el módulo Cuentas apagado)
let receivers: { id: string; name: string; active: boolean }[] | undefined;
vi.mock('@/lib/use-bizum-receivers', () => ({ useBizumReceivers: () => receivers }));

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
  paymentMethod: 'CARD',
  paidAmountCents: 1500,
  paidAt:        '2026-05-02T00:00:00.000Z',
  paymentNote:   'nota de Ana',
  partnerPayment: { paid: true, paymentMethod: 'CASH', paidAmountCents: 1200, paidAt: '2026-05-03T00:00:00.000Z', paymentNote: 'nota de Bea' },
  createdAt:     '2026-05-01T10:00:00Z',
};

describe('PaymentModal (pago por jugador)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutationOptions = undefined;
    pending = false;
    receivers = undefined;
  });

  it('con el módulo Cuentas, un Bizum pide el móvil y manda el socio de ese jugador', async () => {
    receivers = [{ id: 's1', name: 'Marta', active: true }];
    render(<PaymentModal registration={registration} player="titular" tournamentId="t1" clubId="c1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bizum' }));
    // Sin elegir a qué móvil llegó, no se guarda
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Marta' }));
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
    await mutationOptions.mutationFn();
    expect(adminService.registrations.updatePayment).toHaveBeenCalledWith('reg-1', expect.objectContaining({
      paymentMethod: 'BIZUM', bizumPartnerId: 's1', player: 'titular', playerId: 'u-ana',
    }));
  });

  it('sin el módulo Cuentas, un Bizum se guarda sin pedir el móvil', async () => {
    render(<PaymentModal registration={registration} player="titular" tournamentId="t1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bizum' }));
    expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
    await mutationOptions.mutationFn();
    const sent = vi.mocked(adminService.registrations.updatePayment).mock.calls[0][1];
    expect(sent).not.toHaveProperty('bizumPartnerId');
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
      paymentMethod: 'CASH',
      paidAmountCents: 1200,
      paymentNote:   'pagó en efectivo',
      player:        'partner',
      playerId:      'u-bea',
    });
  });

  it('al cobrar a quien no tenía pago, propone la mitad del precio y guarda método, importe y fecha de hoy', async () => {
    render(
      <PaymentModal
        registration={{ ...registration, partnerPayment: { paid: false, paymentMethod: null, paidAt: null, paymentNote: null } }}
        player="partner"
        tournamentId="t1"
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Pagado').parentElement!.querySelector('button')!);
    expect(screen.getByLabelText('Importe cobrado')).toHaveValue('15,00');
    // Hay que elegir el método para guardar
    expect(screen.getByText('Guardar').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Bizum' }));
    fireEvent.change(screen.getByLabelText('Importe cobrado'), { target: { value: '14' } });
    expect(screen.getByText('Guardar').closest('button')).not.toBeDisabled();
    await mutationOptions.mutationFn();
    expect(adminService.registrations.updatePayment).toHaveBeenCalledWith('reg-1', expect.objectContaining({
      paid: true, paymentMethod: 'BIZUM', paidAmountCents: 1400,
    }));
    // El hoy que rellena el formulario no se manda: el back pone el instante
    expect(vi.mocked(adminService.registrations.updatePayment).mock.calls[0][1].paidAt).toBeUndefined();
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

  it('sin pagar, la nota se ve; al desmarcar un pago no manda su método ni su fecha', async () => {
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Pagado').parentElement!.querySelector('button')!);
    expect(screen.getByDisplayValue('nota de Bea')).toBeInTheDocument();
    await mutationOptions.mutationFn();
    expect(adminService.registrations.updatePayment).toHaveBeenCalledWith('reg-1', expect.objectContaining({
      paid: false, paymentMethod: undefined, paidAmountCents: undefined, paidAt: undefined, paymentNote: 'nota de Bea',
    }));
  });

  it('el pago del compañero de una inscripción sin pareja no se puede guardar', () => {
    render(
      <PaymentModal
        registration={{ ...registration, partnerId: null, partner: null }}
        player="partner"
        tournamentId="t1"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Guardar').closest('button')).toBeDisabled();
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

  it('sin cambiar la fecha no manda paidAt (el back conserva el instante del pago); cambiandola, si', async () => {
    render(<PaymentModal registration={registration} player="partner" tournamentId="t1" onClose={vi.fn()} />);
    await mutationOptions.mutationFn();
    expect(vi.mocked(adminService.registrations.updatePayment).mock.calls[0][1].paidAt).toBeUndefined();

    fireEvent.change(screen.getByDisplayValue('2026-05-03'), { target: { value: '2026-05-10' } });
    await mutationOptions.mutationFn();
    expect(vi.mocked(adminService.registrations.updatePayment).mock.calls[1][1].paidAt).toBe('2026-05-10');
  });

  it('la fecha de pago es el día local del instante: un pago de las 00:30 en Madrid no sale con el día anterior', () => {
    // 23:30 UTC del 24 son las 00:30 del 25 en Madrid (los tests corren en Europe/Madrid: vitest.config.ts)
    render(
      <PaymentModal
        registration={{ ...registration, paidAt: '2026-11-24T23:30:00.000Z' }}
        player="titular"
        tournamentId="t1"
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('2026-11-25')).toBeInTheDocument();
  });

  describe('móvil del Bizum (el back conserva el que tenía si no se manda)', () => {
    const sent = (call: number) => vi.mocked(adminService.registrations.updatePayment).mock.calls[call][1];
    // Un Bizum ya cobrado al socio s1, que se dio de baja: no sale entre los activos
    const bizumDeS1 = { ...registration, paymentMethod: 'BIZUM', bizumPartnerId: 's1' };

    beforeEach(() => {
      receivers = [{ id: 's2', name: 'Luis', active: true }];
    });

    it('editar un Bizum sin tocar el móvil no lo manda (un socio de baja no hace fallar un cambio de nota)', async () => {
      render(<PaymentModal registration={bizumDeS1} player="titular" tournamentId="t1" clubId="c1" onClose={vi.fn()} />);
      fireEvent.change(screen.getByDisplayValue('nota de Ana'), { target: { value: 'nota nueva' } });
      expect(screen.getByRole('button', { name: /Guardar/ })).toBeEnabled();
      await mutationOptions.mutationFn();
      expect(sent(0)).toMatchObject({ paymentMethod: 'BIZUM', paymentNote: 'nota nueva' });
      expect(sent(0)).not.toHaveProperty('bizumPartnerId');
    });

    it('un Bizum que llegó a la cuenta del club (null), sin tocar, tampoco lo manda', async () => {
      render(
        <PaymentModal registration={{ ...bizumDeS1, bizumPartnerId: null }} player="titular" tournamentId="t1" clubId="c1" onClose={vi.fn()} />,
      );
      await mutationOptions.mutationFn();
      expect(sent(0)).not.toHaveProperty('bizumPartnerId');
    });

    it('cambiando el móvil lo manda: a otro socio o a la cuenta del club (null)', async () => {
      render(<PaymentModal registration={bizumDeS1} player="titular" tournamentId="t1" clubId="c1" onClose={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Luis' }));
      await mutationOptions.mutationFn();
      expect(sent(0)).toHaveProperty('bizumPartnerId', 's2');

      fireEvent.click(screen.getByRole('button', { name: 'Club' }));
      await mutationOptions.mutationFn();
      expect(sent(1)).toHaveProperty('bizumPartnerId', null);
    });

    it('un primer cobro por Bizum lo manda siempre, también a la cuenta del club (null)', async () => {
      render(
        <PaymentModal
          registration={{ ...registration, paid: false, paymentMethod: null, bizumPartnerId: null, paidAmountCents: null, paidAt: null }}
          player="titular"
          tournamentId="t1"
          clubId="c1"
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText('Pagado').parentElement!.querySelector('button')!);
      fireEvent.click(screen.getByRole('button', { name: 'Bizum' }));
      fireEvent.click(screen.getByRole('button', { name: 'Club' }));
      await mutationOptions.mutationFn();
      expect(sent(0)).toHaveProperty('bizumPartnerId', null);
    });
  });
});
