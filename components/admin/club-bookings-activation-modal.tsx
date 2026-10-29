"use client";

/**
 * Reservas de un club, vistas por AMT desde Clubes: en qué estado está el
 * módulo y, si aún no está activado, el botón de aprobar la activación (el
 * club la pide desde su panel y a AMT le llega el aviso). Aprobada, el club
 * la prueba con sus testers y la abre al público él mismo.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { formatInTimeZone, DEFAULT_TIME_ZONE } from "@/lib/utils/time-zone";
import type { Club } from "@/types";

export function ClubBookingsActivationModal({
  club,
  onClose,
}: {
  club: Pick<Club, "id" | "name">;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: bookingsQK.activation(club.id),
    queryFn: () => bookingsService.activation.state(club.id),
  });

  const approve = useMutation({
    mutationFn: () => bookingsService.activation.approve(club.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: bookingsQK.activation(club.id) });
      toast.success("Activación aprobada: el club ya puede probar las reservas con sus testers");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "No se pudo aprobar la activación";
      toast.error(msg);
    },
  });

  const state = query.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-bookings-title"
        className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarCheck size={16} className="text-[#D4AF37] shrink-0" />
            <h2 id="club-bookings-title" className="font-heading text-base truncate">
              Reservas — {club.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>

        {query.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : query.isError || !state ? (
          <p className="text-sm text-destructive">No se pudo cargar el estado de las reservas del club.</p>
        ) : state.status === "INACTIVE" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              El módulo de reservas no está activado. Si el club ha pedido la
              activación y tiene la configuración lista, apruébala: podrá
              probarlo con sus testers y abrirlo al público cuando quiera.
            </p>
            <button
              onClick={() => approve.mutate()}
              disabled={approve.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold bg-[#D4AF37] text-[#0C0C0C] hover:bg-[#C49F2A] disabled:opacity-60"
            >
              {approve.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Aprobar activación
            </button>
          </div>
        ) : state.status === "TESTER_MODE" ? (
          <p className="text-sm text-muted-foreground">
            Aprobado, en modo prueba: solo lo ven sus {state.activeTesterCount} tester(s)
            activos. Lo abre al público el club desde su panel.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Abierto al público
            {state.bookingPublicAt
              ? ` desde el ${formatInTimeZone(state.bookingPublicAt, DEFAULT_TIME_ZONE, { dateStyle: "short" })}`
              : ""}
            .
          </p>
        )}
      </div>
    </div>
  );
}
