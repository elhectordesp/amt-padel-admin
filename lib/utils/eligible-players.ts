import { adminService } from "@/lib/services/admin";
import type { Gender, Player } from "@/types";

/**
 * Busca jugadores por nombre o email con los géneros que admite una categoría
 * (`genders`, de searchGendersFor; null, todos; [], nadie: ni pregunta al
 * back). La lista del back filtra por
 * un solo género: con dos (la mixta sin la pareja elegida) busca uno por uno y
 * los junta por puntos, el orden de la lista. Filtrar por género deja fuera a
 * quien no lo tiene en su ficha, que no puede jugar una categoría con regla.
 */
export async function searchPlayersForCategory(
  q: string,
  genders: readonly Gender[] | null,
  pageSize = 8,
): Promise<Player[]> {
  if (!genders) return (await adminService.players.list({ q, pageSize })).data;
  if (genders.length === 0) return [];
  const pages = await Promise.all(
    genders.map((gender) => adminService.players.list({ q, gender, pageSize })),
  );
  if (pages.length === 1) return pages[0].data;
  return pages
    .flatMap((page) => page.data)
    .sort((a, b) => b.points - a.points)
    .slice(0, pageSize);
}
