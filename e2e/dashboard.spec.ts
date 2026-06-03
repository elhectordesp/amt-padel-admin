import { test, expect } from '@playwright/test';
import { setupAuth, mockApiRoutes } from './helpers/fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    await setupAuth(context);
    await mockApiRoutes(page);
  });

  test('muestra las stat cards con sus etiquetas', async ({ page }) => {
    await page.goto('/dashboard');
    // Use exact:true to avoid matching "Torneos activos y próximos" heading
    await expect(page.getByText('Torneos activos', { exact: true })).toBeVisible();
    await expect(page.getByText('Jugadores inscritos', { exact: true })).toBeVisible();
    await expect(page.getByText('Partidos programados', { exact: true })).toBeVisible();
  });

  test('muestra los valores de las stats', async ({ page }) => {
    await page.goto('/dashboard');
    // MOCK_STATS = { activeTournaments: 3, registeredPlayers: 120, scheduledMatches: 15 }
    // Values appear inside the stat cards
    const statsSection = page.locator('.grid').first();
    await expect(statsSection.getByText('3')).toBeVisible();
  });

  test('muestra el sidebar con los enlaces de navegación', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Torneos' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jugadores' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rankings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Inscripciones' })).toBeVisible();
  });

  test('la navegación al listado de torneos funciona desde el sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Torneos' }).click();
    await expect(page).toHaveURL(/\/torneos/, { timeout: 10_000 });
  });

  test('la navegación al listado de jugadores funciona desde el sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Jugadores' }).click();
    await expect(page).toHaveURL(/\/jugadores/, { timeout: 10_000 });
  });
});
