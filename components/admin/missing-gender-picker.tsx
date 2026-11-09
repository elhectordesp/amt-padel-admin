"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import type { Gender } from "@/types";

interface Props {
  playerId: string;
  playerName: string;
  /** Tras guardarlo: para que quien lo muestra actualice su copia del jugador. */
  onSet: (gender: Gender) => void;
}

/**
 * Pone el género a un jugador al que le falta, allí mismo (en la mesa del
 * torneo), en vez de mandar al gestor a pedírselo a AMT. El back solo lo
 * guarda si hoy no tiene y el jugador tiene relación con el club.
 */
export default function MissingGenderPicker({ playerId, playerName, onSet }: Props) {
  const setMut = useMutation({
    mutationFn: (gender: Gender) => adminService.players.setMissingGender(playerId, gender),
    onSuccess: (res) => {
      toast.success(`Género de ${playerName} guardado`);
      onSet(res.gender);
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo guardar el género"),
  });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Género de {playerName}:</span>
      {([["M", "Masculino"], ["F", "Femenino"]] as const).map(([value, label]) => (
        <button
          key={value}
          type="button"
          disabled={setMut.isPending}
          onClick={() => setMut.mutate(value)}
          className="px-3 py-1.5 rounded-md border border-border bg-secondary text-xs text-foreground hover:border-[rgba(212,175,55,0.4)] hover:text-[#D4AF37] transition-colors disabled:opacity-50"
        >
          {label}
        </button>
      ))}
      {setMut.isPending && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
    </div>
  );
}
