"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { adminService, registrationsQK } from "@/lib/services/admin";
import { localDayKey } from "@/lib/utils/date-keys";
import { pairPlayers, type PaymentPlayer } from "@/lib/utils/registration-pairs";
import type { AdminRegistration } from "@/types";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "TPV", "Online"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Lo que dice la API cuando la inscripción cambió desde que se abrió el modal. */
const CHANGED_MEANWHILE = new Set(["REGISTRATION_INVALID_TRANSITION", "PARTNER_NOT_FOUND", "REGISTRATION_NOT_FOUND"]);

interface Props {
  /** Se monta al abrirlo, con la inscripción de ese momento. */
  registration: AdminRegistration;
  /** De quién es el pago: el titular de la inscripción o su compañero. */
  player:       PaymentPlayer;
  tournamentId: string;
  onClose: () => void;
}

// La fecha de pago se guarda como día (medianoche UTC): se lee en UTC para
// que salga el mismo día en cualquier zona. Hoy, en cambio, es el día local
const toDateInput = (d: string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export default function PaymentModal({ registration, player, tournamentId, onClose }: Props) {
  const who = pairPlayers(registration).find((p) => p.player === player);
  const current = who?.payment;
  const [paid,   setPaid]   = useState(current?.paid ?? false);
  const [method, setMethod] = useState<PaymentMethod | "">((current?.paymentMethod as PaymentMethod | null | undefined) ?? "");
  const [paidAt, setPaidAt] = useState<string>(toDateInput(current?.paidAt));
  const [note,   setNote]   = useState<string>(current?.paymentNote ?? "");
  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: () =>
      adminService.registrations.updatePayment(registration.id, {
        paid,
        // Sin pagar, sin método ni fecha (no los de un pago que se desmarca)
        paymentMethod: (paid && method) || undefined,
        paidAt:        (paid && paidAt) || undefined,
        paymentNote:   note.trim() || undefined,
        player,
        playerId:      who?.id ?? "",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: registrationsQK.list(tournamentId) });
      toast.success("Pago actualizado");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al actualizar el pago");
      // Si la inscripción cambió entretanto (otra pareja, sin pareja o ya no
      // está), con la de antes cada reintento fallaría igual: se cierra y se
      // recarga la lista. Con otros errores (red, validación) sigue abierto
      if (err instanceof ApiError && err.code && CHANGED_MEANWHILE.has(err.code)) {
        qc.invalidateQueries({ queryKey: registrationsQK.list(tournamentId) });
        onClose();
      }
    },
  });

  const playerName = who?.name ?? "";
  // Mientras guarda no se cierra: la respuesta cerraría el modal que se
  // abriera después (el de otro jugador)
  const close = () => { if (!saveMut.isPending) onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Estado de pago</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{playerName}</p>
          </div>
          <button onClick={close} disabled={saveMut.isPending} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Paid toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Pagado</label>
            <button
              onClick={() => {
                setPaid((v) => {
                  const next = !v;
                  // Auto-fill today as default when marking paid for the first time
                  if (next && !paidAt) setPaidAt(localDayKey(new Date()));
                  return next;
                });
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                paid ? "bg-green-500" : "bg-secondary border border-border"
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                paid ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          {paid && (
            <>
              {/* Payment method */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m === method ? "" : m)}
                      className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                        method === m
                          ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border-[rgba(212,175,55,0.4)]"
                          : "bg-secondary text-muted-foreground border-border hover:border-[rgba(212,175,55,0.3)] hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Fecha de pago</label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>
            </>
          )}

          {/* Note: también sin pagar ("paga el sábado"); se guarda siempre */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Nota</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Observaciones opcionales…"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={close}
            disabled={saveMut.isPending}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !who}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saveMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando…</>
            ) : (
              <><CreditCard size={14} /> Guardar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
