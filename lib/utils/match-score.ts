import { SET_KIND, setKinds, type SetKind } from "@/lib/scoring-format";
import type { ScoringFormat } from "@/types";

/** Si el marcador de un set vale en esa clase de set (sin empates ni negativos: eso se comprueba antes). */
export function isValidSetScore(kind: SetKind, a: number, b: number): boolean {
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  switch (kind) {
    case "standard":
      return (max === 6 && min <= 4) || (max === 7 && (min === 5 || min === 6));
    case "shortSet":
      return max === 6 && min <= 5;
    case "pro9":
      return max === 9 && min <= 8;
    // La misma regla que el back: se acaba en cuanto alguien llega a 10 con 2
    // de diferencia (10-8 o menos) o, desde 9-9, al sacar 2 (11-9, 12-10…)
    case "superTb":
      return (max === 10 && min <= 8) || (max > 10 && max - min === 2);
  }
}

/**
 * Qué falla en el marcador de un partido del formato, dicho para quien lo
 * mete, o null si vale. Las mismas reglas que el back antes de guardar: cada
 * set vale en su casilla (el 3.º de «2 sets + súper tie-break» es el súper
 * tie-break) y el partido está completo y bien cerrado (un set, o gana quien
 * llega a 2 sets, sin sets de más ni de menos).
 */
export function matchScoreIssue(sets: { a: number; b: number }[], format: ScoringFormat): string | null {
  const kinds = setKinds(format);
  const single = kinds.length === 1;
  const tooMany = single
    ? "Hay sets de más: este formato se juega a un solo set"
    : "Hay sets de más: el partido ya estaba decidido al ganar 2 sets";

  if (sets.length > kinds.length) return tooMany;

  for (let i = 0; i < sets.length; i++) {
    const { a, b } = sets[i];
    const setNum = i + 1;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
      return `Set ${setNum}: los valores deben ser números enteros no negativos`;
    }
    if (a === b) return `Set ${setNum}: no puede haber empate`;
    if (!isValidSetScore(kinds[i], a, b)) {
      return `Set ${setNum}: resultado inválido (${a}-${b}). Esperado: ${SET_KIND[kinds[i]].hint}`;
    }
  }

  if (single) return sets.length === 1 ? null : "Falta el resultado del set";

  let won1 = 0;
  let won2 = 0;
  for (let i = 0; i < sets.length; i++) {
    if (sets[i].a > sets[i].b) won1++;
    else won2++;
    if (Math.max(won1, won2) >= 2 && i !== sets.length - 1) return tooMany;
  }
  if (Math.max(won1, won2) < 2) return "Partido incompleto: el ganador debe ganar 2 sets";
  return null;
}
