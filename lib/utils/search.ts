/**
 * Texto para comparar en un buscador: sin tildes ni diéresis (la ñ cuenta
 * como n), en minúsculas y con los espacios de sobra fuera. Así «nunez»
 * encuentra a «Núñez» y «malaga», «Málaga».
 */
export function foldText(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Si lo buscado está en alguno de los textos, sin mirar tildes ni
 * mayúsculas. Con varias palabras, cada una tiene que estar en alguno (en
 * el orden que sea): «indoor madrid» encuentra el torneo del club Indoor de
 * Madrid. Una búsqueda vacía lo deja pasar todo.
 */
export function matchesSearch(
  query: string,
  ...fields: (string | null | undefined)[]
): boolean {
  const words = foldText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fields.map(foldText).join(" ");
  return words.every((w) => haystack.includes(w));
}
