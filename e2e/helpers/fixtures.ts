import type { BrowserContext, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';

const JWT_HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

function makeToken(payload: object): string {
  return `${JWT_HEADER}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.fakesig`;
}

/**
 * Fake JWT whose payload decodes to { sub: "1", role: "admin", exp: 9999999999 }.
 * atob(middle part) = '{"sub":"1","role":"admin","exp":9999999999}'
 */
export const FAKE_TOKEN = makeToken({ sub: '1', role: 'admin', exp: 9999999999 });

/** Token with exp=1 (year 1970) — always expired. */
export const EXPIRED_TOKEN = makeToken({ sub: '1', role: 'admin', exp: 1 });

/** Not a JWT at all — three-dot structure missing. */
export const MALFORMED_TOKEN = 'not-a-jwt-at-all';

export const FAKE_REFRESH = 'fake-refresh-token';

// ── Mock payloads ────────────────────────────────────────────────────────────
export const MOCK_ME = { name: 'Admin Test', email: 'admin@test.com' };

export const MOCK_STATS = {
  activeTournaments: 3,
  registeredPlayers: 120,
  scheduledMatches:  15,
};

export const MOCK_TOURNAMENT = {
  id:         't1',
  name:       'Torneo Verano 2026',
  dates:      '2026-07-01',
  club:       { id: 'c1', name: 'Club Padel Test' },
  status:     'UPCOMING',
  categories: [],
  tier:       null,
};

export const MOCK_PLAYER = {
  id:            'p1',
  name:          'Ana García',
  email:         'ana@test.com',
  gender:        'F',
  level:         '3a',
  trend:         'stable',
  rankingPoints: 100,
  points:        100,
  spa:           null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sets the auth cookie so the Next.js middleware lets the request through. */
export async function setupAuth(context: BrowserContext) {
  await context.addCookies([{
    name:   'amt_admin_token',
    value:  FAKE_TOKEN,
    domain: 'localhost',
    path:   '/',
  }]);
}

/**
 * Intercepts all backend API calls and fulfils them with mock data.
 * Must be called before page.goto() so the handler is registered first.
 *
 * Responses are wrapped in { data: ... } to match the axios response
 * interceptor in lib/api.ts, which unwraps `res.data.data → res.data`.
 */
export async function mockApiRoutes(
  page: Page,
  overrides: {
    tournaments?: object[];
    players?:     object[];
    stats?:       object;
  } = {},
) {
  const tournaments = overrides.tournaments ?? [MOCK_TOURNAMENT];
  const players     = overrides.players     ?? [MOCK_PLAYER];
  const stats       = overrides.stats       ?? MOCK_STATS;

  await page.route(
    (url) => url.toString().startsWith(API_URL),
    async (route) => {
      const url    = route.request().url();
      const method = route.request().method();

      // ── Auth ────────────────────────────────────────────────────────────
      if (method === 'POST' && url.includes('/auth/login')) {
        return route.fulfill({
          json: { data: { token: FAKE_TOKEN, refreshToken: FAKE_REFRESH, user: MOCK_ME } },
        });
      }
      if (url.includes('/auth/me')) {
        return route.fulfill({ json: { data: MOCK_ME } });
      }
      if (method === 'POST' && url.includes('/auth/logout')) {
        return route.fulfill({ json: { data: null } });
      }
      if (method === 'POST' && url.includes('/auth/refresh')) {
        return route.fulfill({
          json: { data: { token: FAKE_TOKEN, refreshToken: FAKE_REFRESH } },
        });
      }

      // ── Admin stats (order matters: specific before generic) ─────────────
      if (url.includes('/admin/stats/growth')) {
        return route.fulfill({ json: { data: { growth: 0 } } });
      }
      if (url.includes('/admin/stats/finance')) {
        return route.fulfill({ json: { data: { period: 'month', total: 0 } } });
      }
      if (url.includes('/admin/stats')) {
        return route.fulfill({ json: { data: stats } });
      }

      // ── Admin resources ──────────────────────────────────────────────────
      if (url.includes('/admin/tournaments')) {
        return route.fulfill({ json: { data: tournaments } });
      }
      if (url.includes('/admin/players')) {
        return route.fulfill({
          json: { data: { data: players, total: players.length } },
        });
      }
      if (url.includes('/admin/alerts')) {
        return route.fulfill({ json: { data: [] } });
      }
      if (url.includes('/admin/activity')) {
        return route.fulfill({ json: { data: [] } });
      }
      if (url.includes('/admin/rankings')) {
        return route.fulfill({ json: { data: { data: [], total: 0 } } });
      }

      // Fallback — avoid noise from unhandled routes
      return route.fulfill({ json: { data: null } });
    },
  );
}
