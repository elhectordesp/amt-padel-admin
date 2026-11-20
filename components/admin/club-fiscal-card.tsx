"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, FileText } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import type { ClubFiscal } from "@/types";

// 44 px en tablet, como el resto de controles del panel del club
const INPUT =
  "w-full h-10 max-[1024px]:h-11 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]";
const LABEL = "text-xs font-semibold text-muted-foreground uppercase tracking-wide";

type FiscalForm = { legalName: string; taxId: string; fiscalAddress: string };

const toForm = (fiscal: ClubFiscal): FiscalForm => ({
  legalName: fiscal.legalName ?? "",
  taxId: fiscal.taxId ?? "",
  fiscalAddress: fiscal.fiscalAddress ?? "",
});

/**
 * Datos fiscales del club: razón social, NIF y dirección fiscal. Solo los ve y
 * cambia quien tiene el rol de propietario o gestor (y AMT): el NIF puede ser
 * de una persona. Son datos para la gestoría del club, no para facturar con
 * AMT. No salen en la app ni en las pantallas públicas.
 */
export function ClubFiscalCard({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const { data: fiscal, isLoading, isError } = useQuery({
    queryKey: ["club-fiscal", clubId],
    queryFn: () => adminService.clubs.fiscal(clubId),
    staleTime: 30_000,
  });

  // Lo que el usuario ha tecleado; mientras no toca nada, lo guardado
  const [edited, setEdited] = useState<FiscalForm | null>(null);
  const form = edited ?? (fiscal ? toForm(fiscal) : null);

  const save = useMutation({
    mutationFn: (f: FiscalForm) =>
      adminService.clubs.updateFiscal(clubId, {
        legalName: f.legalName.trim() || null,
        taxId: f.taxId.trim() || null,
        fiscalAddress: f.fiscalAddress.trim() || null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["club-fiscal", clubId], updated);
      setEdited(null);
      toast.success("Datos fiscales guardados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <FileText size={18} className="text-[#D4AF37]" />
        <h2 className="font-heading text-lg text-foreground">Datos fiscales</h2>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Solo para tu gestoría: AMT no emite facturas.
      </p>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && (
        <p className="text-xs text-destructive">No se pudieron cargar los datos fiscales.</p>
      )}

      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className={LABEL}>Razón social</span>
              <input
                value={form.legalName}
                onChange={(e) => setEdited({ ...form, legalName: e.target.value })}
                maxLength={200}
                className={INPUT}
              />
            </label>

            <label className="space-y-1.5">
              <span className={LABEL}>NIF / CIF</span>
              <input
                value={form.taxId}
                onChange={(e) => setEdited({ ...form, taxId: e.target.value })}
                maxLength={30}
                className={INPUT}
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className={LABEL}>Dirección fiscal</span>
              <input
                value={form.fiscalAddress}
                onChange={(e) => setEdited({ ...form, fiscalAddress: e.target.value })}
                maxLength={500}
                className={INPUT}
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={save.isPending || edited === null}
              className="flex items-center gap-2 h-10 max-[1024px]:h-11 px-5 text-sm rounded-md bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-60"
            >
              {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar datos fiscales
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
