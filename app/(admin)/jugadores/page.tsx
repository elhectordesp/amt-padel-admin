"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useReactTable, getCoreRowModel,
  flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Download, Loader2,
  UserPlus, X, AlertTriangle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/utils/csv";
import Link from "next/link";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { CATEGORY_LABEL_SHORT as CATEGORY_LABEL } from "@/lib/constants";
import type { Player, Gender, CategoryLevel, CreatePlayerPayload } from "@/types";

const PAGE_SIZE = 50;

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

const EMPTY_FORM: CreatePlayerPayload = {
  firstName: "", lastName: "", gender: "M",
  email: "", phone: "", city: "", categoryLevel: undefined,
};

export default function JugadoresPage() {
  const router  = useRouter();
  const qc      = useQueryClient();

  const [page,         setPage]         = useState(1);
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");
  const [genderFilter,     setGenderFilter]     = useState<"all" | Gender>("all");
  const [levelFilter,      setLevelFilter]      = useState<"all" | CategoryLevel>("all");
  const [activationFilter, setActivationFilter] = useState<"all" | "unactivated" | "active">("all");
  const [sorting,      setSorting]      = useState<SortingState>([{ id: "points", desc: true }]);
  const sortBy  = sorting[0]?.id   ?? "points";
  const sortDir = sorting[0]?.desc === false ? "asc" : "desc";
  const [showCreate,   setShowCreate]   = useState(false);
  const [form,         setForm]         = useState<CreatePlayerPayload>(EMPTY_FORM);

  const bulkInviteMut = useMutation({
    mutationFn: () => adminService.players.bulkInvite(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-players"] });
      qc.invalidateQueries({ queryKey: ["players-pending-count"] });
      toast.success(`Invitaciones enviadas: ${res.sent} de ${res.total}`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al enviar invitaciones"),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePlayerPayload) => adminService.players.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-players"] });
      toast.success(`Jugador "${res.name}" creado correctamente`);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      router.push(`/jugadores/${res.id}`);
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al crear jugador"),
  });

  // Debounce text search 300 ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page when filters or sorting change
  useEffect(() => { setPage(1); }, [genderFilter, levelFilter, activationFilter, sortBy, sortDir]);

  const { data: result, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey:        ["admin-players", page, genderFilter, levelFilter, activationFilter, search, sortBy, sortDir],
    queryFn:         () => adminService.players.list({
      page,
      pageSize: PAGE_SIZE,
      gender:           genderFilter     !== "all" ? genderFilter     : undefined,
      level:            levelFilter      !== "all" ? levelFilter      : undefined,
      activationStatus: activationFilter !== "all" ? activationFilter : undefined,
      q:        search || undefined,
      sortBy,
      sortDir,
    }),
    placeholderData: (prev) => prev,
  });

  const { data: pendingResult } = useQuery({
    queryKey: ["players-pending-count"],
    queryFn:  () => adminService.players.list({ activationStatus: "unactivated", pageSize: 1 }),
    staleTime: 60_000,
  });
  const pendingCount = pendingResult?.total ?? 0;

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
            {row.original.activationStatus === "pending_invite" && (
              <p className="flex items-center gap-1 text-[10px] font-medium text-orange-400 mt-0.5">
                <AlertTriangle size={10} />
                Sin acceso a la app — añadir email
              </p>
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
          {CATEGORY_LABEL[getValue() as CategoryLevel]}
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

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data:             players,
    columns,
    state:            { sorting },
    onSortingChange:  setSorting,
    getCoreRowModel:  getCoreRowModel(),
    manualPagination: true,
    manualSorting:    true,
  });

  const levels: CategoryLevel[] = ["1a","2a","3a","4a","5a","6a","iniciacion"];

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Jugadores" />

      <div className="flex-1 p-6 space-y-5">

        {/* Filters bar — search top on mobile, inline on sm+ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
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

          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {([
              { key: "all",        label: "Todos"        },
              { key: "unactivated", label: "Sin activar"  },
              { key: "active",     label: "Activados"    },
            ] as { key: "all" | "unactivated" | "active"; label: string }[]).map((f) => (
              <button
                key={f.key}
                onClick={() => setActivationFilter(f.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activationFilter === f.key
                    ? f.key === "unactivated"
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/30"
                      : "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border w-full sm:flex-1 sm:max-w-xs">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono..."
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
            {isFetching && <Loader2 size={12} className="animate-spin text-muted-foreground shrink-0" />}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto flex-wrap">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {total} jugadores
            </span>
            {pendingCount > 0 && (
              <button
                onClick={() => bulkInviteMut.mutate()}
                disabled={bulkInviteMut.isPending}
                title="Invitar a todos los jugadores pendientes"
                aria-label="Invitar pendientes"
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-md bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 font-medium hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {bulkInviteMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span className="hidden sm:inline">Invitar pendientes ({pendingCount})</span>
                <span className="sm:hidden">({pendingCount})</span>
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              title="Crear jugador"
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-md bg-[rgba(212,175,55,0.15)] border border-[rgba(212,175,55,0.3)] text-xs text-[#D4AF37] font-medium hover:bg-[rgba(212,175,55,0.25)] transition-colors"
            >
              <UserPlus size={13} />
              <span className="hidden sm:inline">Crear jugador</span>
            </button>
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
              title="Exportar CSV"
              aria-label="Exportar CSV"
              className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Mobile: skeleton */}
        {isLoading && (
          <div className="sm:hidden space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3">
                <div className="w-9 h-9 rounded-full bg-secondary animate-pulse" />
                <div className="h-4 flex-1 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-12 rounded bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Mobile: cards */}
        {!isLoading && (
          <div className="sm:hidden space-y-2">
            {isError ? (
              <div className="bg-card border border-border rounded-lg py-12 flex flex-col items-center gap-2 text-sm text-destructive">
                <AlertTriangle size={18} />
                <span>Error al cargar los jugadores</span>
                <button onClick={() => refetch()} className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
                  Reintentar
                </button>
              </div>
            ) : table.getRowModel().rows.length === 0 ? (
              <div className="bg-card border border-border rounded-lg py-12 text-center text-sm text-muted-foreground">
                No se encontraron jugadores
              </div>
            ) : (
              table.getRowModel().rows.map((row, idx) => {
                const p = row.original;
                const spaColor = p.spa ? LEVEL_COLOR[p.spa.spaLevel] : null;
                const winRate  = p.played > 0 ? Math.round((p.wins / p.played) * 100) : 0;
                return (
                  <Link
                    key={row.id}
                    href={`/jugadores/${p.id}`}
                    className="block bg-card border border-border rounded-lg p-3 hover:border-[rgba(212,175,55,0.3)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-muted-foreground shrink-0 w-7 text-center">
                        #{(page - 1) * PAGE_SIZE + idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                        <span className="text-[11px] font-bold text-[#D4AF37]">
                          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.gender === "M" ? "Masc." : "Fem."}</p>
                      </div>
                      <span className="inline-flex shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)]">
                        {CATEGORY_LABEL[p.level]}
                      </span>
                    </div>
                    {p.activationStatus === "pending_invite" && (
                      <p className="flex items-center gap-1 text-[10px] font-medium text-orange-400 mt-1.5">
                        <AlertTriangle size={10} /> Sin acceso a la app — añadir email
                      </p>
                    )}
                    {p.partner && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 truncate">c/ {p.partner}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-border/60 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground tabular-nums">{(p.points ?? 0).toLocaleString()}</span>
                        <span className="text-muted-foreground">pts</span>
                        {TREND_ICON[p.trend]}
                      </div>
                      {p.spa && spaColor && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border"
                          style={{ color: spaColor, backgroundColor: spaColor + "22", borderColor: spaColor + "55" }}
                        >
                          SPA {p.spa.spaPoints.toFixed(0)}
                        </span>
                      )}
                      <span className="text-muted-foreground tabular-nums">
                        {p.played}J · {winRate}%
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}

        {/* Desktop: table */}
        <div className="hidden sm:block bg-card border border-border rounded-lg overflow-hidden">
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
                    {isError ? (
                      <tr>
                        <td colSpan={columns.length} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-2 text-sm text-destructive">
                            <AlertTriangle size={18} />
                            <span>Error al cargar los jugadores</span>
                            <button
                              onClick={() => refetch()}
                              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
                            >
                              Reintentar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : table.getRowModel().rows.length === 0 ? (
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
            </>
          )}
        </div>

        {/* Shared pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-card border border-border">
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
      </div>

      {/* Create player modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <UserPlus size={16} className="text-[#D4AF37]" />
                <h2 className="text-sm font-semibold text-foreground">Nuevo jugador</h2>
              </div>
              <button
                onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="Ej: Carlos"
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Apellidos *</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Ej: García López"
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Gender + Level */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Género *</label>
                  <div className="flex gap-2">
                    {([["M", "Masculino"], ["F", "Femenino"]] as [Gender, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, gender: val }))}
                        className={`flex-1 h-9 rounded-md text-xs font-medium border transition-colors ${
                          form.gender === val
                            ? "bg-[rgba(212,175,55,0.15)] border-[rgba(212,175,55,0.4)] text-[#D4AF37]"
                            : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <select
                    value={form.categoryLevel ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, categoryLevel: (e.target.value || undefined) as CategoryLevel | undefined }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">Sin asignar</option>
                    {(["1a","2a","3a","4a","5a","6a","iniciacion"] as CategoryLevel[]).map((l) => (
                      <option key={l} value={l}>{CATEGORY_LABEL[l]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jugador@email.com (se le enviará invitación)"
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
                {!form.email?.trim() && form.firstName.trim() ? (
                  <p className="text-[10px] text-amber-500 flex items-center gap-1">
                    <span>⚠</span> Sin email este jugador no podrá activar su cuenta en la app
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Si se indica, recibirá un email para activar su cuenta.</p>
                )}
              </div>

              {/* Phone + City */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                  <input
                    value={form.phone ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+34 600 000 000"
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ciudad</label>
                  <input
                    value={form.city ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="Madrid"
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Position + Hand */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Posición</label>
                  <select
                    value={form.position ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, position: (e.target.value || undefined) as CreatePlayerPayload["position"] }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">No indicado</option>
                    <option value="reves">Revés</option>
                    <option value="drive">Drive</option>
                    <option value="indiferente">Indiferente</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Mano</label>
                  <select
                    value={form.hand ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, hand: (e.target.value || undefined) as CreatePlayerPayload["hand"] }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">No indicado</option>
                    <option value="diestro">Diestro</option>
                    <option value="zurdo">Zurdo</option>
                    <option value="ambidiestro">Ambidiestro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}
                className="px-4 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={!form.firstName.trim() || !form.lastName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  ...form,
                  email:    form.email?.trim()  || undefined,
                  phone:    form.phone?.trim()  || undefined,
                  city:     form.city?.trim()   || undefined,
                })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-[#D4AF37] text-black hover:bg-[#C9A227] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                Crear jugador
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
