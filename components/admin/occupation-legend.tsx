/**
 * Los tipos de ocupación de una pista que no son reservas, con su color, para
 * la leyenda del calendario (Día y Semana). Son `<li>`: van dentro de la
 * lista de la leyenda.
 */

import { OCCUPATION_KINDS } from "@/lib/utils/court-occupation";

export function OccupationLegendItems() {
  return (
    <>
      {OCCUPATION_KINDS.map((k) => (
        <li key={k.value} className="flex items-center gap-1.5">
          <span className={`h-3 w-5 rounded-sm border ${k.swatch}`} /> {k.label}
        </li>
      ))}
    </>
  );
}
