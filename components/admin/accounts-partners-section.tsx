"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { AccountsPartnerShares } from "@/components/admin/accounts-partner-shares";
import { accountsQK, accountsService, type ClubPartner } from "@/lib/services/accounts";
import { profitQK } from "@/lib/services/profit";
import { treasuryQK, treasuryService } from "@/lib/services/treasury";
import { accountsErrorText } from "@/lib/utils/booking-parts";
import { pendingSentence, pendingSettlements } from "@/lib/utils/treasury";

const FIELD =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:border-[#D4AF37]";
const NAME_MAX = 60;

/**
 * «Socios del club»: las personas a cuyo móvil llega un Bizum (el club no
 * tiene Bizum propio). Al cobrar por Bizum se elige uno o «Club». No se
 * borran: se desactivan y dejan de ofrecerse, pero lo cobrado sigue a su nombre.
 * Con la tesorería encendida, desactivar a quien guarda dinero del club (o a
 * quien el club debe) pide confirmación: se salda después desde Tesorería.
 */
export function AccountsPartnersSection({ clubId, treasuryOn = false }: {
  clubId:      string;
  /** Con la tesorería encendida y permiso de cuentas: las partes del reparto, debajo de la lista, y el aviso del saldo al desactivar. */
  treasuryOn?: boolean;
}) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  // Un socio con saldo al que se va a dar de baja, con lo pendiente tal como estaba al pulsar
  const [confirming, setConfirming] = useState<{ id: string; name: string; pending: string } | null>(null);

  const query = useQuery({
    queryKey: accountsQK.partners(clubId),
    queryFn: () => accountsService.partners.list(clubId),
  });
  // Lo que guarda o le debe a cada socio sale del resumen de Tesorería (la misma consulta que esa pestaña)
  const treasury = useQuery({
    queryKey: treasuryQK.summary(clubId),
    queryFn: () => treasuryService.summary(clubId),
    enabled: treasuryOn,
  });
  // Un socio nuevo o dado de baja cambia a quién se reparte (las partes se vuelven a pedir) y qué puede hacer en Tesorería
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: accountsQK.partners(clubId) }),
    qc.invalidateQueries({ queryKey: treasuryQK.all(clubId) }),
    qc.invalidateQueries({ queryKey: profitQK.current(clubId) }),
    qc.invalidateQueries({ queryKey: profitQK.partnerShares(clubId) }),
  ]);

  const create = useMutation({
    mutationFn: (name: string) => accountsService.partners.create(clubId, name),
    onSuccess: () => { setNewName(""); toast.success("Socio añadido"); return refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; data: { name?: string; active?: boolean } }) =>
      accountsService.partners.update(clubId, v.id, v.data),
    onSuccess: () => { setEditing(null); return refresh(); },
    onError: (err: unknown) => toast.error(accountsErrorText(err)),
  });
  const busy = create.isPending || update.isPending;
  // Hasta saber su saldo, no se da de baja a nadie: el aviso depende de él
  const waitingBalance = treasuryOn && treasury.isPending;

  const deactivate = (p: ClubPartner) => {
    const summary = treasury.data;
    const balance = summary?.started ? summary.partners.find((t) => t.partnerId === p.id) : undefined;
    const pending = balance ? pendingSettlements(balance) : [];
    if (pending.length > 0) setConfirming({ id: p.id, name: p.name, pending: pendingSentence(p.name, pending) });
    else update.mutate({ id: p.id, data: { active: false } });
  };

  const name = newName.trim();
  const editedName = editing?.name.trim() ?? "";

  return (
    <section aria-labelledby="partners-title" className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div>
        <h2 id="partners-title" className="font-heading text-lg text-foreground">Socios del club</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Son las personas a cuyo móvil llega un Bizum. Al cobrar por Bizum eliges si llegó a uno de ellos o al club.
          Si dejas de usar a alguien, desactívalo: lo ya cobrado sigue a su nombre.
        </p>
      </div>

      {query.isError ? (
        <ErrorState title="No se pudieron cargar los socios" onRetry={() => query.refetch()} />
      ) : !query.data ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay ningún socio. Añade el primero aquí abajo.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {query.data.map((p: ClubPartner) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing?.id === p.id ? (
                <>
                  <input
                    type="text"
                    aria-label="Nuevo nombre del socio"
                    value={editing.name}
                    maxLength={NAME_MAX}
                    autoFocus
                    onChange={(e) => setEditing({ id: p.id, name: e.target.value })}
                    className={`${FIELD} max-w-xs`}
                  />
                  <button
                    type="button"
                    aria-label="Guardar el nombre"
                    disabled={busy || editedName === ""}
                    onClick={() => update.mutate({ id: p.id, data: { name: editedName } })}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-[#D4AF37] text-[#0C0C0C] disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Cancelar"
                    onClick={() => setEditing(null)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className={`text-sm font-medium ${p.active ? "text-foreground" : "text-muted-foreground line-through"}`}>
                    {p.name}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs ${
                      p.active ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.active ? "Activo" : "Desactivado"}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      aria-label={`Renombrar a ${p.name}`}
                      disabled={busy}
                      onClick={() => setEditing({ id: p.id, name: p.name })}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border hover:bg-secondary disabled:opacity-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy || (p.active && waitingBalance)}
                      onClick={() => (p.active ? deactivate(p) : update.mutate({ id: p.id, data: { active: true } }))}
                      className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary disabled:opacity-50"
                    >
                      {p.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name !== "") create.mutate(name);
        }}
      >
        <input
          type="text"
          aria-label="Nombre del nuevo socio"
          placeholder="Nombre del socio"
          value={newName}
          maxLength={NAME_MAX}
          onChange={(e) => setNewName(e.target.value)}
          className={`${FIELD} max-w-xs`}
        />
        <button
          type="submit"
          disabled={busy || name === ""}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-[#D4AF37] px-5 text-sm font-semibold text-[#0C0C0C] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Añadir socio
        </button>
      </form>

      {treasuryOn && <AccountsPartnerShares clubId={clubId} />}

      <ConfirmModal
        open={confirming !== null}
        title={confirming ? `¿Desactivar a ${confirming.name}?` : ""}
        description={confirming ? `${confirming.pending}. Podrás saldarlo después desde Tesorería.` : ""}
        confirmLabel="Desactivar"
        loading={update.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          confirming && update.mutate({ id: confirming.id, data: { active: false } }, { onSettled: () => setConfirming(null) })}
      />
    </section>
  );
}
