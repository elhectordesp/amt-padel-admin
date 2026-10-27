/**
 * Enlace web: http:// o https://, lo único que el back admite como URL de un
 * patrocinador y lo único que se pinta como enlace.
 */
export function isWebUrl(url: string): boolean {
  return /^https?:\/\/\S+$/i.test(url.trim());
}

export const WEB_URL_MESSAGE = "La URL destino debe empezar por https:// (o http://)";
