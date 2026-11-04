import { toast } from "sonner";
import type { GenderConflict } from "@/types";

/**
 * De dónde viene la lista: de guardar «Editar datos» tras cambiarle el
 * género a un jugador ("player": sus inscripciones, de varios torneos) o de
 * restaurar un torneo borrado ("restore": las de ese torneo, de cualquier
 * jugador).
 */
export type GenderConflictsOrigin = "player" | "restore";

interface GenderConflictsNotice {
  title: string;
  items: { id: string; text: string }[];
  fix:   string;
}

const INVITATION_NOTE = "invitación pendiente: ya no se podrá aceptar";

/**
 * Las de un torneo restaurado, una línea por categoría y por si es la
 * inscripción o la invitación: el back no dice de quién es cada una y, una
 * por línea, la misma categoría saldría repetida.
 */
function restoredItems(conflicts: GenderConflict[]) {
  const groups = new Map<string, { id: string; label: string; invitation: boolean; count: number }>();
  for (const c of conflicts) {
    const key = `${c.categoryLabel}|${c.invitation}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { id: c.registrationId, label: c.categoryLabel, invitation: c.invitation, count: 1 });
  }
  return [...groups.values()].map(({ id, label, invitation, count }) => {
    if (invitation)
      return {
        id,
        text: count === 1
          ? `${label} (${INVITATION_NOTE})`
          : `${label} (${count} invitaciones pendientes: ya no se podrán aceptar)`,
      };
    return { id, text: count === 1 ? label : `${label} (${count} inscripciones)` };
  });
}

/**
 * El aviso de las inscripciones que ya no encajan con la regla de género de
 * su categoría (o de las invitaciones pendientes, que ya no se podrán
 * aceptar): cuáles, por torneo y categoría, y qué hacer. null si todo encaja.
 */
export function genderConflictsNotice(
  conflicts: GenderConflict[],
  origin: GenderConflictsOrigin,
): GenderConflictsNotice | null {
  if (conflicts.length === 0) return null;
  const one = conflicts.length === 1;
  if (origin === "restore") {
    const name = conflicts[0].tournamentName;
    return {
      title: one
        ? `En «${name}» una inscripción ya no encaja por género:`
        : `En «${name}» ${conflicts.length} inscripciones ya no encajan por género:`,
      items: restoredItems(conflicts),
      fix: one
        ? "Muévela a otra categoría o cámbiale la pareja en las inscripciones del torneo."
        : "Muévelas a otra categoría o cámbiales la pareja en las inscripciones del torneo.",
    };
  }
  return {
    title: one
      ? "Con su género nuevo ya no encaja en una inscripción:"
      : `Con su género nuevo ya no encaja en ${conflicts.length} inscripciones:`,
    items: conflicts.map((c) => ({
      id:   c.registrationId,
      text: `${c.tournamentName} · ${c.categoryLabel}${c.invitation ? ` (${INVITATION_NOTE})` : ""}`,
    })),
    fix: one
      ? "Muévela a otra categoría o cámbiale la pareja en las inscripciones del torneo."
      : "Muévelas a otra categoría o cámbiales la pareja en las inscripciones de cada torneo.",
  };
}

/**
 * Enseña el aviso de genderConflictsNotice, si lo hay. Es lo que queda por
 * hacer: no se va solo, se cierra.
 */
export function toastGenderConflicts(conflicts: GenderConflict[], origin: GenderConflictsOrigin) {
  const notice = genderConflictsNotice(conflicts, origin);
  if (!notice) return;
  toast.warning(notice.title, {
    description: (
      <>
        <ul className="list-disc pl-4">
          {notice.items.map((item) => <li key={item.id}>{item.text}</li>)}
        </ul>
        <p className="mt-1">{notice.fix}</p>
      </>
    ),
    duration: Infinity,
    closeButton: true,
  });
}
