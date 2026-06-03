import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './helpers/fixtures';

test.describe('Autenticación', () => {
  test('la página /login renderiza el formulario', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder('admin@amptournaments.com')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('credenciales incorrectas muestran mensaje de error', async ({ page }) => {
    await page.route(
      (url) => url.toString().includes('/auth/login'),
      (route) => route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
    );
    await page.goto('/login');
    await page.getByPlaceholder('admin@amptournaments.com').fill('malo@test.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    // Error appears both in the form and in the sonner toast — scope to the form
    await expect(page.locator('form').getByText(/email o contraseña incorrectos/i)).toBeVisible();
  });

  test('credenciales correctas redirigen al dashboard', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/login');
    await page.getByPlaceholder('admin@amptournaments.com').fill('admin@test.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('acceso sin token a /dashboard redirige a /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('acceso sin token a /torneos redirige a /login', async ({ page }) => {
    await page.goto('/torneos');
    await expect(page).toHaveURL(/\/login/);
  });
});
