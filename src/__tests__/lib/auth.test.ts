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

  describe('login', () => {
    it('lanza error si el rol no es admin', async () => {
      (api.post as any).mockResolvedValueOnce({
        data: { token: 'tok', refreshToken: 'ref', user: { id: '1', name: 'X', email: 'x@x.com', role: 'user' } },
      });
      // GET /users/me devuelve rol de jugador
      (api.get as any).mockResolvedValueOnce({ data: { role: 'user' } });

      await expect(login('x@x.com', 'pass')).rejects.toThrow('No tienes permisos de administrador.');
      expect(removeTokens).toHaveBeenCalledTimes(1);
    });

    it('almacena tokens y devuelve el usuario si el rol es admin', async () => {
      (api.post as any).mockResolvedValueOnce({
        data: { token: 'admin-tok', refreshToken: 'admin-ref', user: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' } },
      });
      (api.get as any).mockResolvedValueOnce({ data: { id: '1', name: 'Admin', email: 'admin@test.com', role: 'admin' } });

      const user = await login('admin@test.com', 'pass');
      expect(setToken).toHaveBeenCalledWith('admin-tok');
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
