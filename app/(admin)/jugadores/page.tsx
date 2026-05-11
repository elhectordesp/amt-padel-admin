"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { Player, Gender, CategoryLevel } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª",
  "4a": "4ª", "5a": "5ª", "6a": "6ª", "iniciacion": "Inic.",
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
  const [globalFilter, setGlobalFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | Gender>("all");
  const [levelFilter,  setLevelFilter]  = useState<"all" | CategoryLevel>("all");
  const [sorting,      setSorting]      = useState<SortingState>([{ id: "points", desc: true }]);

  const { data: mPlayers = [], isLoading: loadingM } = useQuery({
    queryKey: ["players", "M"],
    queryFn:  () => adminService.players.list({ gender: "M" }),
  });
  const { data: fPlayers = [], isLoading: loadingF } = useQuery({
    queryKey: ["players", "F"],
    queryFn:  () => adminService.players.list({ gender: "F" }),
  });

  const allPlayers = useMemo(() => [...mPlayers, ...fPlayers], [mPlayers, fPlayers]);
  const isLoading  = loadingM || loadingF;

  const data = useMemo(() =>
    allPlayers
      .filter((p) => genderFilter === "all" || p.gender === genderFilter)
      .filter((p) => levelFilter  === "all" || p.level  === levelFilter),
    [allPlayers, genderFilter, levelFilter],
  );

  const columns: ColumnDef<Player>[] = [
    {
      id:     "rank",
      header: () => <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">#</span>,
      cell:   ({ row }) => <span className="text-sm text-muted-foreground">{row.index + 1}</span>,
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
  ];

  const table = useReactTable({
    data,
    columns,
    state:                { sorting, globalFilter },
    onSortingChange:      setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel:      getCoreRowModel(),
    getSortedRowModel:    getSortedRowModel(),
    getFilteredRowModel:  getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn:       "includesString",
    initialState:         { pagination: { pageSize: 20 } },
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
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar jugador..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
          </div>

          <span className="text-xs text-muted-foreground ml-auto">
            {table.getFilteredRowModel().rows.length} jugadores
          </span>
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

              {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
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
