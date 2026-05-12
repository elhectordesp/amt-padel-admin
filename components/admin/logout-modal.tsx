"use client";

import { LogOut, X } from "lucide-react";
import { logout } from "@/lib/auth";

interface Props { open: boolean; onClose: () => void }

export function LogoutModal({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-full bg-destructive/10 border border-destructive/20">
            <LogOut size={18} className="text-destructive" />
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>
        <div>
          <h3 className="font-heading text-lg text-foreground">Cerrar sesión</h3>
          <p className="text-sm text-muted-foreground mt-1">
            ¿Seguro que quieres cerrar sesión del panel de administración?
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => logout()}
            className="flex-1 py-2 rounded-md bg-destructive text-white text-sm font-semibold hover:bg-destructive/80 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
