"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { activateClub } from "@/lib/auth";
import { adminService } from "@/lib/services/admin";
import { useMe, ME_QUERY_KEY } from "@/lib/use-me";

/**
 * Modo soporte: AMT trabaja dentro del panel de un club tal como lo ve el
 * club. Entra y sale con el mismo endpoint que el selector de club
 * (`/auth/active-club`); el back deja constancia de la entrada y la salida.
 */

/** Acción de la tarjeta de un club (página de clubes de AMT): entra como soporte. */
export function EnterSupportButton({ clubId, clubName }: { clubId: string; clubName: string }) {
  const qc = useQueryClient();
  const [entering, setEntering] = useState(false);

  const enter = async () => {
    setEntering(true);
    try {
      await activateClub(clubId);
      // Nada de la vista de AMT en la caché; carga la portada del club
      qc.clear();
      window.location.href = "/";
    } catch (err) {
      setEntering(false);
      toast.error(err instanceof Error ? err.message : "No se pudo entrar como soporte");
    }
  };

  return (
    <button
      onClick={enter}
      disabled={entering}
      className="p-2 sm:p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-60"
      title="Entrar como soporte"
      aria-label={`Entrar como soporte en ${clubName}`}
    >
      {entering ? <Loader2 size={13} className="animate-spin" /> : <LifeBuoy size={13} />}
    </button>
  );
}

/** Franja fija arriba mientras AMT está en modo soporte; nada si no lo está. */
export function SupportBanner() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const clubId = me?.supportClubId ?? null;

  const { data: club } = useQuery({
    queryKey: ["support-club", clubId],
    queryFn:  () => adminService.clubs.findOne(clubId as string),
    enabled:  !!clubId,
    staleTime: 5 * 60_000,
  });

  if (!clubId) return null;

  const leave = async () => {
    setLeaving(true);
    try {
      await activateClub(null);
      qc.clear();
      window.location.href = "/clubes";
    } catch (err) {
      setLeaving(false);
      toast.error(err instanceof Error ? err.message : "No se pudo salir del modo soporte");
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    }
  };

  return (
    <div
      role="status"
      className="shrink-0 flex items-center justify-between gap-3 pl-16 pr-4 min-[1025px]:pl-4 h-9 bg-[#D4AF37] text-black text-xs font-medium"
    >
      <span className="truncate">
        Soporte AMT · {club?.name ?? "…"}
      </span>
      <button
        onClick={leave}
        disabled={leaving}
        className="shrink-0 underline underline-offset-2 font-semibold disabled:opacity-60"
      >
        {leaving ? "Saliendo…" : "Salir"}
      </button>
    </div>
  );
}
