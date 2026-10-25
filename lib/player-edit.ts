import type { CategoryLevel, UpdatePlayerPayload } from "@/types";

/**
 * Lo que manda «Editar datos» de la ficha del jugador. La categoría, solo si
 * se cambia aquí: «Sin asignar» se la quita (null) a quien tenía una, y si no
 * se toca no se manda. Antes se reenviaba siempre, y a quien no tenía
 * categoría se le grababa 4ª (D6).
 */
export function playerUpdatePayload(
  form: UpdatePlayerPayload,
  currentLevel: CategoryLevel | null,
): UpdatePlayerPayload {
  const level = form.categoryLevel ?? null;
  return {
    ...form,
    categoryLevel: level !== currentLevel ? level : undefined,
    email: form.email?.trim() || undefined,
    phone: form.phone?.trim() || undefined,
    city:  form.city?.trim()  || undefined,
    bio:   form.bio?.trim()   || undefined,
  };
}
