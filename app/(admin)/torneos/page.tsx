"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, Copy } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { TOURNAMENT_STATUS_LABEL, TOURNAMENT_STATUS_COLOR, resolveTier } from "@/lib/constants";
import type { Tournament, TournamentStatus } from "@/types";
import { formatDateRange } from "@/lib/utils/formatDateRange";

type FilterStatus = "all" | TournamentStatus;

function SortIcon({ column }: { column: { getIsSorted: () => false | "asc" | "desc" } }) {
  const sorted = column.getIsSorted();
  if (sorted === "asc")  return <ArrowUp size={13} className="text-[#D4AF37]" />;
  if (sorted === "desc") return <ArrowDown size={13} className="text-[#D4AF37]" />;
  return <ArrowUpDown size={13} className="text-muted-foreground" />;
}

function CloneTournamentModal({
  tournament,
  onClose,
}: {
  tournament: Tournament;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const nameRef      = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef   = useRef<HTMLInputElement>(null);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (body: { name?: string; startDate?: string; endDate?: string }) =>
      adminService.tournaments.duplicate(tournament.id, body),
    onSuccess: (cloned) => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      onClose();
      router.push(`/torneos/${cloned.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name      = nameRef.current?.value.trim() || undefined;
    const startDate = startDateRef.current?.value || undefined;
    const endDate   = endDateRef.current?.value || undefined;
    mutate({ name, startDate, endDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">Clonar torneo</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Clonando: <span className="text-foreground font-medium">{tournament.name}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre del nuevo torneo</label>
            <input
              ref={nameRef}
              defaultValue={`${tournament.name} (Copia)`}
              placeholder="Nombre del torneo"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:border-[#D4AF37] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fecha inicio</label>
              <input
                ref={startDateRef}
                type="date"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:border-[#D4AF37] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fecha fin</label>
              <input
                ref={endDateRef}
                type="date"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:border-[#D4AF37] transition-colors"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Si no indicas fechas, se aplicará un desplazamiento de +1 año.
          </p>

          {error && (
            <p className="text-xs text-red-400">{(error as Error).message ?? "Error al clonar el torneo"}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors disabled:opacity-60"
            >
              {isPending ? "Clonando..." : "Clonar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TorneosPage() {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [cloning, setCloning] = useState<Tournament | null>(null);

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn:  adminService.tournaments.list,
  });

  const data = useMemo(
    () => statusFilter === "all" ? all : all.filter((t) => t.status === statusFilter),
    [all, statusFilter],
  );

  const columns: ColumnDef<Tournament>[] = [
    {
      accessorKey: "name",
      header:      ({ column }) => (
        <button
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Torneo <SortIcon column={column} />
        </button>
      ),
      cell: ({ row }) => {
        const tierDisplay = resolveTier(row.original.spaTier, row.original.tier);
        return (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm text-foreground">{row.original.name}</p>
              {tierDisplay && (
                <span
                  className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border"
                  style={{ color: tierDisplay.color, backgroundColor: tierDisplay.color + "22", borderColor: tierDisplay.color + "55" }}
                >
                  {tierDisplay.label.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{row.original.club?.name ?? ""}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "dates",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fechas</span>
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      id:     "categories",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categorías</span>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-foreground">{row.original.categories.length}</span>
      ),
    },
    {
      id:     "spots",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inscritos</span>
      ),
      cell: ({ row }) => {
        const total = row.original.categories.reduce((s, c) => s + c.totalSpots, 0);
        const reg   = row.original.categories.reduce((s, c) => s + c.registeredCount, 0);
        const pct   = total > 0 ? Math.round((reg / total) * 100) : 0;
        return (
          <div className="space-y-1 w-24">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{reg}/{total}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-[#D4AF37] rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: () => (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</span>
      ),
      cell: ({ getValue }) => {
        const s = getValue() as TournamentStatus;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TOURNAMENT_STATUS_COLOR[s]}`}>
            {TOURNAMENT_STATUS_LABEL[s]}
          </span>
        );
      },
    },
    {
      id:   "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); setCloning(row.original); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Clonar torneo"
          >
            <Copy size={13} />
          </button>
          <Link
            href={`/torneos/${row.original.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
          >
            Ver <ChevronRight size={13} />
          </Link>
        </div>
      ),
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state:              { sorting, globalFilter },
    onSortingChange:    setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel:    getCoreRowModel(),
    getSortedRowModel:  getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn:     "includesString",
  });

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: "all",       label: `Todos (${all.length})` },
    { key: "DRAFT",     label: `Borrador (${all.filter((t) => t.status === "DRAFT").length})` },
    { key: "OPEN",      label: `Abiertos (${all.filter((t) => t.status === "OPEN").length})` },
    { key: "DRAW",      label: `Sorteo (${all.filter((t) => t.status === "DRAW").length})` },
    { key: "SCHEDULED", label: `Programado (${all.filter((t) => t.status === "SCHEDULED").length})` },
    { key: "ONGOING",   label: `En curso (${all.filter((t) => t.status === "ONGOING").length})` },
    { key: "FINISHED",  label: `Finalizados (${all.filter((t) => t.status === "FINISHED").length})` },
    { key: "CANCELLED", label: `Cancelados (${all.filter((t) => t.status === "CANCELLED").length})` },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Torneos" />

      <div className="flex-1 p-4 sm:p-6 space-y-4 sm:space-y-5">
        {/* Top bar */}
        <div className="flex flex-col gap-3">
          {/* Filters: select on mobile, pills on desktop */}
          <div className="flex items-center gap-3">
            {/* Mobile select */}
            <div className="sm:hidden flex-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground outline-none appearance-none cursor-pointer"
              >
                {FILTERS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Desktop pills */}
            <div className="hidden sm:flex items-center gap-1.5 bg-secondary rounded-lg p-1 flex-1 overflow-x-auto no-scrollbar">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    statusFilter === f.key
                      ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Create button — always visible */}
            <Link
              href="/torneos/nuevo"
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors shrink-0"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Crear torneo</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar torneo o sede..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="bg-card border border-border rounded-lg overflow-hidden space-y-0">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border">
                <div className="h-4 w-48 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-16 rounded bg-secondary animate-pulse ml-auto" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (
          <>
            {/* Mobile: card list */}
            <div className="sm:hidden space-y-2">
              {table.getRowModel().rows.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground bg-card border border-border rounded-lg">
                  No se encontraron torneos
                </div>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const t = row.original;
                  const tierDisplay = resolveTier(t.spaTier, t.tier);
                  const total = t.categories.reduce((s, c) => s + c.totalSpots, 0);
                  const reg   = t.categories.reduce((s, c) => s + c.registeredCount, 0);
                  const pct   = total > 0 ? Math.round((reg / total) * 100) : 0;
                  return (
                    <div
                      key={row.id}
                      className="w-full text-left bg-card border border-border rounded-lg px-4 py-3.5 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/torneos/${t.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">{t.name}</span>
                            {tierDisplay && (
                              <span
                                className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0"
                                style={{ color: tierDisplay.color, backgroundColor: tierDisplay.color + "22", borderColor: tierDisplay.color + "55" }}
                              >
                                {tierDisplay.label.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.club?.name ?? ""}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setCloning(t); }}
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Clonar torneo"
                          >
                            <Copy size={13} />
                          </button>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TOURNAMENT_STATUS_COLOR[t.status]}`}>
                            {TOURNAMENT_STATUS_LABEL[t.status]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 text-xs text-muted-foreground">
                        <span>{formatDateRange(t.startDate, t.endDate)}</span>
                        <div className="flex items-center gap-2">
                          <span>{reg}/{total} parejas</span>
                          <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-[#D4AF37] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-border bg-secondary/50">
                        {hg.headers.map((header) => (
                          <th key={header.id} className="px-5 py-3 text-left">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="text-center py-12 text-sm text-muted-foreground">
                          No se encontraron torneos
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          onClick={() => router.push(`/torneos/${row.original.id}`)}
                          className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer"
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-5 py-4">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {cloning && (
        <CloneTournamentModal tournament={cloning} onClose={() => setCloning(null)} />
      )}
    </div>
  );
}
