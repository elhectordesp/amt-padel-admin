import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockPush   = vi.fn();
const mockClose  = vi.fn();
const mockToggle = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/lib/services/admin', () => ({
  adminService: {
    tournaments: { list: vi.fn() },
    players:     { list: vi.fn() },
  },
}));

vi.mock('@/components/admin/search-context', () => ({
  useSearch: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  CATEGORY_LABEL_SHORT: { '4a': '4ª', '3a': '3ª' },
  GENDER_LABEL:         { M: { short: 'Masc.' }, F: { short: 'Fem.' } },
}));

import { SearchModal } from '../../../components/admin/search-modal';
import { useQuery }    from '@tanstack/react-query';
import { useSearch }   from '@/components/admin/search-context';

const mockUseQuery  = useQuery  as ReturnType<typeof vi.fn>;
const mockUseSearch = useSearch as ReturnType<typeof vi.fn>;

const fakeTournaments = [
  { id: 't-1', name: 'Torneo Madrid', startDate: '2026-07-01T00:00:00Z', endDate: '2026-07-03T00:00:00Z', club: { name: 'Club A' } },
];
const fakePlayers = [
  { id: 'p-1', name: 'Carlos García', gender: 'M', level: '4a', points: 1200 },
];

function setupOpen() {
  mockUseSearch.mockReturnValue({ open: true, close: mockClose, toggle: mockToggle });
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'tournaments') return { data: fakeTournaments };
    if (queryKey[1] === 'M') return { data: { data: fakePlayers } };
    return { data: { data: [] } };
  });
}

describe('SearchModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no renderiza nada cuando open=false', () => {
    mockUseSearch.mockReturnValue({ open: false, close: mockClose, toggle: mockToggle });
    mockUseQuery.mockReturnValue({ data: [] });
    const { container } = render(<SearchModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza el input de búsqueda cuando open=true', () => {
    setupOpen();
    render(<SearchModal />);
    expect(screen.getByPlaceholderText(/buscar torneos/i)).toBeInTheDocument();
  });

  it('muestra mensaje de ayuda con query vacío', () => {
    setupOpen();
    render(<SearchModal />);
    expect(screen.getByText(/escribe para buscar/i)).toBeInTheDocument();
  });

  it('muestra "Sin resultados" cuando el query no coincide con nada', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.change(screen.getByPlaceholderText(/buscar torneos/i), { target: { value: 'xyzabc123' } });
    expect(screen.getByText(/sin resultados/i)).toBeInTheDocument();
  });

  it('muestra resultados de torneos cuando el query coincide', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.change(screen.getByPlaceholderText(/buscar torneos/i), { target: { value: 'madrid' } });
    expect(screen.getByText('Torneo Madrid')).toBeInTheDocument();
  });

  it('muestra resultados de jugadores cuando el query coincide', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.change(screen.getByPlaceholderText(/buscar torneos/i), { target: { value: 'carlos' } });
    expect(screen.getByText('Carlos García')).toBeInTheDocument();
  });

  it('llama a router.push y close() al hacer clic en un resultado', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.change(screen.getByPlaceholderText(/buscar torneos/i), { target: { value: 'madrid' } });
    fireEvent.click(screen.getByText('Torneo Madrid').closest('button')!);
    expect(mockPush).toHaveBeenCalledWith('/torneos/t-1');
    expect(mockClose).toHaveBeenCalled();
  });

  it('cierra el modal con Escape', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockClose).toHaveBeenCalled();
  });

  it('alterna el modal con Ctrl+K', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(mockToggle).toHaveBeenCalled();
  });

  it('alterna el modal con Cmd+K (metaKey)', () => {
    setupOpen();
    render(<SearchModal />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(mockToggle).toHaveBeenCalled();
  });

  it('limpia el query al hacer clic en el botón X del input', () => {
    setupOpen();
    render(<SearchModal />);
    const input = screen.getByPlaceholderText(/buscar torneos/i);
    fireEvent.change(input, { target: { value: 'madrid' } });
    expect(screen.getByText('Torneo Madrid')).toBeInTheDocument();
    // X clear button appears inside the input wrapper; it's the only button-type=button inside header
    const headerArea = input.closest('div')!.parentElement!;
    const clearBtn = headerArea.querySelector('button');
    fireEvent.click(clearBtn!);
    expect(screen.getByText(/escribe para buscar/i)).toBeInTheDocument();
  });

  it('llama a close() al hacer clic en el backdrop', () => {
    setupOpen();
    const { container } = render(<SearchModal />);
    const backdrop = container.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(mockClose).toHaveBeenCalled();
  });
});
