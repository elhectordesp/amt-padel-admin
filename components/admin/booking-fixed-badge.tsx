"use client";

/**
 * La marca «Fija» de una reserva que es una fecha de una reserva fija: el icono
 * de repetir y el texto, para que se lea también sin el color. Va en el bloque
 * del calendario, en el listado y en la ficha.
 */

import { Repeat } from "lucide-react";

export function FixedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="Reserva fija: se repite cada semana"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-px text-[10px] font-semibold leading-tight ${className}`}
    >
      <Repeat className="h-3 w-3" aria-hidden />
      Fija
    </span>
  );
}
