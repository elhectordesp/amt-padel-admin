"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { activateClub, logout } from "@/lib/auth";
import { removeTokens } from "@/lib/api";
import { LOGIN_REASON_NO_ACCESS } from "@/lib/session";
import { adminService } from "@/lib/services/admin";
import type { ClubMembership } from "@/lib/club-permissions";
import { ROLE_LABEL } from "@/lib/club-permissions";

/**
 * Con qué club trabaja quien es del equipo de varios (o ha perdido el club con
 * el que trabajaba). Con uno solo entra directamente; con ninguno, no tiene
 * acceso al panel.
 */
export function ChooseClub() {
  const router = useRouter();
  const qc = useQueryClient();
  const [clubs, setClubs] = useState<ClubMembership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const started = useRef(false);

  const enter = useCallback(async (clubId: string) => {
    setEntering(clubId);
    setError(null);
    try {
      await activateClub(clubId);
      // Nada de la sesión anterior en la caché
      qc.clear();
      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo entrar en el club";
      setEntering(null);
      setError(msg);
      toast.error(msg);
    }
  }, [qc, router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    adminService.me().then(
      (me) => {
        const list = me.clubs ?? [];
        if (list.length === 0) {
          removeTokens();
          router.replace(`/login?motivo=${LOGIN_REASON_NO_ACCESS}`);
        } else if (list.length === 1) {
          void enter(list[0].clubId);
        } else {
          setClubs(list);
        }
      },
      () => setError("No se pudo cargar tu lista de clubes. Vuelve a iniciar sesión."),
    );
  }, [enter, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="text-center space-y-1">
          <span className="font-heading text-3xl text-[#D4AF37] tracking-[6px]">AMT</span>
          <h1 className="font-heading text-2xl text-foreground pt-3">¿Con qué club trabajas?</h1>
          <p className="text-sm text-muted-foreground">
            Podrás cambiar de club cuando quieras desde el menú.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/30" role="alert">
            <span className="text-xs text-destructive">{error}</span>
          </div>
        )}

        {clubs === null && !error ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="space-y-3">
            {(clubs ?? []).map((c) => (
              <li key={c.clubId}>
                <button
                  onClick={() => enter(c.clubId)}
                  disabled={entering !== null}
                  className="w-full min-h-16 flex items-center gap-4 px-5 py-3 rounded-lg bg-card border border-border text-left hover:border-[#D4AF37]/60 hover:bg-[rgba(212,175,55,0.06)] disabled:opacity-60 transition-colors"
                >
                  <span className="p-2.5 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)]">
                    {entering === c.clubId
                      ? <Loader2 size={20} className="animate-spin text-[#D4AF37]" />
                      : <Building2 size={20} className="text-[#D4AF37]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-foreground truncate">{c.clubName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.roles.map((r) => ROLE_LABEL[r]).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => logout(() => qc.clear())}
          className="w-full text-center text-xs text-muted-foreground hover:text-[#D4AF37] transition-colors min-h-11"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
