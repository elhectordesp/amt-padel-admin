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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Estado de pago</h2>
            <p className="text-sm text-gray-500 mt-0.5">{playerName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Paid toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Pagado</label>
            <button
              onClick={() => setPaid((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                paid ? "bg-green-500" : "bg-gray-200"
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Método de pago</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m === method ? "" : m)}
                      className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                        method === m
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de pago</label>
                <input
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Observaciones opcionales…"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saveMut.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              <><CreditCard className="w-4 h-4" /> Guardar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
