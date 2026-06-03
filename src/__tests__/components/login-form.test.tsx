import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter:       vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  login: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

import { LoginForm }                  from '../../../app/login/login-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { login }                      from '@/lib/auth';
import { toast }                      from 'sonner';

const mockUseRouter       = vi.mocked(useRouter);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockLogin           = vi.mocked(login);
const mockToastError      = toast.error as ReturnType<typeof vi.fn>;

function submitForm() {
  fireEvent.submit(screen.getByRole('button', { name: /iniciar sesión/i }).closest('form')!);
}

describe('LoginForm', () => {
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined as any);
    mockUseRouter.mockReturnValue({ replace: mockReplace } as any);
    mockUseSearchParams.mockReturnValue({ get: (_k: string) => null } as any);
  });

  it('renderiza los campos de email y contraseña', () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText('admin@amptournaments.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••')).toBeInTheDocument();
  });

  it('el campo de contraseña es de tipo password por defecto', () => {
    render(<LoginForm />);
    expect(screen.getByPlaceholderText('••••••••••')).toHaveAttribute('type', 'password');
  });

  it('alterna la visibilidad de la contraseña al hacer clic en el icono del ojo', () => {
    render(<LoginForm />);
    const input  = screen.getByPlaceholderText('••••••••••');
    const eyeBtn = screen.getAllByRole('button').find((b) => b.getAttribute('type') === 'button')!;
    fireEvent.click(eyeBtn);
    expect(input).toHaveAttribute('type', 'text');
    fireEvent.click(eyeBtn);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('muestra error de validación con email inválido', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'noesunemail');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('Email inválido')).toBeInTheDocument();
    });
  });

  it('muestra error de validación cuando la contraseña está vacía', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('Introduce tu contraseña')).toBeInTheDocument();
    });
  });

  it('llama a login con email y contraseña al enviar el formulario', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••••'), 'mipassword');
    submitForm();
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'mipassword');
    });
  });

  it('redirige a /dashboard tras login exitoso', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••••'), 'mipassword');
    submitForm();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('muestra el error de la API cuando login falla', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Credenciales incorrectas'));
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••••'), 'wrongpass');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('Credenciales incorrectas')).toBeInTheDocument();
    });
    expect(mockToastError).toHaveBeenCalledWith('Credenciales incorrectas');
  });

  it('muestra "Iniciando sesión..." y spinner mientras el formulario se envía', async () => {
    let resolve!: () => void;
    mockLogin.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••••'), 'mipassword');
    submitForm();
    await waitFor(() => {
      expect(screen.getByText('Iniciando sesión...')).toBeInTheDocument();
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
    resolve();
  });
});
