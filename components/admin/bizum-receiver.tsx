"use client";

import { X } from "lucide-react";
import type { ClubPartner } from "@/lib/services/accounts";

/**
 * A qué móvil llegó un Bizum: el de un socio activo del club o «Club». El
 * valor es el id del socio, `null` para «Club» y `undefined` mientras no se ha
 * elegido (el cobro no se deja guardar así).
 */
export type BizumReceiver = string | null | undefined;

const CHOICE =
  "min-h-11 px-4 rounded-md border text-sm font-medium transition-colors disabled:opacity-50";

export function BizumReceiverPicker({
  partners, value, onChange, disabled, who,
}: {
  /** Solo los socios activos. */
  partners: ClubPartner[];
  value:    BizumReceiver;
  onChange: (receiver: string | null) => void;
  disabled?: boolean;
  /** De quién es el Bizum, cuando un mismo cobro lleva más de uno (los dos jugadores de una pareja). */
  who?: string;
}) {
  const options: { id: string | null; name: string }[] = [
    { id: null, name: "Club" },
    ...partners.map((p) => ({ id: p.id, name: p.name })),
  ];
  return (
    <div role="group" aria-label={who ? `Móvil al que llegó el Bizum de ${who}` : "Móvil al que llegó el Bizum"}>
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        {who ? `¿A qué móvil llegó el Bizum de ${who}?` : "¿A qué móvil llegó el Bizum?"}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id ?? "club"}
            type="button"
            aria-pressed={value === o.id}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`${CHOICE} ${
              value === o.id
                ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border-[rgba(212,175,55,0.4)]"
                : "bg-secondary text-muted-foreground border-border hover:border-[rgba(212,175,55,0.3)] hover:text-foreground"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** El mismo selector en su propio diálogo: pulsar uno cobra ya (para el «Bizum» de un botón grande). */
export function BizumReceiverDialog({
  partners, subtitle, onPick, onClose,
}: {
  partners: ClubPartner[];
  /** Qué se cobra (la reserva o la parte y su importe). */
  subtitle: string;
  onPick:   (receiver: string | null) => void;
  onClose:  () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-label="Bizum" className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Cobrar por Bizum</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>
        <div className="p-5">
          <BizumReceiverPicker partners={partners} value={undefined} onChange={onPick} />
        </div>
      </div>
    </div>
  );
}
