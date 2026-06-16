/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  logout: vi.fn(),
}));

import { LogoutModal }    from '../../../components/admin/logout-modal';
import { useQueryClient } from '@tanstack/react-query';
import { logout }         from '@/lib/auth';

const mockUseQueryClient = vi.mocked(useQueryClient);
const mockLogout         = vi.mocked(logout);

describe('LogoutModal', () => {
  let mockClear: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClear = vi.fn();
    mockUseQueryClient.mockReturnValue({ clear: mockClear } as any);
  });

  it('no renderiza nada cuando open=false', () => {
    const { container } = render(<LogoutModal open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra el título y la descripción cuando open=true', () => {
    render(<LogoutModal open={true} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.getByText(/¿Seguro que quieres cerrar sesión/)).toBeInTheDocument();
  });

  it('llama a onClose al hacer clic en Cancelar', () => {
    const onClose = vi.fn();
    render(<LogoutModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el botón X', () => {
    const onClose = vi.fn();
    render(<LogoutModal open={true} onClose={onClose} />);
    const allButtons = screen.getAllByRole('button');
    const xBtn = allButtons.find((b) => !b.textContent?.trim());
    fireEvent.click(xBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<LogoutModal open={true} onClose={onClose} />);
    const backdrop = container.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a logout() con qc.clear() al hacer clic en el botón de confirmación', () => {
    render(<LogoutModal open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
    const cb = mockLogout.mock.calls[0][0] as () => void;
    cb();
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
