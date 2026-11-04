"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eraser, Loader2, Search, UserX } from "lucide-react";
import { ApiError } from "@/lib/api";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { Pagination, useKeepPageInRange, usePagination } from "@/components/admin/pagination";
import { adminService } from "@/lib/services/admin";
import { DEFAULT_TIME_ZONE, dateOnlyKey, formatDayKey, formatInTimeZone } from "@/lib/utils/time-zone";
import type { DeletedPlayer } from "@/types";

// Bajo «admin-players»: al borrar a un jugador desde su ficha se recarga también
const DELETED_PLAYERS_QK = ["admin-players", "deleted"] as const;

const DATE_SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/**
 * Las cuentas que borró un admin conservando el nombre, con «Anonimizar»
 * (decisión 30-10): caso por caso y a petición de la persona, quita su nombre
 * como la supresión. Nunca en masa. Solo AMT (el back no deja a un club).
 * Se cargan al abrir la sección.
 */
export function DeletedAccounts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { page, setPage, pageSize, setPageSize } = usePagination();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<DeletedPlayer | null>(null);

  // Como el buscador de Jugadores: 300 ms sin escribir y a la primera página
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput, setPage]);

  const { data: result, isLoading, isFetching, isError, isPlaceholderData, refetch } = useQuery({
    queryKey:        [...DELETED_PLAYERS_QK, page, pageSize, search],
    queryFn:         () => adminService.players.deleted({ page, pageSize, q: search || undefined }),
    enabled:         open,
    placeholderData: (prev) => prev,
  });
  const accounts = result?.data ?? [];
  const total    = result?.total ?? 0;
  // Al anonimizar la última de una página, a la anterior
  useKeepPageInRange(page, setPage, pageSize, isPlaceholderData ? undefined : result?.total);

  // Es definitivo: un doble clic en «Anonimizar» no debe mandar dos (el
  // segundo daría «no encontrado»). isPending llega tarde; el candado es síncrono
  const anonymizingRef = useRef(false);
  const anonymize = useMutation({
    mutationFn: (id: string) => adminService.players.anonymize(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DELETED_PLAYERS_QK });
      toast.success("Cuenta anonimizada");
      setTarget(null);
    },
    onError: (err: Error) => {
      // Ya no está para anonimizar (otro admin lo hizo entretanto): cada
      // reintento fallaría igual, así que se cierra y se recarga la lista
      if (err instanceof ApiError && err.code === "PLAYER_NOT_FOUND") {
        toast.error("Esta cuenta ya no se puede anonimizar (quizá ya se hizo). Se ha recargado la lista.");
        qc.invalidateQueries({ queryKey: DELETED_PLAYERS_QK });
        setTarget(null);
        return;
      }
      toast.error(err.message || "No se pudo anonimizar la cuenta");
    },
    onSettled: () => { anonymizingRef.current = false; },
  });
  const confirmAnonymize = () => {
    if (!target || anonymizingRef.current) return;
    anonymizingRef.current = true;
    anonymize.mutate(target.id);
  };

  return (
    <>
      <details
        className="bg-card border border-border rounded-lg overflow-hidden"
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground">
          <UserX size={14} /> Cuentas borradas
        </summary>
        <div className="border-t border-border p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Cuentas que se borraron conservando el nombre en los cuadros y resultados. Si la persona pide que se quite, anonimízala.
          </p>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary border border-border w-full sm:max-w-xs">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre..."
              aria-label="Buscar cuentas borradas por nombre"
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
            />
            {isFetching && <Loader2 size={12} className="animate-spin text-muted-foreground shrink-0" />}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {isError && <ErrorState message="No se pudieron cargar las cuentas borradas." onRetry={() => void refetch()} />}
          {!isLoading && !isError && result && accounts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search ? "Ninguna cuenta borrada con ese nombre." : "No hay cuentas borradas que conserven el nombre."}
            </p>
          )}
          {!isError && accounts.length > 0 && (
            <ul className="divide-y divide-border border border-border rounded-md">
              {accounts.map((a) => (
                <li key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {/* El instante de la baja, en hora de España como el resto del historial */}
                      Baja el {formatInTimeZone(a.deletedAt, DEFAULT_TIME_ZONE, DATE_SHORT)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {a.lastTournament
                        ? `Último torneo: ${a.lastTournament.name} (${formatDayKey(dateOnlyKey(a.lastTournament.startDate), DATE_SHORT)})`
                        : "Sin torneos"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTarget(a)}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/30 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Eraser size={12} />
                    Anonimizar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isLoading && !isError && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="cuentas"
              busy={isFetching}
            />
          )}
        </div>
      </details>

      <ConfirmModal
        open={target !== null}
        danger
        title="Anonimizar cuenta"
        description={`Se quitará el nombre de ${target?.name ?? ""} y es definitivo: no se puede deshacer. Los cuadros y resultados en los que jugó mostrarán «Usuario eliminado» en vez de su nombre, y se borrarán sus mensajes de soporte.`}
        confirmLabel="Anonimizar"
        loading={anonymize.isPending}
        onClose={() => { if (!anonymize.isPending) setTarget(null); }}
        onConfirm={confirmAnonymize}
      />
    </>
  );
}
