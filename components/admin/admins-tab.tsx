"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Shield, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import { canManageAdmins, roleLabel, useMe } from "@/lib/use-me";
import type { AdminMember } from "@/types";

type AdminRole = AdminMember["role"];
type InviteForm = { email: string; firstName: string; lastName: string; role: AdminRole };

const EMPTY_INVITE: InviteForm = { email: "", firstName: "", lastName: "", role: "ADMIN" };
const otherRole = (role: AdminRole): AdminRole => (role === "SUPERADMIN" ? "ADMIN" : "SUPERADMIN");

/**
 * Pestaña Administradores de Configuración. Todos los admins ven la lista;
 * invitar, cambiar el rol y revocar es solo del Super Admin (D4: lo exige el
 * back), y nunca sobre uno mismo. Si el back no dice el rol (una versión
 * anterior) o no se sabe quién es, los botones salen y decide el back.
 */
export function AdminsTab() {
  const qc = useQueryClient();
  const [showInvite,   setShowInvite]   = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AdminMember | null>(null);
  const [roleTarget,   setRoleTarget]   = useState<AdminMember | null>(null);
  const [inviteForm,   setInviteForm]   = useState<InviteForm>(EMPTY_INVITE);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn:  adminService.admins.list,
  });

  const { data: me, isError: meFailed } = useMe();
  const canManage = meFailed || canManageAdmins(me);
  const refreshList = () => qc.invalidateQueries({ queryKey: ["admin-members"] });

  // A quién se le hace cada cosa va en las variables de la mutación, no en
  // el estado del modal (que puede cambiar mientras tanto)
  const changeRole = useMutation({
    mutationFn: (target: { id: string; name: string; role: AdminRole }) =>
      adminService.admins.updateRole(target.id, target.role),
    onSuccess: (updated, target) => {
      toast.success(`${target.name} ahora es ${roleLabel(updated?.role ?? target.role)}`);
      setRoleTarget(null);
      refreshList();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invite = useMutation({
    mutationFn: (form: InviteForm) => adminService.admins.invite(form),
    onSuccess: (invited, form) => {
      // A quien ya era admin y no había activado su cuenta se le reenvía la
      // invitación, sin cambiarle el rol: el back devuelve el que tiene
      if (invited?.role && invited.role !== form.role) {
        toast.info(
          `${form.email} ya era ${roleLabel(invited.role)}: le hemos reenviado la invitación sin cambiarle el rol. Para cambiarlo, usa «Cambiar rol».`,
        );
      } else {
        toast.success(`Invitación enviada a ${form.email} como ${roleLabel(invited?.role ?? form.role)}`);
      }
      setShowInvite(false);
      setInviteForm(EMPTY_INVITE);
      refreshList();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (target: { id: string; name: string }) => adminService.admins.revoke(target.id),
    onSuccess: (_result, target) => {
      toast.success(`Acceso de ${target.name} revocado`);
      setRevokeTarget(null);
      refreshList();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mientras se guarda, los modales no se cierran (Cancelar, la X ni el fondo)
  const closeInvite = () => { if (!invite.isPending) setShowInvite(false); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">{admins.length} administrador{admins.length !== 1 ? "es" : ""}</p>
        {canManage ? (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-xs font-semibold hover:bg-[#C49F2A] transition-colors"
          >
            <UserPlus size={13} />
            Invitar administrador
          </button>
        ) : me && (
          <p className="text-xs text-muted-foreground">
            Solo un Super Admin puede invitar, cambiar el rol o revocar administradores.
          </p>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay administradores registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {admin.name}
                    {admin.id === me?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                    )}
                    {admin.pendingActivation && (
                      <span className="ml-2 text-xs text-muted-foreground">(pendiente de activar)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{admin.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${admin.role === "SUPERADMIN" ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37]" : "bg-secondary text-muted-foreground"}`}>
                      {roleLabel(admin.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* Ni sobre uno mismo: el back no deja cambiarse el rol ni revocarse */}
                    {canManage && admin.id !== me?.id && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setRoleTarget(admin)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors whitespace-nowrap"
                        >
                          <Shield size={12} />
                          Cambiar rol
                        </button>
                        <button
                          onClick={() => setRevokeTarget(admin)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors whitespace-nowrap"
                        >
                          <Trash2 size={12} />
                          Revocar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeInvite}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Shield size={16} className="text-[#D4AF37]" />
                Invitar administrador
              </h2>
              <button onClick={closeInvite} disabled={invite.isPending} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground disabled:opacity-50">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nombre</label>
                  <input value={inviteForm.firstName} onChange={(e) => setInviteForm((p) => ({ ...p, firstName: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Apellidos</label>
                  <input value={inviteForm.lastName} onChange={(e) => setInviteForm((p) => ({ ...p, lastName: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="Apellidos"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  placeholder="admin@email.com"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Rol</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as AdminRole }))}
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Super Admin</option>
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Si ya es administrador y no ha activado su cuenta, se le reenvía la invitación con el rol que tiene.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeInvite} disabled={invite.isPending} className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => invite.mutate(inviteForm)}
                disabled={!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName || invite.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors"
              >
                {invite.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Invitar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!roleTarget}
        title={`¿Cambiar el rol de ${roleTarget?.name}?`}
        description={roleTarget?.role === "SUPERADMIN"
          ? "Pasará a Admin: dejará de poder invitar, cambiar el rol o revocar administradores. Lo demás del panel lo sigue haciendo igual."
          : "Pasará a Super Admin: podrá invitar, cambiar el rol y revocar administradores, también el tuyo."}
        confirmLabel={roleTarget ? `Pasar a ${roleLabel(otherRole(roleTarget.role))}` : "Cambiar rol"}
        loading={changeRole.isPending}
        onClose={() => { if (!changeRole.isPending) setRoleTarget(null); }}
        onConfirm={() => roleTarget && changeRole.mutate({ id: roleTarget.id, name: roleTarget.name, role: otherRole(roleTarget.role) })}
      />

      <ConfirmModal
        open={!!revokeTarget}
        title={`¿Revocar acceso de ${revokeTarget?.name}?`}
        description="El usuario perderá todos los permisos de administración. Su cuenta de jugador (si existe) se mantendrá."
        confirmLabel="Revocar acceso"
        danger
        loading={revoke.isPending}
        onClose={() => { if (!revoke.isPending) setRevokeTarget(null); }}
        onConfirm={() => revokeTarget && revoke.mutate({ id: revokeTarget.id, name: revokeTarget.name })}
      />
    </div>
  );
}
