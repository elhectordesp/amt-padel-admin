"use client";

/**
 * Administradores de un club, vistos por AMT desde Clubes: quién lo
 * administra, las invitaciones sin aceptar (pendientes y caducadas) con
 * Reenviar y Anular, e Invitar admin a ese mismo club. Cada persona tiene un
 * solo enlace vivo: invitar de nuevo o reenviar deja sin valor el anterior.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCw, Send, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import { clubStatus } from "@/lib/utils/club-status";
import {
  adminSinceLabel, clubAdminsQueryKey, invitationDetail, invitationEmailFailed,
  invitationErrorMessage, invitationStatusLabel, invitationsChangedMeanwhile,
} from "@/lib/utils/club-invitations";
import type { Club, ClubAdminInvitation } from "@/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lo que se confirma: se guarda entero al abrirlo, un refresco no lo cambia. */
type InvitationConfirm = { action: "resend" | "revoke"; invitation: ClubAdminInvitation };

export function ClubAdminsModal({
  club,
  onClose,
}: {
  club: Pick<Club, "id" | "name" | "active" | "status">;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState<InvitationConfirm | null>(null);
  // Su admin no podría entrar: el back no deja invitar ni reenviar (D5)
  const deactivated = clubStatus(club) === "deactivated";

  const queryKey = clubAdminsQueryKey(club.id);
  const query = useQuery({
    queryKey,
    queryFn: () => adminService.clubs.admins(club.id),
  });
  const refresh = () => qc.invalidateQueries({ queryKey });

  const onError = (err: Error) => {
    toast.error(invitationErrorMessage(err));
    if (invitationsChangedMeanwhile(err)) refresh();
  };

  const invite = useMutation({
    mutationFn: (to: string) => adminService.clubs.inviteAdmin(club.id, to),
    onSuccess: async (_res, to) => {
      await refresh();
      setEmail("");
      toast.success(`Invitación enviada a ${to}`);
    },
    onError: (err: Error) => {
      onError(err);
      // Quedó creada: ya sale en la lista para reenviarla
      if (invitationEmailFailed(err)) setEmail("");
    },
  });

  // La invitación va en las variables: el modal de confirmación se cierra
  // al acabar, pase lo que pase
  const resend = useMutation({
    mutationFn: (invitation: ClubAdminInvitation) =>
      adminService.clubs.resendInvitation(club.id, invitation.id),
    onSuccess: async (_res, invitation) => {
      await refresh();
      toast.success(`Invitación reenviada a ${invitation.email}`);
    },
    onError,
    onSettled: () => setConfirm(null),
  });

  const revoke = useMutation({
    mutationFn: (invitation: ClubAdminInvitation) =>
      adminService.clubs.revokeInvitation(club.id, invitation.id),
    onSuccess: async (_res, invitation) => {
      await refresh();
      toast.success(`Invitación a ${invitation.email} anulada`);
    },
    onError,
    onSettled: () => setConfirm(null),
  });

  const confirming = resend.isPending || revoke.isPending;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    const to = email.trim();
    if (!EMAIL_RE.test(to)) {
      toast.error("Introduce un email válido");
      return;
    }
    invite.mutate(to);
  };

  const data = query.data;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="club-admins-title"
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Users size={16} className="text-[#D4AF37] shrink-0" />
              <h2 id="club-admins-title" className="font-heading text-base truncate">
                Administradores — {club.name}
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
          ) : query.isError || !data ? (
            <p className="text-sm text-destructive">No se pudieron cargar los administradores del club.</p>
          ) : (
            <>
              <section className="space-y-2" aria-labelledby="club-admins-list">
                <h3 id="club-admins-list" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Administradores
                </h3>
                {data.admins.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no tiene ningún administrador.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {data.admins.map((admin) => (
                      <li key={admin.id} className="px-3 py-2 text-sm">
                        <p className="font-medium text-foreground break-words">{admin.name}</p>
                        <p className="text-xs text-muted-foreground break-all">
                          {admin.email ?? "Sin email"} · {adminSinceLabel(admin.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-2" aria-labelledby="club-invitations-list">
                <h3 id="club-invitations-list" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Invitaciones sin aceptar
                </h3>
                {data.invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {data.invitations.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="px-3 py-2 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-foreground break-all">{invitation.email}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                invitation.status === "expired"
                                  ? "bg-destructive/10 border-destructive/30 text-destructive"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
                              }`}
                            >
                              {invitationStatusLabel(invitation.status)}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">{invitationDetail(invitation)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setConfirm({ action: "resend", invitation })}
                            disabled={deactivated || confirming}
                            title={deactivated ? "Reactiva el club para reenviarla" : undefined}
                            aria-label={`Reenviar la invitación a ${invitation.email}`}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 disabled:hover:bg-transparent transition-colors whitespace-nowrap"
                          >
                            <RotateCw size={12} />
                            Reenviar
                          </button>
                          <button
                            onClick={() => setConfirm({ action: "revoke", invitation })}
                            disabled={confirming}
                            aria-label={`Anular la invitación a ${invitation.email}`}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors whitespace-nowrap"
                          >
                            <Trash2 size={12} />
                            Anular
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          <form onSubmit={handleInvite} className="space-y-2 border-t border-border pt-4">
            <label htmlFor="club-admin-invite-email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Invitar admin
            </label>
            {deactivated ? (
              <p className="text-xs text-muted-foreground">
                El club está desactivado: reactívalo desde su tarjeta para invitar a su admin.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Le llegará un enlace de 7 días para crear su cuenta de este club. Si ya tenía una invitación, la anterior deja de valer.
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="club-admin-invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@suclub.com"
                autoComplete="email"
                disabled={deactivated}
                className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={deactivated || invite.isPending}
                className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {invite.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Invitar
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.action === "revoke"
          ? `¿Anular la invitación a ${confirm.invitation.email}?`
          : `¿Reenviar la invitación a ${confirm?.invitation.email}?`}
        description={confirm?.action === "revoke"
          ? "Su enlace dejará de valer. Para que administre el club habrá que invitarle de nuevo."
          : "Le llegará un enlace nuevo, válido 7 días. El que tenga ahora dejará de valer."}
        confirmLabel={confirm?.action === "revoke" ? "Anular invitación" : "Reenviar"}
        danger={confirm?.action === "revoke"}
        loading={confirming}
        onClose={() => { if (!confirming) setConfirm(null); }}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "revoke") revoke.mutate(confirm.invitation);
          else resend.mutate(confirm.invitation);
        }}
      />
    </>
  );
}
