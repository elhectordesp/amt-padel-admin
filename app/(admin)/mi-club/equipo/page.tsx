"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, RotateCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { RoleChips } from "@/components/admin/staff-role-picker";
import { StaffDialog, type StaffDialogTarget } from "@/components/admin/staff-dialog";
import { adminService } from "@/lib/services/admin";
import type { ClubStaffRole } from "@/lib/club-permissions";
import { useRole } from "@/lib/use-role";
import { ME_QUERY_KEY } from "@/lib/use-me";
import { useClubAccess } from "@/lib/use-club-access";
import { clubStaffQueryKey, staffDate, staffErrorMessage } from "@/lib/utils/club-staff";
import type { ClubStaffInvitation, ClubStaffMember } from "@/types";

type Confirm =
  | { kind: "remove"; member: ClubStaffMember }
  | { kind: "resend" | "revoke"; invitation: ClubStaffInvitation };

const ACTION_BTN =
  "flex items-center gap-1.5 px-2.5 h-8 max-[1024px]:h-11 rounded-md text-xs transition-colors whitespace-nowrap disabled:opacity-50";

function confirmTitle(c: Confirm | null): string {
  if (!c) return "";
  if (c.kind === "remove") return `¿Quitar a ${c.member.name} del equipo?`;
  if (c.kind === "revoke") return `¿Anular la invitación a ${c.invitation.email}?`;
  return `¿Reenviar la invitación a ${c.invitation.email}?`;
}

function confirmDescription(c: Confirm | null): string {
  if (c?.kind === "remove")
    return "Dejará de poder entrar al panel de este club. Su cuenta no se borra: si tiene la de jugador, la conserva.";
  if (c?.kind === "revoke")
    return "Su enlace dejará de valer. Para que entre al equipo habrá que invitarle de nuevo.";
  return "Le llegará un enlace nuevo, válido 7 días. El que tenga ahora dejará de valer.";
}

function confirmLabel(c: Confirm | null): string {
  if (c?.kind === "remove") return "Quitar del equipo";
  if (c?.kind === "revoke") return "Anular invitación";
  return "Reenviar";
}

export default function EquipoPage() {
  const { clubId } = useRole();
  const { can } = useClubAccess();
  const canWrite = can("staff", "write");
  const qc = useQueryClient();
  const [now] = useState(() => Date.now());

  const [dialog, setDialog] = useState<StaffDialogTarget | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const queryKey = clubStaffQueryKey(clubId ?? "");
  const staff = useQuery({
    queryKey,
    queryFn: () => adminService.clubs.staff(clubId!),
    enabled: !!clubId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey });

  const invite = useMutation({
    mutationFn: (v: { email: string; roles: ClubStaffRole[] }) =>
      adminService.clubs.inviteStaff(clubId!, v.email, v.roles),
    onSuccess: async (_r, v) => {
      await refresh();
      setDialog(null);
      toast.success(`Invitación enviada a ${v.email}`);
    },
    onError: (err: Error) => setDialogError(staffErrorMessage(err)),
  });

  const saveRoles = useMutation({
    mutationFn: (v: { userId: string; roles: ClubStaffRole[] }) =>
      adminService.clubs.updateStaffRoles(clubId!, v.userId, v.roles),
    onSuccess: async () => {
      await refresh();
      // Puede haberse cambiado los suyos: el menú se rehace con los nuevos
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
      setDialog(null);
      toast.success("Roles actualizados");
    },
    onError: (err: Error) => setDialogError(staffErrorMessage(err)),
  });

  const act = useMutation({
    mutationFn: (c: Confirm) => {
      if (c.kind === "remove") return adminService.clubs.removeStaff(clubId!, c.member.userId);
      if (c.kind === "resend") return adminService.clubs.resendStaffInvitation(clubId!, c.invitation.id);
      return adminService.clubs.revokeStaffInvitation(clubId!, c.invitation.id);
    },
    onSuccess: async (_r, c) => {
      await refresh();
      if (c.kind === "remove") {
        qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
        toast.success(`${c.member.name} ya no forma parte del equipo`);
      } else if (c.kind === "resend") {
        toast.success(`Invitación reenviada a ${c.invitation.email}`);
      } else {
        toast.success(`Invitación a ${c.invitation.email} anulada`);
      }
    },
    onError: (err: Error) => toast.error(staffErrorMessage(err)),
    onSettled: () => setConfirm(null),
  });

  const data = staff.data;

  const openDialog = (target: StaffDialogTarget) => {
    setDialogError(null);
    setDialog(target);
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Equipo" />

      <div className="p-4 sm:p-6 space-y-6 max-w-4xl w-full mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {canWrite
              ? "La gente que trabaja contigo en el club, cada uno con su cuenta y sus roles."
              : "La gente que trabaja en el club. Solo el propietario puede cambiar el equipo."}
          </p>
          {canWrite && (
            <button
              onClick={() => openDialog({ mode: "invite" })}
              className="flex items-center justify-center gap-2 h-10 max-[1024px]:h-11 px-4 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors"
            >
              <UserPlus size={15} />
              Invitar
            </button>
          )}
        </div>

        {!clubId || staff.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : staff.isError || !data ? (
          <p className="text-sm text-destructive">No se pudo cargar el equipo del club.</p>
        ) : (
          <>
            <section className="space-y-2" aria-labelledby="equipo-miembros">
              <h2 id="equipo-miembros" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Miembros
              </h2>
              {data.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aún no hay nadie en el equipo.</p>
              ) : (
                <div className="bg-card border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="px-4 py-2.5 font-medium">Nombre</th>
                        <th className="px-4 py-2.5 font-medium">Email</th>
                        <th className="px-4 py-2.5 font-medium">Roles</th>
                        {canWrite && <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.map((m) => (
                        <tr key={m.userId} className="border-b border-border last:border-0 align-middle">
                          <td className="px-4 py-3 font-medium text-foreground">{m.name}</td>
                          <td className="px-4 py-3 text-muted-foreground break-all">{m.email ?? "Sin email"}</td>
                          <td className="px-4 py-3"><RoleChips roles={m.roles} /></td>
                          {canWrite && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openDialog({ mode: "edit", userId: m.userId, name: m.name, roles: m.roles })}
                                  aria-label={`Cambiar los roles de ${m.name}`}
                                  className={`${ACTION_BTN} text-muted-foreground hover:text-foreground hover:bg-secondary`}
                                >
                                  <Pencil size={13} /> Roles
                                </button>
                                <button
                                  onClick={() => setConfirm({ kind: "remove", member: m })}
                                  aria-label={`Quitar a ${m.name} del equipo`}
                                  className={`${ACTION_BTN} text-destructive hover:bg-destructive/10`}
                                >
                                  <Trash2 size={13} /> Quitar
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-2" aria-labelledby="equipo-invitaciones">
              <h2 id="equipo-invitaciones" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Invitaciones pendientes
              </h2>
              {data.invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
              ) : (
                <ul className="bg-card border border-border rounded-lg divide-y divide-border">
                  {data.invitations.map((inv) => {
                    const expired = new Date(inv.expiresAt).getTime() < now;
                    return (
                      <li key={inv.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-foreground break-all">{inv.email}</p>
                          <RoleChips roles={inv.roles} />
                          <p className="text-xs text-muted-foreground">
                            Enviada el {staffDate(inv.createdAt)} · {expired ? "caducó" : "caduca"} el {staffDate(inv.expiresAt)}
                          </p>
                        </div>
                        {canWrite && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setConfirm({ kind: "resend", invitation: inv })}
                              aria-label={`Reenviar la invitación a ${inv.email}`}
                              className={`${ACTION_BTN} text-muted-foreground hover:text-foreground hover:bg-secondary`}
                            >
                              <RotateCw size={13} /> Reenviar
                            </button>
                            <button
                              onClick={() => setConfirm({ kind: "revoke", invitation: inv })}
                              aria-label={`Anular la invitación a ${inv.email}`}
                              className={`${ACTION_BTN} text-destructive hover:bg-destructive/10`}
                            >
                              <Trash2 size={13} /> Anular
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {dialog && (
        <StaffDialog
          target={dialog}
          loading={invite.isPending || saveRoles.isPending}
          error={dialogError}
          onClose={() => setDialog(null)}
          onInvite={(email, roles) => invite.mutate({ email, roles })}
          onSaveRoles={(userId, roles) => saveRoles.mutate({ userId, roles })}
        />
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirmTitle(confirm)}
        description={confirmDescription(confirm)}
        confirmLabel={confirmLabel(confirm)}
        danger={confirm?.kind !== "resend"}
        loading={act.isPending}
        onClose={() => { if (!act.isPending) setConfirm(null); }}
        onConfirm={() => { if (confirm) act.mutate(confirm); }}
      />
    </div>
  );
}
