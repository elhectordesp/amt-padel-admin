"use client";

import { pairPlayers, type PaymentPlayer } from "@/lib/utils/registration-pairs";
import type { AdminRegistration } from "@/types";

/**
 * El pago de cada jugador de la pareja (se cobra por jugador): uno debajo
 * del otro, en el orden de la columna de la pareja. Con `withNames`, cada uno
 * con su nombre de pila (para las tarjetas del móvil, sin esa columna al lado).
 */
export function PairPayment({
  registration,
  onEdit,
  withNames = false,
}: {
  registration: AdminRegistration;
  onEdit:       (player: PaymentPlayer) => void;
  withNames?:   boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      {pairPlayers(registration).map(({ player, name, payment }) => (
        <button
          key={player}
          onClick={() => onEdit(player)}
          title={`Pago de ${name}: ver / editar`}
          className={`text-xs font-medium underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-70 ${payment.paid ? "text-green-400" : "text-yellow-400"}`}
        >
          {withNames && <span className="text-muted-foreground font-normal">{name.split(" ")[0]}: </span>}
          {payment.paid ? "Pagado" : "Pendiente"}
        </button>
      ))}
    </div>
  );
}
