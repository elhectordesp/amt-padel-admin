/**
 * Enlace web: http:// o https:// y un dominio con punto (raquetas.com), lo
 * mismo que exige el back (`IsUrl` con TLD) a las URLs de un patrocinador y
 * lo único que se pinta como enlace.
 */
const WEB_URL = /^https?:\/\/(?:[^\s/?#@]+@)?[^\s/?#:.@]+(?:\.[^\s/?#:.@]+)+(?::\d+)?(?:[/?#]\S*)?$/i;

export function isWebUrl(url: string): boolean {
  return WEB_URL.test(url.trim());
}

export const WEB_URL_MESSAGE =
  "La URL destino debe ser una dirección web completa, que empiece por https:// (por ejemplo, https://tienda.com)";

export const IMAGE_URL_MESSAGE =
  "La imagen debe ser una dirección web completa, que empiece por https:// (o súbela con el botón)";
