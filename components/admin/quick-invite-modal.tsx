"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de onboarding rápido de un club: AMT introduce solo el email del
 * admin del club, el backend crea un club stub (inactivo) + envía la
 * invitación. El admin del club completará los datos al entrar.
 */
export function QuickInviteClubModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const invite = useMutation({
    mutationFn: (e: string) => adminService.clubs.quickInvite(e),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clubs"] });
      toast.success("Invitación enviada. Recibirá un email para activar.");
      setEmail("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Introduce un email válido");
      return;
    }
    invite.mutate(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg">Invitar admin de club nuevo</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Crearemos un club &quot;por configurar&quot; (oculto en la app) y
            enviaremos una invitación. El propio admin del club rellenará
            nombre, ciudad y demás datos al entrar por primera vez.
          </p>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Email del admin <span className="text-destructive">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@suclub.com"
              autoFocus
              autoComplete="email"
              className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={invite.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-60"
            >
              {invite.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Enviar invitación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
