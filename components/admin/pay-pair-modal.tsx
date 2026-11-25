"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, CreditCard, Check } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { BizumReceiverPicker, type BizumReceiver } from "@/components/admin/bizum-receiver";
import { AmountField, PaymentMethodPicker } from "@/components/admin/payment-fields";
import { adminService, registrationsQK } from "@/lib/services/admin";
import { useBizumReceivers } from "@/lib/use-bizum-receivers";
import { centsToEurosInput, eurosToCents, playerShareCents } from "@/lib/utils/payment-methods";
import { pairPlayers, type PaymentPlayer } from "@/lib/utils/registration-pairs";
import type { AdminRegistration } from "@/types";

/** Lo que dice la API cuando la inscripción cambió desde que se abrió el modal. */
const CHANGED_MEANWHILE = new Set(["REGISTRATION_INVALID_TRANSITION", "PARTNER_NOT_FOUND", "REGISTRATION_NOT_FOUND"]);

interface Props {
  /** Se monta al abrirlo, con la inscripción de ese momento. */
  registration: AdminRegistration;
  tournamentId: string;
  /** El club del torneo: con el módulo Cuentas, un Bizum pregunta a qué móvil llegó cada pago. */
  clubId?:      string | null;
  onClose: () => void;
}

/**
 * «Cobrar pareja»: en la mesa del torneo, cobra a los dos jugadores con un
 * método y confirma la pareja en un paso. Corregir el pago de un solo jugador
 * sigue siendo el modal de «Estado de pago».
 */
export default function PayPairModal({ registration, tournamentId, clubId = null, onClose }: Props) {
  const players = pairPlayers(registration);
  const qc = useQueryClient();
  const bizumReceivers = useBizumReceivers(clubId);
  // A qué móvil llegó el Bizum de cada jugador cobrado
  const [receivers, setReceivers] = useState<Record<PaymentPlayer, BizumReceiver>>({ titular: undefined, partner: undefined });
  // Marcados por defecto los que aún no han pagado
  const [selected, setSelected] = useState<Set<PaymentPlayer>>(
    () => new Set(players.filter((p) => !p.payment.paid).map((p) => p.player)),
  );
  const [method, setMethod] = useState<string>("");

  const status = registration.status;
  const confirmsOnSave = status === "PENDING";
  const price = registration.category.price;
  // Lo cobrado a cada jugador marcado; sin tocar, la mitad del precio de la pareja
  const [amount, setAmount] = useState(centsToEurosInput(playerShareCents(price)));
  const cents = eurosToCents(amount);
  const askReceivers = method === "BIZUM" && bizumReceivers !== undefined;
  const receiverPlayers = players.filter((p) => selected.has(p.player));

  const saveMut = useMutation({
    mutationFn: () =>
      adminService.registrations.payPair(registration.id, {
        players:       receiverPlayers.map((p) => p.player),
        paymentMethod: method,
        ...(askReceivers && selected.has("titular") ? { bizumPartnerId: receivers.titular as string | null } : {}),
        ...(askReceivers && selected.has("partner") ? { partnerBizumPartnerId: receivers.partner as string | null } : {}),
        ...(cents !== null ? { paidAmountCents: cents } : {}),
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
  const canSave =
    selected.size > 0 && method !== "" && cents !== null && !saveMut.isPending &&
    (!askReceivers || receiverPlayers.every((p) => receivers[p.player] !== undefined));

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

          <PaymentMethodPicker value={method} onChange={setMethod} disabled={saveMut.isPending} />
          {askReceivers && receiverPlayers.map((p) => (
            <BizumReceiverPicker
              key={p.player}
              partners={bizumReceivers}
              who={p.name}
              value={receivers[p.player]}
              onChange={(r) => setReceivers((prev) => ({ ...prev, [p.player]: r }))}
              disabled={saveMut.isPending}
            />
          ))}
          <AmountField label="Importe por jugador" value={amount} onChange={setAmount} invalid={cents === null} disabled={saveMut.isPending} />

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
