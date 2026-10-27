/** Filas por página que se pueden elegir en los listados del panel. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 50;

/** Número de páginas (al menos una, aunque no haya filas). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * La página (desde 1) dentro de las que hay: al filtrar o borrar filas, la
 * página en la que se estaba puede haber dejado de existir y se quedaba en
 * blanco.
 */
export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}

/** Las filas de una página (desde 1), ya ajustada a las que hay. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number): T[] {
  const p = clampPage(page, items.length, pageSize);
  return items.slice((p - 1) * pageSize, p * pageSize);
}

/** Primera y última fila (desde 1) de la página, para «Mostrando 26–50 de 230». */
export function pageRange(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const p = clampPage(page, total, pageSize);
  return { from: (p - 1) * pageSize + 1, to: Math.min(p * pageSize, total) };
}
