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

vi.mock('../../../lib/api', () => ({
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

import { login, logout } from '../../../lib/auth';
import { api, setToken, setRefreshToken, removeTokens, getRefreshToken } from '../../../lib/api';

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
