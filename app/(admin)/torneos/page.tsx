"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { TOURNAMENT_STATUS_LABEL, TOURNAMENT_STATUS_COLOR, resolveTier } from "@/lib/constants";
import type { Tournament, TournamentStatus } from "@/types";

type FilterStatus = "all" | TournamentStatus;

function SortIcon({ column }: { column: { getIsSorted: () => false | "asc" | "desc" } }) {
  const sorted = column.getIsSorted();
  if (sorted === "asc")  return <ArrowUp size={13} className="text-[#D4AF37]" />;
  if (sorted === "desc") return <ArrowDown size={13} className="text-[#D4AF37]" />;
  return <ArrowUpDown size={13} className="text-muted-foreground" />;
}

export default function TorneosPage() {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sorting, setSorting] = useState<SortingState>([]);

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
        const total = row.original.categories.reduce((s, c) => s + Math.floor(c.totalSpots / 2), 0);
        const reg   = row.original.categories.reduce((s, c) => s + Math.floor(c.registeredCount / 2), 0);
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
        <Link
          href={`/torneos/${row.original.id}`}
          className="flex items-center gap-1 text-xs text-[#D4AF37] hover:underline"
        >
          Ver <ChevronRight size={13} />
        </Link>
      ),
    },
  ];

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
          {/* Status filters — scrollable on mobile */}
          <div className="overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex items-center gap-1.5 bg-secondary rounded-lg p-1 w-max">
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
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border flex-1 sm:w-56 sm:flex-none">
              <Search size={14} className="text-muted-foreground shrink-0" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Buscar torneo o sede..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
              />
            </div>

            {/* Create */}
            <Link
              href="/torneos/nuevo"
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors shrink-0"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Crear torneo</span>
              <span className="sm:hidden">Nuevo</span>
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="space-y-0">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border">
                  <div className="h-4 w-48 rounded bg-secondary animate-pulse" />
                  <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
                  <div className="h-4 w-16 rounded bg-secondary animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
