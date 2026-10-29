/**
 * Lo que el back no admite en las plazas y el precio de una categoría, con un
 * mensaje que dice qué campo falla (el back responde «Debe ser un número
 * entero» sin decirlo). Los dos son enteros: el precio va en euros, sin
 * céntimos (decisión D8). Plazas, al menos 1; precio, 0 o más. null si valen.
 */
export function categoryNumbersIssue({ totalSpots, price }: { totalSpots: number; price: number }): string | null {
  if (!Number.isInteger(totalSpots) || totalSpots < 1) return "Las plazas son un número entero (mínimo 1)";
  if (!Number.isInteger(price) || price < 0) return "El precio va en euros, sin céntimos (0 si es gratis)";
  return null;
}
