"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import type { AdminRegistration } from "@/types";

const PAYMENT_METHODS = ["Efectivo", "Transferencia", "TPV", "Online"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

interface Props {
  registration: AdminRegistration;
  tournamentId: string;
  onClose: () => void;
}

export default function PaymentModal({ registration, tournamentId, onClose }: Props) {
  const [paid,   setPaid]   = useState(registration.paid);
  const [method, setMethod] = useState<PaymentMethod | "">((registration.paymentMethod as PaymentMethod | undefined) ?? "");
  const [paidAt, setPaidAt] = useState<string>(registration.paidAt ? new Date(registration.paidAt).toISOString().slice(0, 10) : "");
  const [note,   setNote]   = useState<string>(registration.paymentNote ?? "");
  const qc = useQueryClient();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaid(registration.paid);
    setMethod((registration.paymentMethod as PaymentMethod | undefined) ?? "");
    setPaidAt(registration.paidAt ? new Date(registration.paidAt).toISOString().slice(0, 10) : "");
    setNote(registration.paymentNote ?? "");
  }, [registration]);

  const saveMut = useMutation({
    mutationFn: () =>
      adminService.registrations.updatePayment(registration.id, {
        paid,
        paymentMethod: method || undefined,
        paidAt:        paidAt || undefined,
        paymentNote:   note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-registrations", tournamentId] });
      toast.success("Pago actualizado");
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? "Error al actualizar el pago");
    },
  });

  const playerName = registration.user.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Estado de pago</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{playerName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Paid toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Pagado</label>
            <button
              onClick={() => setPaid((v) => !v)}
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

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Nota</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Observaciones opcionales…"
                  className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
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
