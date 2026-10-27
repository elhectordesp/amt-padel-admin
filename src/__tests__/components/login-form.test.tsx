/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter:       vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  login: vi.fn(),
}));

// La caché de React Query: el login la vacía (nada de la cuenta anterior)
const mockClearCache = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ clear: mockClearCache }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/lib/account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/account')>()),
  requestPasswordReset: vi.fn(),
}));

import { LoginForm }                  from '../../../app/login/login-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { login }                      from '@/lib/auth';
import { toast }                      from 'sonner';
import { requestPasswordReset }       from '@/lib/account';
import { ApiError }                   from '@/lib/api';

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
    mockUseSearchParams.mockReturnValue({ get: () => null } as any);
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

  it('redirige a /dashboard tras login exitoso, con la caché vacía', async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••••'), 'mipassword');
    submitForm();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
    expect(mockClearCache).toHaveBeenCalledTimes(1);
  });

  it('si le echaron porque AMT desactivó su club (?motivo=club-desactivado), lo explica', () => {
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'motivo' ? 'club-desactivado' : null),
    } as any);
    render(<LoginForm />);
    expect(
      screen.getByText('Tu club está desactivado. Contacta con AMT para reactivarlo.'),
    ).toBeInTheDocument();
  });

  it('vuelve a la ruta del panel de ?from= tras entrar', async () => {
    mockUseSearchParams.mockReturnValue({ get: () => '/torneos?status=OPEN' } as any);
    render(<LoginForm />);
    await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'admin@test.com');
    await userEvent.type(screen.getByPlaceholderText('••••••••••'), 'mipassword');
    submitForm();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/torneos?status=OPEN');
    });
  });

  it('con ?from= de otra web va al dashboard (antes llevaba a esa web: redirección abierta)', async () => {
    mockUseSearchParams.mockReturnValue({ get: () => 'https://web-ajena.example/login' } as any);
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
    mockLogin.mockImplementationOnce(() => new Promise((r) => { resolve = r as unknown as () => void; }));
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

  it('si le echaron por no tener acceso al panel (?motivo=sin-acceso), se lo dice (P2-16)', () => {
    mockUseSearchParams.mockReturnValue({ get: (k: string) => (k === 'motivo' ? 'sin-acceso' : null) } as any);
    render(<LoginForm />);
    expect(screen.getByText(/no tiene acceso al panel/i)).toBeInTheDocument();
  });

  describe('«¿Olvidaste la contraseña?»', () => {
    const mockRequest = vi.mocked(requestPasswordReset);

    it('pide el email con el que entra (el que ya había escrito) y manda el enlace', async () => {
      mockRequest.mockResolvedValueOnce(undefined);
      render(<LoginForm />);
      await userEvent.type(screen.getByPlaceholderText('admin@amptournaments.com'), 'ana@club.es');
      fireEvent.click(screen.getByRole('button', { name: /olvidaste la contraseña/i }));

      const email = screen.getByLabelText(/email/i);
      expect(email).toHaveValue('ana@club.es');
      fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));

      await waitFor(() => expect(screen.getByText(/te llegará un email/i)).toBeInTheDocument());
      expect(mockRequest).toHaveBeenCalledWith('ana@club.es');
    });

    it('con un email mal escrito no llama al servidor', async () => {
      render(<LoginForm />);
      fireEvent.click(screen.getByRole('button', { name: /olvidaste la contraseña/i }));
      await userEvent.type(screen.getByLabelText(/email/i), 'no-es-un-email');
      fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));
      expect(await screen.findByText(/escribe un email válido/i)).toBeInTheDocument();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('con demasiados intentos (429) lo dice claro', async () => {
      mockRequest.mockRejectedValueOnce(new ApiError('ThrottlerException: Too Many Requests', 429));
      render(<LoginForm />);
      fireEvent.click(screen.getByRole('button', { name: /olvidaste la contraseña/i }));
      await userEvent.type(screen.getByLabelText(/email/i), 'ana@club.es');
      fireEvent.click(screen.getByRole('button', { name: /enviar enlace/i }));
      expect(await screen.findByText(/demasiados intentos/i)).toBeInTheDocument();
    });

    it('«Volver a iniciar sesión» vuelve al formulario', () => {
      render(<LoginForm />);
      fireEvent.click(screen.getByRole('button', { name: /olvidaste la contraseña/i }));
      fireEvent.click(screen.getByRole('button', { name: /volver a iniciar sesión/i }));
      expect(screen.getByPlaceholderText('••••••••••')).toBeInTheDocument();
    });
  });
});
