"use client";

import { useSyncExternalStore } from "react";

/**
 * Si la ventana cumple la media query (`(max-width: 600px)`), y se actualiza
 * al girar el móvil o cambiar el tamaño. En el servidor, false.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
