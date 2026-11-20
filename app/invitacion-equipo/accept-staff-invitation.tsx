"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptStaffInvitation, INVITATION_WRONG_ACCOUNT_MESSAGE } from "@/lib/auth";
import { getToken, removeTokens } from "@/lib/api";

/**
 * Enlace del email de invitación al equipo de un club. Sin sesión, lleva a
 * entrar y vuelve aquí con el mismo enlace; con sesión, acepta y entra en el club.
 */
export function AcceptStaffInvitation() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const here = `/invitacion-equipo?token=${encodeURIComponent(token)}`;
  const loginUrl = `/login?from=${encodeURIComponent(here)}`;

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    if (!getToken()) {
      router.replace(loginUrl);
      return;
    }
    acceptStaffInvitation(token).then(
      ({ clubName }) => {
        // Nada de la sesión anterior en la caché
        qc.clear();
        toast.success(`Ya formas parte del equipo de ${clubName}`);
        router.replace("/");
      },
      (err: unknown) => setError(err instanceof Error ? err.message : "Error al aceptar la invitación."),
    );
  }, [token, loginUrl, qc, router]);

  if (!token) {
    return (
      <Shell title="Enlace inválido">
        <p className="text-sm text-muted-foreground">
          Esta página solo se abre desde el enlace de invitación que recibes por email. Si el enlace
          no funciona, pide al propietario del club que te lo reenvíe.
        </p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell title="No se pudo aceptar la invitación">
        <p className="text-sm text-destructive" role="alert">{error}</p>
        {error === INVITATION_WRONG_ACCOUNT_MESSAGE && (
          <button
            onClick={() => { removeTokens(); qc.clear(); window.location.href = loginUrl; }}
            className="w-full h-11 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors"
          >
            Entrar con otra cuenta
          </button>
        )}
      </Shell>
    );
  }

  return (
    <Shell title="Aceptando la invitación…">
      <Loader2 size={20} className="animate-spin text-muted-foreground mx-auto" />
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <span className="font-heading text-3xl text-[#D4AF37] tracking-[6px]">AMT</span>
        <h1 className="font-heading text-2xl text-foreground">{title}</h1>
        {children}
      </div>
    </div>
  );
}
