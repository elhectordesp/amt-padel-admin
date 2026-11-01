/**
 * Resultado de una reserva visto por el club: el marcador, los equipos y si
 * aún lo puede poner o corregir.
 */

import type { Booking, BookingResult, ResultEntryPayload } from "@/types/bookings";

/** Estados en que el club puede poner o corregir el resultado (el partido ya empezó). */
const EDITABLE_STATUSES: Booking["status"][] = ["IN_PROGRESS", "COMPLETED", "WITHOUT_RESULT"];

/** Si el club puede poner o corregir el resultado ahora (hasta 30 días después del partido). */
export function clubCanEditResult(
  b: Pick<Booking, "status" | "resultAdminDeadlineAt">,
  nowMs: number = Date.now(),
): boolean {
  if (!EDITABLE_STATUSES.includes(b.status) || !b.resultAdminDeadlineAt) return false;
  return nowMs < new Date(b.resultAdminDeadlineAt).getTime();
}

/** «6-4 · 3-6 · 10-8» (equipo 1 primero). */
export function formatScore(r: BookingResult): string {
  const sets = [
    [r.set1Home, r.set1Away],
    [r.set2Home, r.set2Away],
    [r.set3Home, r.set3Away],
  ].filter(([h, a]) => h !== null && a !== null);
  return sets.map(([h, a]) => `${h}-${a}`).join(" · ");
}

/** Los nombres del equipo (1 o 2) con el que puntúa el partido. */
export function teamNames(b: Pick<Booking, "participants">, team: 1 | 2): string[] {
  return (b.participants ?? [])
    .filter((p) => p.team === team)
    .map((p) => p.user?.name ?? p.guestName ?? "—");
}

/** Lo que se escribe en el formulario: un texto por juego. */
export type ScoreDraft = {
  set1Home: string;
  set1Away: string;
  set2Home: string;
  set2Away: string;
  set3Home: string;
  set3Away: string;
};

export const EMPTY_SCORE: ScoreDraft = {
  set1Home: "", set1Away: "", set2Home: "", set2Away: "", set3Home: "", set3Away: "",
};

export function scoreDraftFrom(r: BookingResult | null | undefined): ScoreDraft {
  if (!r) return EMPTY_SCORE;
  const s = (v: number | null) => (v === null ? "" : String(v));
  return {
    set1Home: s(r.set1Home), set1Away: s(r.set1Away),
    set2Home: s(r.set2Home), set2Away: s(r.set2Away),
    set3Home: s(r.set3Home), set3Away: s(r.set3Away),
  };
}

/**
 * Lo escrito, listo para mandar; o el error de forma (falta un set, un
 * número que no lo es). Si el marcador es posible lo decide el back
 * (BOOKING_RESULT_INVALID_SETS, con su mensaje).
 */
export function parseScoreDraft(
  d: ScoreDraft,
): { payload: ResultEntryPayload } | { error: string } {
  const num = (v: string) => (/^\d{1,2}$/.test(v.trim()) ? Number(v.trim()) : null);
  const s1h = num(d.set1Home), s1a = num(d.set1Away);
  const s2h = num(d.set2Home), s2a = num(d.set2Away);
  if (s1h === null || s1a === null || s2h === null || s2a === null) {
    return { error: "Pon los juegos de los dos primeros sets (números enteros)." };
  }
  const has3 = d.set3Home.trim() !== "" || d.set3Away.trim() !== "";
  if (!has3) return { payload: { set1Home: s1h, set1Away: s1a, set2Home: s2h, set2Away: s2a } };
  const s3h = num(d.set3Home), s3a = num(d.set3Away);
  if (s3h === null || s3a === null) {
    return { error: "El tercer set lleva los juegos de los dos equipos." };
  }
  return {
    payload: { set1Home: s1h, set1Away: s1a, set2Home: s2h, set2Away: s2a, set3Home: s3h, set3Away: s3a },
  };
}
