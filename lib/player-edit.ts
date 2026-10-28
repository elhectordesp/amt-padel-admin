import type { CategoryLevel, UpdatePlayerPayload } from "@/types";

/** Lo que tiene ahora el jugador de lo que se edita en «Editar datos». */
export interface PlayerEditCurrent {
  level:  CategoryLevel | null;
  email?: string | null;
  phone?: string | null;
  city?:  string | null;
  bio?:   string | null;
}

/**
 * Un texto del formulario: con contenido, recortado; vacío, null si el
 * jugador tenía uno (se le borra) o nada si ya estaba vacío. Antes un campo
 * vaciado no se mandaba y no había forma de quitar el teléfono, la ciudad ni
 * el email (B-M-03).
 */
function textChange(value: string | null | undefined, current: string | null | undefined): string | null | undefined {
  const v = value?.trim();
  if (v) return v;
  return current ? null : undefined;
}

/**
 * Lo que manda «Editar datos» de la ficha del jugador. La categoría, solo si
 * se cambia aquí: «Sin asignar» se la quita (null) a quien tenía una, y si no
 * se toca no se manda. Antes se reenviaba siempre, y a quien no tenía
 * categoría se le grababa 4ª (D6).
 */
export function playerUpdatePayload(
  form: UpdatePlayerPayload,
  current: PlayerEditCurrent,
): UpdatePlayerPayload {
  const level = form.categoryLevel ?? null;
  return {
    ...form,
    categoryLevel: level !== current.level ? level : undefined,
    email: textChange(form.email, current.email),
    phone: textChange(form.phone, current.phone),
    city:  textChange(form.city, current.city),
    bio:   textChange(form.bio, current.bio),
  };
}

/**
 * Por qué no se puede guardar «Editar datos»; null si se puede. Un jugador
 * que ya usa la app entra con su email: quitárselo le dejaría fuera.
 */
export function playerEditProblem(form: UpdatePlayerPayload, current: PlayerEditCurrent & { usesApp: boolean }): string | null {
  if (current.usesApp && current.email && !form.email?.trim())
    return "Este jugador ya usa la app y entra con su email: no se le puede dejar sin email.";
  return null;
}
