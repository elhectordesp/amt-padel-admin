"use client";

/**
 * Apuntar una recuperación a una clase: se busca entre los clientes que tienen
 * un crédito disponible que no caduque antes de la clase. Quien ya está en la
 * lista de la clase no sale. El back vuelve a comprobar el hueco, el crédito y
 * que el alumno no sea del grupo.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/admin/error-state";
import { errorText } from "@/components/admin/price-seasons-panel";
import { SchoolDialog, schoolInputCls } from "@/components/admin/school-dialog";
import { Button } from "@/components/ui/button";
import { invalidateSchool } from "@/lib/services/school";
import { schoolRecoveryQK, schoolRecoveryService } from "@/lib/services/school-recovery";
import { sessionLabel } from "@/lib/utils/school";
import { matchesSearch } from "@/lib/utils/search";
import { creditChoices, creditText } from "@/lib/utils/school-recovery";
import type { SchoolSession } from "@/types/school";

export function SchoolRecoveryDialog({
  clubId,
  session,
  inClass,
  timeZone,
  onClose,
}: {
  clubId: string;
  session: Pick<SchoolSession, "id" | "startsAt" | "endsAt">;
  /** Los clientes que ya están en la lista de la clase. */
  inClass: ReadonlySet<string>;
  timeZone: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const filters = { status: "available" } as const;
  const credits = useQuery({
    queryKey: schoolRecoveryQK.credits(clubId, filters),
    queryFn: () => schoolRecoveryService.credits.list(clubId, filters),
  });

  const use = useMutation({
    mutationFn: (creditId: string) => schoolRecoveryService.recoveries.use(clubId, session.id, creditId),
    onSuccess: () => {
      invalidateSchool(qc, clubId);
      toast.success("Recuperación apuntada");
      onClose();
    },
    onError: (err: unknown) => toast.error(errorText(err)),
  });

  const valid = creditChoices(credits.data ?? [], session.startsAt, inClass);
  const shown = valid.filter((c) => matchesSearch(q, c.customerName));

  return (
    <SchoolDialog title="Apuntar recuperación" onClose={onClose} busy={use.isPending} wide>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Clase del {sessionLabel(session, timeZone)}. Elige a quién se apunta entre quienes tienen una recuperación
          disponible.
        </p>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente por nombre"
            aria-label="Buscar cliente con recuperación"
            className={`${schoolInputCls} w-full pl-7`}
          />
        </label>

        {credits.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : credits.isError ? (
          <ErrorState onRetry={() => void credits.refetch()} />
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-center text-sm text-muted-foreground">
            {valid.length === 0
              ? "Nadie tiene ahora una recuperación que valga para esta clase."
              : "Ningún cliente con recuperación coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
            {shown.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium">{c.customerName ?? "Sin nombre"}</div>
                  <div className="text-xs text-muted-foreground">{creditText(c, timeZone)}</div>
                </div>
                <Button
                  size="sm"
                  disabled={use.isPending}
                  onClick={() => use.mutate(c.id)}
                  aria-label={`Apuntar a ${c.customerName ?? "este cliente"} con esta recuperación`}
                >
                  Apuntar
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={use.isPending}>
            Cerrar
          </Button>
        </div>
      </div>
    </SchoolDialog>
  );
}
