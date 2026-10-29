"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Si la ventana cumple la media query (`(max-width: 600px)`), y se actualiza
 * al girar el móvil o cambiar el tamaño. En el servidor, false.
 */
export function useMediaQuery(query: string): boolean {
  // Estables mientras no cambie la query: si no, useSyncExternalStore se
  // daba de baja y de alta de nuevo en cada render
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
