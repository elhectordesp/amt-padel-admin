"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Download, Loader2,
} from "lucide-react";
import { downloadCsv } from "@/lib/utils/csv";
import Link from "next/link";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { Player, Gender, CategoryLevel } from "@/types";

const PAGE_SIZE = 50;

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª",
  "4a": "4ª", "5a": "5ª", "6a": "6ª", "iniciacion": "Inic.",
};

const LEVEL_COLOR: Record<string, string> = {
  "1a":"#D4AF37","2a":"#C084FC","3a":"#60A5FA",
  "4a":"#34D399","5a":"#A78BFA","6a":"#FB923C","iniciacion":"#94A3B8",
};

const TREND_ICON: Record<string, React.ReactNode> = {
  up:     <TrendingUp   size={13} className="text-green-400" />,
  down:   <TrendingDown size={13} className="text-destructive" />,
  stable: <Minus        size={13} className="text-muted-foreground" />,
};

function SortBtn({ column, label }: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (d: boolean) => void };
  label:  string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}
      {sorted === "asc"  ? <ArrowUp    size={12} className="text-[#D4AF37]" /> :
       sorted === "desc" ? <ArrowDown  size={12} className="text-[#D4AF37]" /> :
                           <ArrowUpDown size={12} />}
    </button>
  );
}

export default function JugadoresPage() {
  const [page,         setPage]         = useState(1);
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [levelFilter,  setLevelFilter]  = useState<"all" | CategoryLevel>("all");
  const [sorting,      setSorting]      = useState<SortingState>([{ id: "points", desc: true }]);

  // Debounce text search 300 ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [genderFilter, levelFilter]);

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey:        ["admin-players", page, genderFilter, levelFilter, search],
    queryFn:         () => adminService.players.list({
      page,
      pageSize: PAGE_SIZE,
      gender:   genderFilter !== "all" ? genderFilter : undefined,
      level:    levelFilter  !== "all" ? levelFilter  : undefined,
      q:        search || undefined,
    }),
    placeholderData: (prev) => prev,
  });

  const players    = result?.data     ?? [];
  const total      = result?.total    ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns: ColumnDef<Player>[] = useMemo(() => [
    {
      id:     "rank",
      header: () => <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">#</span>,
      cell:   ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {(page - 1) * PAGE_SIZE + row.index + 1}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortBtn column={column} label="Jugador" />,
      cell:   ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[#D4AF37]">
              {row.original.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </span>
          </div>
          <div>
            <Link
              href={`/jugadores/${row.original.id}`}
              className="text-sm font-medium text-foreground hover:text-[#D4AF37] transition-colors"
            >
              {row.original.name}
            </Link>
            {row.original.partner && (
              <p className="text-xs text-muted-foreground">c/ {row.original.partner}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "gender",
      header: () => <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Género</span>,
      cell:   ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{getValue() === "M" ? "Masc." : "Fem."}</span>
      ),
    },
    {
      accessorKey: "level",
      header: ({ column }) => <SortBtn column={column} label="Categoría" />,
      cell:   ({ getValue }) => (
        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)]">
          {CATEGORY_LABEL[getValue() as string]}
        </span>
      ),
    },
    {
      accessorKey: "points",
      header: ({ column }) => <SortBtn column={column} label="Puntos" />,
      cell:   ({ getValue, row }) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{(getValue() as number).toLocaleString()}</span>
          {TREND_ICON[row.original.trend]}
        </div>
      ),
    },
    {
      id:     "spa",
      header: () => <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SPA</span>,
      cell:   ({ row }) => {
        const spa = row.original.spa;
        if (!spa) return <span className="text-xs text-muted-foreground">—</span>;
        const color = LEVEL_COLOR[spa.spaLevel];
        return (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
              style={{ color, backgroundColor: color + "22", borderColor: color + "55" }}
            >
              {CATEGORY_LABEL[spa.spaLevel]}
            </span>
            <span className="text-xs text-muted-foreground">{spa.spaPoints.toFixed(0)} pts</span>
          </div>
        );
      },
    },
    {
      accessorKey: "played",
      header: ({ column }) => <SortBtn column={column} label="PJ / %W" />,
      cell:   ({ row }) => {
        const rate = row.original.played > 0
          ? Math.round((row.original.wins / row.original.played) * 100)
          : 0;
        return (
          <span className="text-sm text-muted-foreground">
            {row.original.played} <span className="text-xs">({rate}%)</span>
          </span>
        );
      },
    },
    {
      id:   "actions",
      cell: ({ row }) => (
        <Link href={`/jugadores/${row.original.id}`} className="text-xs text-[#D4AF37] hover:underline">
          Ver perfil →
        </Link>
      ),
    },
  ], [page]);

  const table = useReactTable({
    data:             players,
    columns,
    state:            { sorting },
    onSortingChange:  setSorting,
    getCoreRowModel:  getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  });

  const levels: CategoryLevel[] = ["1a","2a","3a","4a","5a","6a","iniciacion"];

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Jugadores" />

      <div className="flex-1 p-6 space-y-5">

        {/* Filters bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {([
              { key: "all", label: "Todos"  },
              { key: "M",   label: "Masc."  },
              { key: "F",   label: "Fem."   },
            ] as { key: "all" | Gender; label: string }[]).map((g) => (
              <button
                key={g.key}
                onClick={() => setGenderFilter(g.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  genderFilter === g.key
                    ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as "all" | CategoryLevel)}
            className="h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          >
            <option value="all">Todas las categorías</option>
            {levels.map((l) => <option key={l} value={l}>{CATEGORY_LABEL[l]}</option>)}
          </select>

          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border flex-1 max-w-xs">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
            {isFetching && <Loader2 size={12} className="animate-spin text-muted-foreground shrink-0" />}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <span className="text-xs text-muted-foreground">
              {total} jugadores
            </span>
            <button
              onClick={() => downloadCsv(
                `jugadores-p${page}`,
                table.getRowModel().rows.map((row, i) => ({
                  "#":          (page - 1) * PAGE_SIZE + i + 1,
                  Jugador:      row.original.name,
                  Compañero:    row.original.partner ?? "",
                  Género:       row.original.gender === "M" ? "Masculino" : "Femenino",
                  Categoría:    CATEGORY_LABEL[row.original.level] ?? row.original.level,
                  Puntos:       row.original.points,
                  "SPA Pts":    row.original.spa?.spaPoints?.toFixed(0) ?? "",
                  "SPA Nivel":  row.original.spa ? CATEGORY_LABEL[row.original.spa.spaLevel] : "",
                  PJ:           row.original.played,
                  Victorias:    row.original.wins,
                  "% Victorias": row.original.played > 0
                    ? Math.round((row.original.wins / row.original.played) * 100) + "%"
                    : "0%",
                }))
              )}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors"
            >
              <Download size={13} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="space-y-0">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border">
                  <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                  <div className="h-4 w-36 rounded bg-secondary animate-pulse" />
                  <div className="h-4 w-16 rounded bg-secondary animate-pulse ml-auto" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id} className="border-b border-border bg-secondary/50">
                        {hg.headers.map((h) => (
                          <th key={h.id} className="px-5 py-3 text-left">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length} className="py-12 text-center text-sm text-muted-foreground">
                          No se encontraron jugadores
                        </td>
                      </tr>
                    ) : table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-5 py-3.5">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} · {total} jugadores
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || isFetching}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isFetching}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
