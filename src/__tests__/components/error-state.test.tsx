import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '../../../components/admin/error-state';

describe('ErrorState', () => {
  it('muestra el título por defecto', () => {
    render(<ErrorState />);
    expect(screen.getByText('Error al cargar los datos')).toBeInTheDocument();
  });

  it('muestra el mensaje por defecto', () => {
    render(<ErrorState />);
    expect(screen.getByText(/Ha ocurrido un error inesperado/)).toBeInTheDocument();
  });

  it('muestra un título personalizado', () => {
    render(<ErrorState title="Error de red" />);
    expect(screen.getByText('Error de red')).toBeInTheDocument();
  });

  it('muestra un mensaje personalizado', () => {
    render(<ErrorState message="Sin conexión al servidor" />);
    expect(screen.getByText('Sin conexión al servidor')).toBeInTheDocument();
  });

  it('no muestra el botón de reintentar cuando onRetry no está definido', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button', { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it('muestra el botón de reintentar cuando se pasa onRetry', () => {
    render(<ErrorState onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('llama a onRetry al hacer clic en el botón', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
