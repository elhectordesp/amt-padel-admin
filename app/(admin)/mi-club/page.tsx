"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle2, Save, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { CourtsManager } from "@/components/admin/courts-manager";
import { adminService } from "@/lib/services/admin";
import { useRole, isClub } from "@/lib/use-role";
import { PROVINCES } from "@/lib/constants/spain";
import type { Club } from "@/types";

type Form = {
  name: string;
  city: string;
  province: string;
  address: string;
  phone: string;
  website: string;
  instagram: string;
  contactEmail: string;
  logoUrl: string;
};

const EMPTY: Form = {
  name: "",
  city: "",
  province: "",
  address: "",
  phone: "",
  website: "",
  instagram: "",
  contactEmail: "",
  logoUrl: "",
};

function buildForm(club: Club | undefined): Form {
  if (!club) return EMPTY;
  return {
    name:         club.name ?? "",
    city:         club.city ?? "",
    province:     club.province ?? "",
    address:      club.address ?? "",
    phone:        club.phone ?? "",
    website:      club.website ?? "",
    instagram:    club.instagram ?? "",
    contactEmail: club.contactEmail ?? "",
    logoUrl:      club.logoUrl ?? "",
  };
}

export default function MiClubPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { role, clubId } = useRole();
  const [form, setForm] = useState<Form>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Solo CLUB users tienen acceso real a esta página. ADMIN no debería
  // entrar aquí (sería el listado /clubes el suyo). Redirigimos.
  useEffect(() => {
    // role==null = aún cargando del JWT, no hacer nada todavía.
    if (role !== null && !isClub(role)) router.replace("/clubes");
  }, [role, router]);

  const enabled = !!clubId && isClub(role);

  const { data: club, isLoading } = useQuery({
    queryKey: ["my-club", clubId],
    queryFn: () => adminService.clubs.findOne(clubId!),
    enabled,
    staleTime: 30_000,
  });

  // Rellena el form la primera vez que cargan los datos. Después el user
  // ya está editando — no sobreescribir su trabajo.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!club || hydrated) return;
    setForm(buildForm(club));
    setHydrated(true);
  }, [club, hydrated]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () => {
      if (!clubId) throw new Error("Sin clubId");
      // Mandamos solo los campos rellenados — null para los que el user
      // explícitamente vacía, undefined para los que no toca.
      const payload: Record<string, string | null> = {
        name: form.name.trim(),
        city: form.city.trim(),
        province: form.province || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
      };
      return adminService.clubs.update(clubId, payload);
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["my-club", clubId] });
      // Si el club acaba de activarse (era stub → ahora real), celebramos.
      if (updated.active && club && !club.active) {
        toast.success("¡Tu club está activo! Ya aparece en la app.");
      } else {
        toast.success("Datos guardados");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) {
      toast.error("Nombre y ciudad son obligatorios");
      return;
    }
    save.mutate();
  };

  if (!enabled && role !== null) {
    // ADMIN ya redirige; aquí solo se ve mientras la nav está en flight.
    return null;
  }

  return (
    <>
      <Header title="Mi club" />

      <div className="p-4 sm:p-6 max-w-3xl space-y-6">
        {/* Banner "pendiente de configurar" cuando active=false */}
        {club && !club.active && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-[rgba(212,175,55,0.4)] bg-[rgba(212,175,55,0.08)]">
            <AlertCircle size={18} className="text-[#D4AF37] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Tu club está pendiente de configurar
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Mientras no rellenes el nombre y la ciudad reales, tu club no
                aparecerá en la app pública de jugadores. Al guardar con datos
                válidos se activará automáticamente.
              </p>
            </div>
          </div>
        )}

        {club && club.active && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-foreground">
              Tu club está <strong>activo</strong> y visible en la app.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-xl p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nombre del club <span className="text-destructive">*</span>
                </span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Ciudad <span className="text-destructive">*</span>
                </span>
                <input
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Provincia
                </span>
                <select
                  value={form.province}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, province: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                >
                  <option value="">— Selecciona —</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Teléfono
                </span>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Dirección
                </span>
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                  placeholder="Calle, número, código postal..."
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Email de contacto
                </span>
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactEmail: e.target.value }))
                  }
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Web
                </span>
                <input
                  value={form.website}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, website: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Instagram (sin @)
                </span>
                <input
                  value={form.instagram}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, instagram: e.target.value }))
                  }
                  placeholder="miclub"
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Logo (URL de imagen)
                </span>
                <input
                  value={form.logoUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, logoUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
                />
              </label>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={save.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-md bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-60"
              >
                {save.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Guardar cambios
              </button>
            </div>
          </form>
        )}

        {/* Pistas del club. Solo aparece cuando el club ya tiene id cargado;
            la sección se gestiona inline igual que en /clubes para AMT. */}
        {clubId && (
          <section className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <LayoutGrid size={18} className="text-[#D4AF37]" />
              <h2 className="font-heading text-lg text-foreground">Pistas</h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Gestiona las pistas de tu club y sus bloqueos puntuales. Al
              crear un torneo, las pistas activas estarán disponibles para
              programar partidos.
            </p>
            <CourtsManager clubId={clubId} />
          </section>
        )}
      </div>
    </>
  );
}
