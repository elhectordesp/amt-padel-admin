import { test, expect } from '@playwright/test';
import { setupAuth, mockApiRoutes, MOCK_TOURNAMENT } from './helpers/fixtures';

test.describe('Torneos', () => {
  test.beforeEach(async ({ context }) => {
    await setupAuth(context);
  });

  test('muestra el botón "Crear torneo"', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/torneos');
    await expect(page.getByRole('link', { name: /crear torneo/i })).toBeVisible();
  });

  test('muestra los torneos en la tabla', async ({ page }) => {
    await mockApiRoutes(page, { tournaments: [MOCK_TOURNAMENT] });
    await page.goto('/torneos');
    // Target the table cell specifically to avoid duplicates with the detail panel
    await expect(page.getByRole('table').getByText('Torneo Verano 2026').first()).toBeVisible();
  });

  test('muestra el estado vacío cuando no hay torneos', async ({ page }) => {
    await mockApiRoutes(page, { tournaments: [] });
    await page.goto('/torneos');
    // The mobile div has sm:hidden — target the table cell visible on desktop
    await expect(page.getByRole('cell', { name: 'No se encontraron torneos' })).toBeVisible();
  });

  test('muestra los filtros de estado (tabs)', async ({ page }) => {
    await mockApiRoutes(page, { tournaments: [MOCK_TOURNAMENT] });
    await page.goto('/torneos');
    await expect(page.getByRole('button', { name: /Todos/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abiertos/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Finalizados/ })).toBeVisible();
  });

  test('el sidebar tiene el enlace a Torneos', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/torneos');
    await expect(page.getByRole('link', { name: 'Torneos' })).toBeVisible();
  });
});
