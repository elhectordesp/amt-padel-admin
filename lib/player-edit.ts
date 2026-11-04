import type { CategoryLevel, Gender, UpdatePlayerPayload } from "@/types";

/** Lo que tiene ahora el jugador de lo que se edita en «Editar datos». */
export interface PlayerEditCurrent {
  level:  CategoryLevel | null;
  // null o sin él: no tiene el género en su ficha (playerGender)
  gender?: Gender | null;
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
 * categoría se le grababa 4ª (D6). El género, igual: solo si se cambia (a
 * quien no lo tenía, si se le elige uno). Antes salía siempre, y guardar
 * cualquier dato de un jugador sin género le ponía Masculino.
 */
export function playerUpdatePayload(
  form: UpdatePlayerPayload,
  current: PlayerEditCurrent,
): UpdatePlayerPayload {
  const level = form.categoryLevel ?? null;
  return {
    ...form,
    gender: form.gender && form.gender !== current.gender ? form.gender : undefined,
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

