import { test, expect } from '@playwright/test';
import { setupAuth, mockApiRoutes, MOCK_PLAYER } from './helpers/fixtures';

test.describe('Jugadores', () => {
  test.beforeEach(async ({ context }) => {
    await setupAuth(context);
  });

  test('muestra el campo de búsqueda', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/jugadores');
    await expect(
      page.getByPlaceholder('Buscar por nombre, email o teléfono...'),
    ).toBeVisible();
  });

  test('muestra jugadores en la tabla', async ({ page }) => {
    await mockApiRoutes(page, { players: [MOCK_PLAYER] });
    await page.goto('/jugadores');
    await expect(page.getByRole('table').getByText('Ana García')).toBeVisible();
  });

  test('muestra el estado vacío cuando no hay jugadores', async ({ page }) => {
    await mockApiRoutes(page, { players: [] });
    await page.goto('/jugadores');
    await expect(page.getByText('No se encontraron jugadores')).toBeVisible();
  });

  test('muestra los filtros de género (Masc./Fem.)', async ({ page }) => {
    await mockApiRoutes(page);
    await page.goto('/jugadores');
    await expect(page.getByRole('button', { name: 'Masc.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fem.' })).toBeVisible();
  });
});
