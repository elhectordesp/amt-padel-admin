import { test, expect } from '@playwright/test';
import { setupAuth, mockApiRoutes, MOCK_PLAYER, MOCK_PLAYER_DETAIL } from './helpers/fixtures';

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

  // ── Detalle jugador — modal de confirmación de borrado ────────────────────

  test.describe('modal de confirmación de borrado', () => {
    test.beforeEach(async ({ page }) => {
      await mockApiRoutes(page, { playerDetail: MOCK_PLAYER_DETAIL });
      await page.goto('/jugadores/p1');
    });

    test('el botón Eliminar jugador abre el modal de confirmación', async ({ page }) => {
      await page.getByRole('button', { name: /Eliminar jugador/i }).click();
      await expect(page.getByRole('heading', { name: /Eliminar jugador/i })).toBeVisible();
      await expect(page.getByText(/Esta acción no se puede deshacer/i)).toBeVisible();
    });

    test('el modal muestra el nombre del jugador a eliminar', async ({ page }) => {
      await page.getByRole('button', { name: /Eliminar jugador/i }).click();
      await expect(page.getByText('Ana García')).toBeVisible();
    });

    test('Cancelar cierra el modal sin llamar al DELETE', async ({ page }) => {
      const deleteRequests: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'DELETE') deleteRequests.push(req.url());
      });

      await page.getByRole('button', { name: /Eliminar jugador/i }).click();
      await page.getByRole('button', { name: /Cancelar/i }).click();

      await expect(page.getByRole('heading', { name: /Eliminar jugador/i })).not.toBeVisible();
      expect(deleteRequests).toHaveLength(0);
    });

    test('confirmar eliminación llama al DELETE y redirige a /jugadores', async ({ page }) => {
      let deleteWasCalled = false;
      page.on('request', (req) => {
        if (req.method() === 'DELETE' && req.url().includes('/admin/players/p1')) {
          deleteWasCalled = true;
        }
      });

      await page.getByRole('button', { name: /Eliminar jugador/i }).click();
      // "Eliminar" (exact) targets only the modal confirm button, not the "Eliminar jugador" trigger
      await page.getByRole('button', { name: /^Eliminar$/i }).click();

      await expect(page).toHaveURL(/\/jugadores$/, { timeout: 10_000 });
      expect(deleteWasCalled).toBe(true);
    });
  });
});
