"use client";

/**
 * Descuento de socios del club (el mismo ajuste que «Socios» en Configuración
 * de reservas): un porcentaje que se resta al reservar a los clientes marcados
 * como socios. No se suma a las ofertas: en cada hueco gana el mayor.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorText } from "@/components/admin/price-seasons-panel";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useClubAccess } from "@/lib/use-club-access";

export function MemberDiscountSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const canWrite = useClubAccess().can("settings", "write");
  const config = useQuery({
    queryKey: bookingsQK.config(clubId),
    queryFn: () => bookingsService.config.get(clubId),
  });
  const [value, setValue] = useState("");
  const saved = config.data?.memberDiscountPercent;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved !== undefined) setValue(String(saved));
  }, [saved]);

  const percent = /^\d{1,3}$/.test(value.trim()) ? Number(value) : null;
  const valid = percent !== null && percent <= 100;

  const save = useMutation({
    mutationFn: () => bookingsService.config.update(clubId, { memberDiscountPercent: percent! }),
    onSuccess: () => {
      toast.success("Descuento de socios guardado");
      qc.invalidateQueries({ queryKey: bookingsQK.config(clubId) });
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  return (
    <section aria-label="Descuento de socios">
      <h2 className="text-base font-medium">Descuento de socios</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Los clientes marcados como socios pagan este porcentaje menos en todas sus reservas. No se
        suma a las ofertas: en cada hueco se aplica el mayor de los dos. 0 = sin descuento.
      </p>
      {config.isLoading ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
      ) : config.isError ? (
        <p className="mt-3 text-sm text-destructive">No se pudo cargar el descuento de socios</p>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="text"
            inputMode="numeric"
            aria-label="Descuento para socios (%)"
            aria-invalid={!valid}
            value={value}
            disabled={!canWrite}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <span className="text-muted-foreground">%</span>
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              disabled={!valid || percent === saved || save.isPending}
              onClick={() => save.mutate()}
            >
              Aplicar
            </Button>
          )}
          {!valid && <span className="text-xs text-destructive">Un número entero de 0 a 100</span>}
        </div>
      )}
    </section>
  );
}
