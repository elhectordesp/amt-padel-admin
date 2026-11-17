import type { Tournament } from "@/types";

/**
 * Las opciones de un selector de torneo (Inscripciones, Resultados): los
 * torneos y las ligas, cada grupo con su etiqueta. Si no hay ligas, las
 * opciones sueltas, como siempre.
 */
export function TournamentSelectOptions({ tournaments }: { tournaments: readonly Tournament[] }) {
  const leagues = tournaments.filter((t) => t.kind === "LEAGUE");
  if (leagues.length === 0) {
    return (
      <>
        {tournaments.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </>
    );
  }
  const cups = tournaments.filter((t) => t.kind !== "LEAGUE");
  return (
    <>
      {cups.length > 0 && (
        <optgroup label="Torneos">
          {cups.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </optgroup>
      )}
      <optgroup label="Ligas">
        {leagues.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </optgroup>
    </>
  );
}
