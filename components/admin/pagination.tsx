"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSize,
  clampPage, pageCount, pageRange,
} from "@/lib/utils/pagination";

/**
 * Página (desde 1) y filas por página de un listado. Cambiar el número de
 * filas vuelve a la primera página.
 */
export function usePagination(initialSize: PageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setSize] = useState<PageSize>(initialSize);
  const setPageSize = (size: PageSize) => {
    setSize(size);
    setPage(1);
  };
  return { page, setPage, pageSize, setPageSize };
}

/**
 * Para los listados que pagina el servidor: si baja el total (p. ej. «Invitar
 * pendientes» con el filtro «Sin activar» en la página 2), la página pedida
 * deja de existir, el servidor la devuelve vacía y no quedaban botones para
 * salir. Cuando llega el total, se pasa a la última página que haya.
 * `total`: el de la respuesta del servidor, undefined mientras no hay una de
 * verdad (cargando o con los datos de la consulta anterior).
 */
export function useKeepPageInRange(
  page: number,
  setPage: (page: number) => void,
  pageSize: number,
  total: number | undefined,
) {
  useEffect(() => {
    if (total === undefined) return;
    const last = pageCount(total, pageSize);
    if (page > last) setPage(last);
  }, [page, setPage, pageSize, total]);
}

interface PaginationProps {
  page:             number;
  pageSize:         number;
  total:            number;
  onPageChange:     (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Lo que se cuenta, en plural: «jugadores», «torneos»… */
  itemLabel:        string;
  /** Mientras llega otra página del servidor: no se puede pasar de página. */
  busy?:            boolean;
}

/**
 * Pie de un listado: qué filas se ven de cuántas, cuántas por página (25, 50
 * o 100) y pasar de página. Sin filas no se pinta.
 */
export function Pagination({
  page, pageSize, total, onPageChange, onPageSizeChange, itemLabel, busy = false,
}: PaginationProps) {
  if (total === 0) return null;
  const current = clampPage(page, total, pageSize);
  const pages   = pageCount(total, pageSize);
  const { from, to } = pageRange(current, pageSize, total);
  const navBtn = "p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors";

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md bg-card border border-border"
    >
      <span className="text-xs text-muted-foreground">
        Mostrando {from}–{to} de {total} {itemLabel}
      </span>
      <div className="flex items-center gap-3">
        {total > PAGE_SIZE_OPTIONS[0] && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Por página</span>
            <select
              aria-label="Filas por página"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
              className="h-7 px-1.5 rounded-md bg-secondary border border-border text-xs text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {pages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Página anterior"
              onClick={() => onPageChange(current - 1)}
              disabled={current <= 1 || busy}
              className={navBtn}
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {current} / {pages}
            </span>
            <button
              type="button"
              aria-label="Página siguiente"
              onClick={() => onPageChange(current + 1)}
              disabled={current >= pages || busy}
              className={navBtn}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
