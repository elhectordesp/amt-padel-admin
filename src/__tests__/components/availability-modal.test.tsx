import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQuery:       vi.fn(),
  useMutation:    vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock('@/lib/services/admin', () => ({
  adminService: {
    tournaments: { registrationAvailability: vi.fn() },
  },
}));

import { AvailabilityModal } from '../../../components/admin/availability-modal';
import { useQuery } from '@tanstack/react-query';

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;

function makeDay(overrides: Record<string, unknown> = {}) {
  return {
    dayId:           'day-1',
    label:           'Sábado',
    allSlots:        ['10:00', '11:00', '12:00'],
    unavailableSlots: [],
    fullAvailability: false,
    ...overrides,
  };
}

describe('AvailabilityModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra spinner mientras carga', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('muestra mensaje cuando no hay datos', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText(/no ha indicado su disponibilidad/i)).toBeInTheDocument();
  });

  it('muestra mensaje cuando days está vacío', () => {
    mockUseQuery.mockReturnValue({ data: { player1: 'Ana', player2: null, days: [] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText(/no ha indicado su disponibilidad/i)).toBeInTheDocument();
  });

  it('muestra los nombres de ambos jugadores en el header', () => {
    mockUseQuery.mockReturnValue({ data: { player1: 'Ana', player2: 'Bea', days: [] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText(/Ana \/ Bea/)).toBeInTheDocument();
  });

  it('muestra solo el nombre del primer jugador si no hay pareja', () => {
    mockUseQuery.mockReturnValue({ data: { player1: 'Carlos', player2: null, days: [] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText(/Carlos/)).toBeInTheDocument();
  });

  it('muestra el label del día', () => {
    const day = makeDay({ label: 'Domingo', fullAvailability: true });
    mockUseQuery.mockReturnValue({ data: { player1: 'Ana', player2: null, days: [day] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText('Domingo')).toBeInTheDocument();
  });

  it('muestra "Disponible todo el día" para días con fullAvailability', () => {
    const day = makeDay({ fullAvailability: true });
    mockUseQuery.mockReturnValue({ data: { player1: 'Ana', player2: null, days: [day] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText('Disponible todo el día')).toBeInTheDocument();
  });

  it('muestra "No disponible" cuando todos los slots están bloqueados', () => {
    const day = makeDay({ unavailableSlots: ['10:00', '11:00', '12:00'] });
    mockUseQuery.mockReturnValue({ data: { player1: 'Ana', player2: null, days: [day] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText('No disponible')).toBeInTheDocument();
  });

  it('muestra "Disponibilidad parcial" cuando algunos slots están bloqueados', () => {
    const day = makeDay({ unavailableSlots: ['10:00'] });
    mockUseQuery.mockReturnValue({ data: { player1: 'Ana', player2: null, days: [day] }, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={vi.fn()} />);
    expect(screen.getByText('Disponibilidad parcial')).toBeInTheDocument();
  });

  it('llama a onClose al hacer clic en el botón X del header', () => {
    const onClose = vi.fn();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={onClose} />);
    const allButtons = screen.getAllByRole('button');
    const xBtn = allButtons.find((b) => !b.textContent?.trim());
    fireEvent.click(xBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el botón Cerrar del footer', () => {
    const onClose = vi.fn();
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
    render(<AvailabilityModal registrationId="reg-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
