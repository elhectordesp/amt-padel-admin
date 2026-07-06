"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search, X, ChevronLeft, ChevronRight, Loader2, ExternalLink, ChevronDown,
} from "lucide-react";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";

interface Filters {
  search: string;
  action: string;
  tournamentId: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  action: "",
  tournamentId: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 50,
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const obj = details as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => k !== "name");
  if (keys.length === 0) return null;
  return keys
    .slice(0, 5)
    .map((k) => {
      const v = obj[k];
      const sv =
        typeof v === "string"
          ? v
          : typeof v === "number" || typeof v === "boolean"
          ? String(v)
          : Array.isArray(v)
          ? `[${v.length}]`
          : typeof v === "object" && v !== null
          ? "{…}"
          : String(v ?? "");
      return `${k}=${sv.length > 30 ? sv.slice(0, 27) + "…" : sv}`;
    })
    .join(" · ");
}

export default function HistorialPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const queryArgs = useMemo(
    () => ({
      search: filters.search.trim() || undefined,
      action: filters.action || undefined,
      tournamentId: filters.tournamentId.trim() || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    [filters],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit-logs", queryArgs],
    queryFn: () => adminService.auditLogs(queryArgs),
    placeholderData: (prev) => prev,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / filters.pageSize)) : 1;
  const hasActiveFilters =
    !!filters.search || !!filters.action || !!filters.tournamentId || !!filters.from || !!filters.to;

  return (
    <div>
      <Header title="Historial" />
      <p className="px-4 sm:px-6 -mt-2 mb-2 text-xs text-muted-foreground">
        Auditoría de acciones realizadas por administradores y clubs.
      </p>

      <div className="px-4 sm:px-6 py-4 space-y-4">
        {/* ── Filtros ────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Buscar admin</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
                  placeholder="Nombre o parte…"
                  className="w-full pl-7 pr-2 py-1.5 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Acción</label>
              <select
                value={filters.action}
                onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value, page: 1 }))}
                className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              >
                <option value="">Todas las acciones</option>
                {data?.distinctActions.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label} ({a.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Desde</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
                className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Hasta</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
                className="w-full px-2 py-1.5 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {data ? `${data.total} resultado${data.total !== 1 ? "s" : ""}` : "—"}
              </p>
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="inline-flex items-center gap-1 text-xs text-[#D4AF37] hover:text-foreground transition-colors"
              >
                <X size={11} /> Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* ── Tabla ──────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading && !data && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {isError && (
            <div className="py-12 text-center text-sm text-destructive">
              Error al cargar el historial.
            </div>
          )}
          {data && data.items.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No hay registros con estos filtros.
            </div>
          )}
          {data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Admin</th>
                    <th className="px-3 py-2 text-left font-semibold">Acción</th>
                    <th className="px-3 py-2 text-left font-semibold">Recurso</th>
                    <th className="px-3 py-2 text-left font-semibold">Detalles</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((it) => {
                    const isExpanded = showDetail === it.id;
                    const detailsStr = formatDetails(it.details);
                    return (
                      <>
                        <tr key={it.id} className="hover:bg-secondary/30">
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDateTime(it.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-xs text-foreground font-medium">{it.adminName}</td>
                          <td className="px-3 py-2 text-xs text-[#D4AF37]">{it.actionLabel}</td>
                          <td className="px-3 py-2 text-xs">
                            {it.href ? (
                              <Link href={it.href} className="inline-flex items-center gap-1 text-foreground hover:text-[#D4AF37] transition-colors">
                                {it.entityName ?? it.resourceId} <ExternalLink size={9} />
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">{it.entityName ?? it.resource}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[10px] text-muted-foreground font-mono max-w-md truncate">
                            {detailsStr ?? <span className="opacity-50">—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {detailsStr && (
                              <button
                                onClick={() => setShowDetail(isExpanded ? null : it.id)}
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={isExpanded ? "Ocultar JSON" : "Ver JSON completo"}
                              >
                                <ChevronDown
                                  size={14}
                                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${it.id}-detail`} className="bg-background/40">
                            <td colSpan={6} className="px-3 py-3">
                              <pre className="text-[10px] text-muted-foreground font-mono overflow-x-auto">
                                {JSON.stringify(it.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Paginación ──────────────────────────────────────────── */}
        {data && data.total > filters.pageSize && (
          <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2">
            <p className="text-xs text-muted-foreground">
              Página {filters.page} de {totalPages} · {data.total} totales
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                disabled={filters.page === 1}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
                disabled={filters.page >= totalPages}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Página siguiente"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
