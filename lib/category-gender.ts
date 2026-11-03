import { CATEGORY_LABEL, CATEGORY_LABEL_SHORT } from "@/lib/constants";
import type { CategoryGender, CategoryLevel, Gender } from "@/types";

/**
 * El género de una categoría de torneo (decisión D2: los cinco de los
 * organizadores), cómo se llama y quién puede jugarla. La regla es la del back
 * (`category-gender.ts`), que es quien la aplica al inscribir: aquí sirve para
 * nombrar la categoría y para que los buscadores del panel solo ofrezcan a
 * quien puede jugarla. `User.gender` es la persona ('M' | 'F') y
 * `TournamentCategory.gender` la categoría: no se mezclan.
 *
 * - Masculina ('M'): jugadores.
 * - Femenina ('F'): jugadoras.
 * - Mixta ('MX'): un jugador y una jugadora.
 * - General ('G'): abierta.
 * - Junior ('J'): una etiqueta, sin regla de género ni de edad (lo controla el
 *   organizador).
 *
 * Quien no tiene el género en su ficha no juega las que tienen regla.
 */
export const CATEGORY_GENDERS: readonly CategoryGender[] = ["M", "F", "MX", "G", "J"];

const NAME: Record<CategoryGender, { full: string; short: string }> = {
  M:  { full: "Masculina", short: "Masc."   },
  F:  { full: "Femenina",  short: "Fem."    },
  MX: { full: "Mixta",     short: "Mixta"   },
  G:  { full: "General",   short: "General" },
  J:  { full: "Junior",    short: "Junior"  },
};

export function isCategoryGender(value: unknown): value is CategoryGender {
  return CATEGORY_GENDERS.some((g) => g === value);
}

/** El género de la categoría: «Femenina» o, en corto, «Fem.»; uno que el panel no conoce, tal cual. */
export function categoryGenderLabel(gender: string, variant: "full" | "short" = "full"): string {
  return isCategoryGender(gender) ? NAME[gender][variant] : gender;
}

/**
 * La categoría para un texto, la única forma de nombrarla en el panel: en
 * corto «Fem. 3ª» (listados, selectores, exportaciones) y en largo
 * «Femenina · 3ª» (cabeceras e impresos).
 */
export function categoryLabel(
  category: { gender: string; level: string },
  variant: "short" | "full" = "short",
): string {
  const levels = variant === "short" ? CATEGORY_LABEL_SHORT : CATEGORY_LABEL;
  const level = levels[category.level as CategoryLevel] ?? category.level;
  const gender = categoryGenderLabel(category.gender, variant);
  return variant === "short" ? `${gender} ${level}` : `${gender} · ${level}`;
}

/** Las opciones del género al crear o añadir una categoría. */
export const CATEGORY_GENDER_OPTIONS: { value: CategoryGender; label: string }[] =
  CATEGORY_GENDERS.map((value) => ({ value, label: NAME[value].full }));

/** El género de cada jugador que admite la categoría; null, cualquiera (también sin género). */
const PLAYER_GENDERS: Record<CategoryGender, readonly Gender[] | null> = {
  M:  ["M"],
  F:  ["F"],
  MX: ["M", "F"],
  G:  null,
  J:  null,
};

/**
 * Con qué géneros buscar a un jugador para la categoría; null, sin filtro
 * (General, Junior o un valor que el panel no conoce). `partnerGender`: el del
 * otro de la pareja, si ya está elegido; en la mixta se busca el contrario.
 * Buscar por género deja fuera a quien no lo tiene en su ficha.
 */
export function searchGendersFor(
  categoryGender: string,
  partnerGender?: Gender | null,
): readonly Gender[] | null {
  const allowed = isCategoryGender(categoryGender) ? PLAYER_GENDERS[categoryGender] : null;
  if (!allowed) return null;
  if (categoryGender === "MX" && partnerGender) return [partnerGender === "M" ? "F" : "M"];
  return allowed;
}

/**
 * Debajo de un buscador de jugadores de una categoría con regla: a quién
 * ofrece y qué hacer si falta alguien (sin el género en su ficha no sale);
 * null si la categoría no tiene regla. `canEditPlayer`: quien lo ve puede abrir
 * la ficha del jugador (AMT); un club no la ve.
 */
export function genderSearchHint(
  categoryGender: string,
  partnerGender: Gender | null | undefined,
  { canEditPlayer }: { canEditPlayer: boolean },
): string | null {
  const genders = searchGendersFor(categoryGender, partnerGender);
  if (!genders) return null;
  const rule = categoryGender === "MX" ? "Mixta, un jugador y una jugadora" : categoryGenderLabel(categoryGender);
  const who = genders.length > 1 ? "jugadores y jugadoras" : genders[0] === "F" ? "jugadoras" : "jugadores";
  const fix = canEditPlayer ? "ponle el género en su ficha" : "pide a AMT que le ponga el género en su ficha";
  return `${rule}: solo salen ${who} con el género en su ficha. Si falta alguien, ${fix}.`;
}
