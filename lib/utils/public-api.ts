/**
 * Lo que devuelve una lectura de la API pública del back desde una página de
 * servidor: los datos, «no existe» (solo con un 404) u otro error (un 429 por
 * el límite de peticiones, un 5xx, sin red o una respuesta que no es JSON).
 * Antes, cualquier fallo salía como «no encontrado» o «sin datos».
 */
export type PublicApiResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "not-found" }
  | { kind: "error" };

/**
 * GET a la API pública (envuelta en `{ data }` o sin envolver). Next solo
 * guarda en su caché las respuestas 200: un error no se queda guardado.
 */
export async function fetchPublicApi<T>(url: string, init?: RequestInit): Promise<PublicApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { kind: "error" };
  }
  if (res.status === 404) return { kind: "not-found" };
  if (!res.ok) return { kind: "error" };
  try {
    const json = await res.json();
    return { kind: "ok", data: (json?.data ?? json) as T };
  } catch {
    return { kind: "error" };
  }
}
