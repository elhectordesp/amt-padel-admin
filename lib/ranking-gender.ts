import { GENDER_LABEL } from "@/lib/constants";
import type { RankingGender, RankingType } from "@/types";

/**
 * El ranking Mixto (decisión D3): `gender=MX` en el de circuito. Suma los
 * puntos de las categorías Mixta, con jugadores y jugadoras juntos; el
 * Masculino y el Femenino van sin ellos. No es un género de persona: el SPA
 * y el clásico no lo tienen (el back responde 400).
 */
export const MIXED_RANKING = "MX" satisfies RankingGender;

/** «Mixto», el ranking; no «Mixta», la categoría (lib/category-gender.ts). */
export const RANKING_GENDER_LABEL: Record<RankingGender, string> = {
  M:  GENDER_LABEL.M.full,
  F:  GENDER_LABEL.F.full,
  MX: "Mixto",
};

/** Los rankings de un tipo: Masculino y Femenino, y en el de circuito, también el Mixto. */
export function rankingGendersFor(type: RankingType): RankingGender[] {
  return type === "circuit" ? ["M", "F", MIXED_RANKING] : ["M", "F"];
}

/**
 * El ranking que queda al cambiar de tipo: el mismo si ese tipo lo tiene; si
 * no (el Mixto al pasar al SPA), el Masculino, con el que se abre la página.
 */
export function keepRankingGender(type: RankingType, gender: RankingGender): RankingGender {
  return rankingGendersFor(type).includes(gender) ? gender : "M";
}
