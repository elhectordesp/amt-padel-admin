import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

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

// El rol del token: admin de AMT salvo que el test diga otra cosa
const mockRole = { role: 'admin' as string | null, clubId: null };
vi.mock('@/lib/use-role', () => ({
  useRole: () => mockRole,
  isClub:  (role: string | null) => role === 'club',
}));

vi.mock('@/lib/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/constants')>()),
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
  { id: 't-2', name: 'Open Costa del Sol', startDate: '2026-08-01T00:00:00Z', endDate: '2026-08-03T00:00:00Z', club: { name: 'Pádel Indoor', city: 'Málaga' } },
];
const fakePlayers = [
  { id: 'p-1', name: 'Carlos García', gender: 'M', level: '4a', points: 1200 },
  { id: 'p-2', name: 'Carlos Nuevo', gender: 'M', level: null, points: 0 },
];

function setupOpen() {
  mockUseSearch.mockReturnValue({ open: true, close: mockClose, toggle: mockToggle });
  // Los jugadores los filtra el servidor: aquí, los que coinciden sin tildes
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'tournaments') return { data: fakeTournaments };
    if (queryKey[0] === 'search-players') {
      const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
      const q = fold(queryKey[1] ?? '');
      return { data: { data: q ? fakePlayers.filter((p) => fold(p.name).includes(q)) : [] } };
    }
    return { data: undefined };
  });
}

/** Escribe y deja pasar los 300 ms tras los que se pregunta al servidor. */
function typeQuery(value: string) {
  fireEvent.change(screen.getByPlaceholderText(/buscar torneos/i), { target: { value } });
  act(() => { vi.advanceTimersByTime(300); });
}

describe('SearchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRole.role = 'admin';
  });
  afterEach(() => vi.useRealTimers());

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
    typeQuery('carlos');
    expect(screen.getByText('Carlos García')).toBeInTheDocument();
    expect(screen.getByText(/Masc\. 4ª · 1/)).toBeInTheDocument();
  });

  it('los jugadores se buscan en el servidor con lo escrito, en todos y no solo 50 por género (P3-6)', () => {
    setupOpen();
    render(<SearchModal />);
    typeQuery('garcia');
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['search-players', 'garcia'],
      enabled:  true,
    }));
    // «garcia» (sin tilde) encuentra a «García»: lo resuelve el servidor
    expect(screen.getByText('Carlos García')).toBeInTheDocument();
  });

  it('torneos por nombre, sede o ciudad, sin tildes: «malaga» encuentra Málaga (P3-6)', () => {
    setupOpen();
    render(<SearchModal />);
    typeQuery('malaga');
    expect(screen.getByText('Open Costa del Sol')).toBeInTheDocument();
    typeQuery('indoor');
    expect(screen.getByText('Open Costa del Sol')).toBeInTheDocument();
  });

  it('un club no busca jugadores (no puede abrir su ficha)', () => {
    mockRole.role = 'club';
    setupOpen();
    render(<SearchModal />);
    typeQuery('carlos');
    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ['search-players', 'carlos'],
      enabled:  false,
    }));
  });

  it('un jugador sin categoría sale como «Sin categoría», no como 4ª (D6)', () => {
    setupOpen();
    render(<SearchModal />);
    typeQuery('nuevo');
    expect(screen.getByText('Carlos Nuevo')).toBeInTheDocument();
    expect(screen.getByText('Masc. Sin categoría · 0 pts')).toBeInTheDocument();
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
