"use client";

/**
 * Diálogo del equipo del club: invitar a alguien (email + roles) o cambiar los
 * roles de un miembro. Los roles se eligen con casillas, cada una explicada.
 */

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { StaffRolePicker } from "@/components/admin/staff-role-picker";
import type { ClubStaffRole } from "@/lib/club-permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StaffDialogTarget =
  | { mode: "invite" }
  | { mode: "edit"; userId: string; name: string; roles: ClubStaffRole[] };

export function StaffDialog({
  target, loading, error, onClose, onInvite, onSaveRoles,
}: {
  target: StaffDialogTarget;
  loading: boolean;
  error?: string | null;
  onClose: () => void;
  onInvite: (email: string, roles: ClubStaffRole[]) => void;
  onSaveRoles: (userId: string, roles: ClubStaffRole[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<ClubStaffRole[]>(target.mode === "edit" ? target.roles : []);
  const [touched, setTouched] = useState(false);

  const invite = target.mode === "invite";
  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit = roles.length > 0 && (!invite || emailOk) && !loading;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    if (target.mode === "invite") onInvite(email.trim(), roles);
    else onSaveRoles(target.userId, roles);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!loading) onClose(); }} />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-dialog-title"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-card border border-border rounded-xl shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="staff-dialog-title" className="font-heading text-base">
            {target.mode === "invite" ? "Invitar al equipo" : `Roles de ${target.name}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar"
            className="p-1.5 max-[1024px]:size-11 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground"
          >
            <X size={15} />
          </button>
        </div>

        {invite && (
          <div className="space-y-1.5">
            <label htmlFor="staff-email" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Email
            </label>
            <input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@suclub.com"
              autoComplete="off"
              className="w-full h-10 max-[1024px]:h-11 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
            <p className="text-xs text-muted-foreground">
              Le llega un enlace por email, válido 7 días. Tiene que entrar con la cuenta de ese email (vale la de jugador de la app).
            </p>
            {touched && !emailOk && <p className="text-xs text-destructive">Introduce un email válido</p>}
          </div>
        )}

        <StaffRolePicker value={roles} onChange={setRoles} disabled={loading} />
        {touched && roles.length === 0 && (
          <p className="text-xs text-destructive">Elige al menos un rol</p>
        )}
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-10 max-[1024px]:h-11 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 h-10 max-[1024px]:h-11 flex items-center justify-center gap-1.5 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {invite ? "Enviar invitación" : "Guardar roles"}
          </button>
        </div>
      </form>
    </div>
  );
}
