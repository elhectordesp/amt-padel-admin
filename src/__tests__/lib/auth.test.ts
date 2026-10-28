/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de cookies y api antes de importar auth
vi.mock('js-cookie', () => ({
  default: {
    set:    vi.fn(),
    get:    vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../../lib/api', async (importOriginal) => ({
  // ApiError real: es lo que deja el interceptor en las rutas que no son de login
  ApiError: (await importOriginal<typeof import('../../../lib/api')>()).ApiError,
  TOO_MANY_REQUESTS_MESSAGE: (await importOriginal<typeof import('../../../lib/api')>()).TOO_MANY_REQUESTS_MESSAGE,
  api: {
    post: vi.fn(),
    get:  vi.fn(),
  },
  setToken:        vi.fn(),
  setRefreshToken: vi.fn(),
  removeTokens:    vi.fn(),
  getToken:        vi.fn(),
  getRefreshToken: vi.fn(),
}));

import {
  acceptClubInvite,
  ACTIVATE_LINK_EXPIRED_MESSAGE,
  login,
  logout,
  resetPassword,
  RESET_LINK_EXPIRED_MESSAGE,
} from '../../../lib/auth';
import { api, ApiError, setToken, setRefreshToken, removeTokens, getRefreshToken } from '../../../lib/api';

describe('auth helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  // Fake JWTs: header.base64(payload).sig — only payload matters for decodeJwtPayload
  // btoa('{"role":"user"}')  → eyJyb2xlIjoidXNlciJ9
  // btoa('{"role":"admin"}') → eyJyb2xlIjoiYWRtaW4ifQ==
  const USER_JWT  = 'x.eyJyb2xlIjoidXNlciJ9.x';
  const ADMIN_JWT = 'x.eyJyb2xlIjoiYWRtaW4ifQ==.x';

  describe('login', () => {
    it('lanza error si el rol no es admin', async () => {
      (api.post as any).mockResolvedValueOnce({
        data: { token: USER_JWT, refreshToken: 'ref', user: { id: '1', name: 'X', email: 'x@x.com', role: 'user' } },
      });

      await expect(login('x@x.com', 'pass')).rejects.toThrow('No tienes permisos de administrador.');
      expect(removeTokens).toHaveBeenCalledTimes(1);
    });

    it('almacena tokens y devuelve el usuario si el rol es admin', async () => {
      (api.post as any).mockResolvedValueOnce({
        data: { token: ADMIN_JWT, refreshToken: 'admin-ref', user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' } },
      });

      const user = await login('admin@test.com', 'pass');
      expect(setToken).toHaveBeenCalledWith(ADMIN_JWT);
      expect(setRefreshToken).toHaveBeenCalledWith('admin-ref');
      expect(user).toHaveProperty('role', 'admin');
    });

    it('al admin de un club desactivado por AMT le dice por qué no entra', async () => {
      (api.post as any).mockRejectedValueOnce({
        response: { status: 403, data: { success: false, code: 'CLUB_DEACTIVATED', error: 'Tu club está desactivado.' } },
      });

      await expect(login('club@test.com', 'pass')).rejects.toThrow(
        'Tu club está desactivado. Contacta con AMT para reactivarlo.',
      );
      expect(setToken).not.toHaveBeenCalled();
    });

    it('con otro error del back enseña su texto (`error`, no `message`)', async () => {
      (api.post as any).mockRejectedValueOnce({
        response: { status: 503, data: { success: false, error: 'No se pudo enviar el email' } },
      });

      await expect(login('x@x.com', 'pass')).rejects.toThrow('No se pudo enviar el email');
    });

    // P2-17: antes, "ThrottlerException: Too Many Requests" o "Error al conectar con el servidor"
    it.each([
      ['el back de antes', { error: 'ThrottlerException: Too Many Requests' }],
      ['con su código', { code: 'TOO_MANY_REQUESTS', error: 'Demasiados intentos.' }],
    ])('con un 429 (%s) dice que espere', async (_caso, data) => {
      (api.post as any).mockRejectedValueOnce({ response: { status: 429, data: { success: false, ...data } } });

      await expect(login('x@x.com', 'pass')).rejects.toThrow(
        'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
      );
    });
  });

  describe('acceptClubInvite', () => {
    // El interceptor de api.ts convierte el error en ApiError(texto, estado, código)
    it.each([
      ['CLUB_INVITATION_INVALID', 400, 'La invitación es inválida o ha caducado.'],
      ['CLUB_INVITATION_EMAIL_TAKEN', 409, 'Ese email ya está registrado en la plataforma.'],
      ['CLUB_DEACTIVATED', 403, 'Tu club está desactivado. Contacta con AMT para reactivarlo.'],
    ])('%s: su mensaje, no el genérico', async (code, status, message) => {
      (api.post as any).mockRejectedValueOnce(new ApiError('texto del back', status, code));

      await expect(acceptClubInvite('tok', 'Nombre', 'Clave123!')).rejects.toThrow(message);
      expect(setToken).not.toHaveBeenCalled();
    });

    it('otro error: el texto del back', async () => {
      (api.post as any).mockRejectedValueOnce(new ApiError('Algo concreto', 400, 'OTRO'));

      await expect(acceptClubInvite('tok', 'Nombre', 'Clave123!')).rejects.toThrow('Algo concreto');
    });
  });

  // P2-26: la página web del enlace del email llama al mismo endpoint que la app
  describe('resetPassword', () => {
    it('manda el token y la contraseña nueva y no inicia sesión', async () => {
      (api.post as any).mockResolvedValueOnce({ data: { message: 'ok' } });

      await resetPassword('tok', 'Clave123!');

      expect(api.post).toHaveBeenCalledWith('/auth/reset-password', { token: 'tok', newPassword: 'Clave123!' });
      expect(setToken).not.toHaveBeenCalled();
    });

    it.each(['RESET_LINK_INVALID', 'RESET_LINK_USED'])('%s: el enlace caducó o ya se usó', async (code) => {
      (api.post as any).mockRejectedValueOnce(new ApiError('texto del back', 400, code));

      await expect(resetPassword('tok', 'Clave123!')).rejects.toThrow(RESET_LINK_EXPIRED_MESSAGE);
    });

    // Un admin o un club también lo pide, desde el acceso al panel
    it('dice que se pide otro desde la app o desde el acceso al panel', () => {
      for (const message of [RESET_LINK_EXPIRED_MESSAGE, ACTIVATE_LINK_EXPIRED_MESSAGE])
        expect(message).toContain('Pide uno nuevo desde la app o desde el acceso al panel con «¿Olvidaste tu contraseña?»');
    });

    // Quien activa una cuenta puede no tener la app: también, que se la reenvíen
    it('al activar una cuenta, el enlace caducado dice además que pida la invitación otra vez', async () => {
      (api.post as any).mockRejectedValueOnce(new ApiError('texto del back', 400, 'RESET_LINK_INVALID'));

      await expect(resetPassword('tok', 'Clave123!', { activate: true })).rejects.toThrow(
        ACTIVATE_LINK_EXPIRED_MESSAGE,
      );
      expect(ACTIVATE_LINK_EXPIRED_MESSAGE).toContain('pide a quien te invitó que te reenvíe la invitación');
    });

    it('otro error (p. ej. el 429): su texto', async () => {
      (api.post as any).mockRejectedValueOnce(
        new ApiError('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', 429, 'TOO_MANY_REQUESTS'),
      );

      await expect(resetPassword('tok', 'Clave123!')).rejects.toThrow('Demasiados intentos');
    });
  });

  describe('logout', () => {
    it('revoca el refresh token y limpia las cookies', async () => {
      (getRefreshToken as any).mockReturnValueOnce('ref-token');
      (api.post as any).mockResolvedValueOnce({});

      // logout redirige via window.location; mock para evitar error en jsdom
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });

      await logout();
      expect(removeTokens).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, 'location', { value: originalLocation });
    });
  });
});
