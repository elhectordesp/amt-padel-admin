import type { AdminRegistration, PlayerPayment, RegistrationStatus } from "@/types";

/**
 * Una pareja inscrita en una categoría, una vez aunque vaya en dos filas
 * espejo (A→B y B→A, como inscribía el panel antiguo) o tenga filas
 * canceladas de antes con los mismos jugadores.
 */
export interface PairRegistration {
  pairKey:    string;
  /**
   * Las filas a las que se aplica un cambio de estado: las vivas de la
   * pareja. Si está cancelada entera, solo la principal (el back reactiva
   * con ella su espejo). Nunca una cancelada junto a una viva: reactivarla
   * crearía una segunda inscripción de la misma pareja.
   */
  ids:        string[];
  /**
   * La que se enseña y se edita: la viva más reciente (con dos vivas de una
   * pareja espejo antigua, la que tiene la disponibilidad, que pudo darse en
   * una sola); si no hay viva, la más reciente.
   */
  primary:    AdminRegistration;
  status:     RegistrationStatus;
}

/** La misma clave para A+B y B+A en la misma categoría. */
export function pairKeyOf(reg: Pick<AdminRegistration, "userId" | "partnerId" | "categoryId">): string {
  const sorted = [reg.userId, reg.partnerId ?? ""].sort().join(":");
  return `${sorted}::${reg.categoryId}`;
}

/**
 * Agrupa las inscripciones por pareja y categoría, en el orden en que llegan
 * (el back las manda de la más reciente a la más antigua).
 */
export function groupByPair(regs: AdminRegistration[]): PairRegistration[] {
  const groups = new Map<string, AdminRegistration[]>();
  for (const reg of regs) {
    const key = pairKeyOf(reg);
    const rows = groups.get(key);
    if (rows) rows.push(reg);
    else groups.set(key, [reg]);
  }

  return [...groups.entries()].map(([pairKey, rows]) => {
    const live    = rows.filter((r) => r.status !== "CANCELLED");
    const primary = live.find((r) => r.hasAvailability) ?? live[0] ?? rows[0];
    return {
      pairKey,
      ids:        live.length > 0 ? live.map((r) => r.id) : [primary.id],
      primary,
      status:     primary.status,
    };
  });
}

/** De quién es un pago: el titular de la inscripción o su compañero. */
export type PaymentPlayer = "titular" | "partner";

const UNPAID: PlayerPayment = { paid: false, paymentMethod: null, paidAt: null, paymentNote: null };

/**
 * El pago de un jugador de la inscripción (se cobra por jugador): el del
 * titular, en la propia fila; el del compañero, el que el back ya resuelve
 * en `partnerPayment` (con filas espejo está en la fila del compañero).
 */
export function playerPayment(reg: AdminRegistration, player: PaymentPlayer): PlayerPayment {
  if (player === "titular") {
    return {
      paid:          reg.paid,
      paymentMethod: reg.paymentMethod ?? null,
      paidAt:        reg.paidAt ?? null,
      paymentNote:   reg.paymentNote ?? null,
    };
  }
  if (!reg.partnerId) return { ...UNPAID };
  return reg.partnerPayment ?? { ...UNPAID };
}

/** Las columnas de pago del CSV: una por jugador (la del compañero, vacía sin pareja). */
export function paymentCsvColumns(reg: AdminRegistration): { "Pago J1": string; "Pago J2": string } {
  const yesNo = (player: PaymentPlayer) => (playerPayment(reg, player).paid ? "Sí" : "No");
  return { "Pago J1": yesNo("titular"), "Pago J2": reg.partnerId ? yesNo("partner") : "" };
}

/**
 * El orden de la lista de espera, el mismo que usa el back para subir a la
 * siguiente: cuándo entró en ella (`waitlistedAt`: quien baja a la espera va
 * al final; si no la tiene, la fecha de inscripción) y, de desempate, el id.
 */
export function compareWaitlist(
  a: Pick<AdminRegistration, "id" | "createdAt" | "waitlistedAt">,
  b: Pick<AdminRegistration, "id" | "createdAt" | "waitlistedAt">,
): number {
  const at = (r: Pick<AdminRegistration, "createdAt" | "waitlistedAt">) =>
    new Date(r.waitlistedAt ?? r.createdAt).getTime();
  const byQueue = at(a) - at(b);
  if (byQueue) return byQueue;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** El puesto de cada pareja en espera en la cola de su categoría (1 = la siguiente en subir). */
export function waitlistPositions(pairs: PairRegistration[]): Map<string, number> {
  const byCategory = new Map<string, PairRegistration[]>();
  for (const p of pairs) {
    if (p.status !== "WAITLIST") continue;
    const list = byCategory.get(p.primary.categoryId);
    if (list) list.push(p);
    else byCategory.set(p.primary.categoryId, [p]);
  }
  const positions = new Map<string, number>();
  for (const list of byCategory.values()) {
    [...list]
      .sort((a, b) => compareWaitlist(a.primary, b.primary))
      .forEach((p, i) => positions.set(p.pairKey, i + 1));
  }
  return positions;
}

/** Los jugadores de la inscripción con su pago: el titular y, si lo hay, el compañero. */
export function pairPlayers(reg: AdminRegistration): { player: PaymentPlayer; id: string; name: string; payment: PlayerPayment }[] {
  return [
    { player: "titular" as const, id: reg.userId, name: reg.user.name, payment: playerPayment(reg, "titular") },
    ...(reg.partnerId
      ? [{ player: "partner" as const, id: reg.partnerId, name: reg.partner?.name ?? "Compañero", payment: playerPayment(reg, "partner") }]
      : []),
  ];
}

/**
 * El recuento de las parejas para un texto, como el resumen de la ficha: las
 * que ocupan plaza (pendientes y confirmadas) y, aparte, las que esperan y las
 * canceladas. Contarlas todas juntas daba 18 frente al «17 (+1 en espera)» de
 * arriba.
 */
export function pairsSummary(pairs: Pick<PairRegistration, "status">[]): string {
  const count = (statuses: RegistrationStatus[]) => pairs.filter((p) => statuses.includes(p.status)).length;
  const inscribed = count(["PENDING", "CONFIRMED"]);
  const waiting   = count(["WAITLIST"]);
  const cancelled = count(["CANCELLED"]);
  const plural = (n: number) => (n !== 1 ? "s" : "");
  let text = `${inscribed} pareja${plural(inscribed)} inscrita${plural(inscribed)}`;
  if (waiting) text += ` (+${waiting} en espera)`;
  if (cancelled) text += ` · ${cancelled} cancelada${plural(cancelled)}`;
  return text;
}
