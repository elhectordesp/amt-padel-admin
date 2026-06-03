import { test, expect } from '@playwright/test';
import { setupAuth, mockApiRoutes, EXPIRED_TOKEN, MALFORMED_TOKEN } from './helpers/fixtures';

test.describe('Middleware — validación JWT', () => {
  test('token expirado redirige a /login', async ({ context, page }) => {
    await context.addCookies([{
      name:   'amt_admin_token',
      value:  EXPIRED_TOKEN,
      domain: 'localhost',
      path:   '/',
    }]);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('token malformado redirige a /login', async ({ context, page }) => {
    await context.addCookies([{
      name:   'amt_admin_token',
      value:  MALFORMED_TOKEN,
      domain: 'localhost',
      path:   '/',
    }]);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('token válido permite el acceso a rutas protegidas', async ({ context, page }) => {
    await setupAuth(context);
    await mockApiRoutes(page);
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
  });
});
