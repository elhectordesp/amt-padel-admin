/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PairPayment } from '../../../components/admin/pair-payment';

const registration = (overrides: any = {}): any => ({
  id:        'reg-1',
  userId:    'u-ana',
  partnerId: 'u-bea',
  user:      { name: 'Ana López' },
  partner:   { name: 'Bea Ruiz' },
  paid:      true,
  partnerPayment: { paid: false },
  ...overrides,
});

describe('PairPayment', () => {
  it('un estado por jugador, en el orden de la pareja', () => {
    render(<PairPayment registration={registration()} onEdit={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Pagado', 'Pendiente']);
    expect(buttons[0]).toHaveAttribute('title', expect.stringContaining('Ana López'));
    expect(buttons[1]).toHaveAttribute('title', expect.stringContaining('Bea Ruiz'));
  });

  it('cada botón abre el pago de su jugador', () => {
    const onEdit = vi.fn();
    render(<PairPayment registration={registration()} onEdit={onEdit} />);
    fireEvent.click(screen.getByText('Pendiente'));
    expect(onEdit).toHaveBeenCalledWith('partner');
    fireEvent.click(screen.getByText('Pagado'));
    expect(onEdit).toHaveBeenCalledWith('titular');
  });

  it('sin pareja, solo el titular', () => {
    render(<PairPayment registration={registration({ partnerId: null, partner: null })} onEdit={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('con withNames, cada uno con su nombre entero (dos compañeros pueden llamarse igual)', () => {
    render(
      <PairPayment
        registration={registration({ user: { name: 'Ana López' }, partner: { name: 'Ana Ruiz' } })}
        onEdit={vi.fn()}
        withNames
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Ana López: Pagado',
      'Ana Ruiz: Pendiente',
    ]);
  });
});
