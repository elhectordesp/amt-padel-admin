"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, CreditCard, Check } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { adminService, registrationsQK } from "@/lib/services/admin";
import { pairPlayers, type PaymentPlayer } from "@/lib/utils/registration-pairs";
import type { AdminRegistration } from "@/types";

// Los mismos métodos que el pago por jugador (payment-modal.tsx)
const PAYMENT_METHODS = ["Efectivo", "Transferencia", "TPV", "Online"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Lo que dice la API cuando la inscripción cambió desde que se abrió el modal. */
const CHANGED_MEANWHILE = new Set(["REGISTRATION_INVALID_TRANSITION", "PARTNER_NOT_FOUND", "REGISTRATION_NOT_FOUND"]);

interface Props {
  /** Se monta al abrirlo, con la inscripción de ese momento. */
  registration: AdminRegistration;
  tournamentId: string;
  onClose: () => void;
}

/**
 * «Cobrar pareja»: en la mesa del torneo, cobra a los dos jugadores con un
 * método y confirma la pareja en un paso. Corregir el pago de un solo jugador
 * sigue siendo el modal de «Estado de pago».
 */
export default function PayPairModal({ registration, tournamentId, onClose }: Props) {
  const players = pairPlayers(registration);
  const qc = useQueryClient();
  // Marcados por defecto los que aún no han pagado
  const [selected, setSelected] = useState<Set<PaymentPlayer>>(
    () => new Set(players.filter((p) => !p.payment.paid).map((p) => p.player)),
  );
  const [method, setMethod] = useState<PaymentMethod | "">("");

  const status = registration.status;
  const confirmsOnSave = status === "PENDING";
  const price = registration.category.price;

  const saveMut = useMutation({
    mutationFn: () =>
      adminService.registrations.payPair(registration.id, {
        players:       players.filter((p) => selected.has(p.player)).map((p) => p.player),
        paymentMethod: method,
        titularId:     registration.userId,
        partnerId:     registration.partnerId ?? undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: registrationsQK.list(tournamentId) });
      if (res.confirmed) toast.success("Cobrado y pareja confirmada");
      else if (status === "WAITLIST") toast.success("Cobrado. Sigue en la lista de espera");
      else if (confirmsOnSave) toast.warning("Cobrado, pero la pareja sigue pendiente: este torneo exige que paguen los dos para confirmar");
      else toast.success("Cobrado");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al cobrar la pareja");
      // Si la inscripción cambió entretanto, reintentar con la de antes fallaría igual
      if (err instanceof ApiError && err.code && CHANGED_MEANWHILE.has(err.code)) {
        qc.invalidateQueries({ queryKey: registrationsQK.list(tournamentId) });
        onClose();
      }
    },
  });

  const toggle = (player: PaymentPlayer) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(player)) next.delete(player);
      else next.add(player);
      return next;
    });

  // Mientras guarda no se cierra: la respuesta cerraría el modal que se abriera después
  const close = () => { if (!saveMut.isPending) onClose(); };
  const canSave = selected.size > 0 && method !== "" && !saveMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Cobrar pareja</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Precio de la inscripción: <strong className="text-foreground">{price} €</strong>
            </p>
          </div>
          <button onClick={close} disabled={saveMut.isPending} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-40">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <label
                key={p.player}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-secondary/40 ${p.payment.paid ? "opacity-70" : "cursor-pointer"}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.player)}
                  disabled={p.payment.paid || saveMut.isPending}
                  onChange={() => toggle(p.player)}
                  className="h-4 w-4 accent-[#D4AF37]"
                />
                <span className="flex-1 min-w-0 truncate text-sm text-foreground">{p.name}</span>
                {p.payment.paid && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                    <Check size={12} /> Pagado
                  </span>
                )}
              </label>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Método de pago</label>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
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

          {confirmsOnSave && (
            <p className="text-xs text-muted-foreground">Al guardar, la pareja queda confirmada.</p>
          )}
          {status === "WAITLIST" && (
            <p className="text-xs text-yellow-400">
              Está en la lista de espera: se cobra, pero no se confirma. Sube cuando haya plaza.
            </p>
          )}
        </div>

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
            disabled={!canSave}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saveMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando…</>
            ) : (
              <><CreditCard size={14} /> {confirmsOnSave ? "Cobrar y confirmar" : "Cobrar"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
