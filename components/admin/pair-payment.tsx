"use client";

import { formatEuros, pairAmount } from "@/lib/utils/registration-amounts";
import { pairPlayers, type PaymentPlayer } from "@/lib/utils/registration-pairs";
import type { AdminRegistration } from "@/types";

/**
 * El pago de cada jugador de la pareja (se cobra por jugador): uno debajo
 * del otro, en el orden de la columna de la pareja, y debajo lo pagado de la
 * pareja sobre su total. Con `withNames`, cada uno con su nombre (para las
 * tarjetas del móvil, sin esa columna al lado). Con `readOnly` (sin permiso
 * de caja, que es quien cobra) el estado se ve pero no se abre el pago.
 */
export function PairPayment({
  registration,
  onEdit,
  withNames = false,
  readOnly = false,
}: {
  registration: AdminRegistration;
  onEdit:       (player: PaymentPlayer) => void;
  withNames?:   boolean;
  readOnly?:    boolean;
}) {
  const amount = pairAmount(registration);
  return (
    // min-w-0: dentro de una fila flex, sin él no se recorta el nombre y empuja lo de al lado
    <div className="flex flex-col items-start gap-0.5 min-w-0">
      {pairPlayers(registration).map(({ player, name, payment }) => {
        const tone = payment.paid ? "text-green-400" : "text-yellow-400";
        // El nombre entero (dos compañeros pueden llamarse igual), cortado si no cabe
        const label = (
          <>
            {withNames && <span className="truncate text-muted-foreground font-normal">{name.trim()}:&nbsp;</span>}
            <span className="shrink-0">{payment.paid ? "Pagado" : "Pendiente"}</span>
          </>
        );
        return readOnly ? (
          <span key={player} className={`flex max-w-full text-xs font-medium ${tone}`}>{label}</span>
        ) : (
          <button
            key={player}
            onClick={() => onEdit(player)}
            title={`Pago de ${name}: ver / editar`}
            className={`flex max-w-full text-xs font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70 ${tone}`}
          >
            {label}
          </button>
        );
      })}
      <span className="text-[10px] text-muted-foreground whitespace-nowrap" title="Pagado / total de la pareja">
        {formatEuros(amount.paid)} / {formatEuros(amount.total)}
      </span>
    </div>
  );
}
