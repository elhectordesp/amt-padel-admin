/**
 * Caracteres de un texto contados como el back (MaxLength de
 * class-validator, que usa isLength de validator.js): un emoji cuenta como
 * uno, y su selector de presentación (U+FE0E/U+FE0F) no cuenta. Así el
 * contador del formulario y la validación del back dicen lo mismo.
 */
export function charCount(text: string): number {
  const presentationSequences = text.match(/[^️︎][️︎]/g)?.length ?? 0;
  const surrogatePairs = text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g)?.length ?? 0;
  return text.length - presentationSequences - surrogatePairs;
}
