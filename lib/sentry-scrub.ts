/**
 * Quita los tokens de los enlaces de los emails (?token=… o #token=…, en
 * /restablecer y /aceptar-invitacion) de lo que se manda a Sentry: la URL de
 * la página va en los errores, en las trazas de carga y en las migas de
 * navegación. Un token de esos deja poner la contraseña de una cuenta.
 */
const TOKEN_IN_URL = /([?&#]token=)[^&#\s"']+/gi;

export function scrubTokens(text: string): string {
  return text.replace(TOKEN_IN_URL, "$1[Filtered]");
}

function isPlainContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recorre el evento (objetos y listas normales; no entra en instancias de
 * clases ni en `sdkProcessingMetadata`, que es interno del SDK) y limpia cada
 * texto. Lo cambia en el sitio y lo devuelve, como piden `beforeSend` y
 * compañía.
 */
export function scrubEvent<T>(event: T): T {
  const seen = new WeakSet<object>();
  const visit = (value: unknown): unknown => {
    if (typeof value === "string") return scrubTokens(value);
    if (!isPlainContainer(value) || seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) value[i] = visit(value[i]);
    } else {
      for (const key of Object.keys(value)) {
        if (key !== "sdkProcessingMetadata") value[key] = visit(value[key]);
      }
    }
    return value;
  };
  return visit(event) as T;
}
