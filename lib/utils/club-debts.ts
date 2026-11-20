import type { DebtOrigin, DebtStatus, DebtStatusFilter } from "@/lib/services/club-debts";

/** Lo que enseña la píldora del plazo de una deuda abierta. */
export interface DebtPillInfo {
  label:  string;
  /** El último día: va resaltada. */
  urgent: boolean;
}

/**
 * «Día n de N» o «Último día»; de largo plazo, «Largo plazo»; sin plazo en el
 * club, solo «Día n».
 */
export function debtPill(d: {
  dayNumber:  number;
  expiryDays: number | null;
  lastDay:    boolean;
  longTerm:   boolean;
}): DebtPillInfo {
  if (d.longTerm) return { label: "Largo plazo", urgent: false };
  if (d.lastDay) return { label: "Último día", urgent: true };
  return {
    label:  d.expiryDays === null ? `Día ${d.dayNumber}` : `Día ${d.dayNumber} de ${d.expiryDays}`,
    urgent: false,
  };
}

export const DEBT_STATUS_LABEL: Record<DebtStatus, string> = {
  OPEN:     "Abierta",
  PAID:     "Cobrada",
  FORGIVEN: "Perdonada",
  LOST:     "Perdida",
};

export const DEBT_FILTERS: { id: DebtStatusFilter; label: string }[] = [
  { id: "OPEN",     label: "Abiertas" },
  { id: "PAID",     label: "Cobradas" },
  { id: "FORGIVEN", label: "Perdonadas" },
  { id: "LOST",     label: "Perdidas" },
];

export const DEBT_ORIGIN_LABEL: Record<DebtOrigin, string> = {
  BOOKING_PART: "Parte de reserva",
  SALE:         "Venta",
  MANUAL:       "Apuntada a mano",
};
