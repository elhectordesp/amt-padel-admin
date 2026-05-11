"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Bell, CreditCard, Shield, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";

const generalSchema = z.object({
  platformName:   z.string().min(2),
  supportEmail:   z.string().email(),
  supportPhone:   z.string().optional(),
  defaultCurrency:z.string().min(1),
});
type GeneralForm = z.infer<typeof generalSchema>;

type Tab = "general" | "notificaciones" | "pagos" | "permisos";

function Field({ label, hint, error, children }: {
  label:    string;
  hint?:    string;
  error?:   string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-3 border-b border-border last:border-0">
      <span className="text-sm text-foreground">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-[#D4AF37]" : "bg-secondary border border-border"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "general",        label: "General",        icon: Settings    },
  { key: "notificaciones", label: "Notificaciones", icon: Bell        },
  { key: "pagos",          label: "Pagos",          icon: CreditCard  },
  { key: "permisos",       label: "Permisos",       icon: Shield      },
];

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>("general");

  const [notifSettings, setNotifSettings] = useState({
    newRegistration:  true,
    paymentReceived:  true,
    matchResult:      true,
    categoryChange:   false,
    systemAlerts:     true,
    weeklyReport:     true,
  });

  const generalForm = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      platformName:    "AMT Padel Tournaments",
      supportEmail:    "soporte@amttournaments.com",
      supportPhone:    "+34 600 123 456",
      defaultCurrency: "EUR",
    },
  });

  const handleGeneralSave = (data: GeneralForm) => {
    // TODO: connect to PATCH /admin/config when endpoint is available
    toast.success("Configuración guardada");
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Configuración" />

      <div className="flex-1 p-6 max-w-4xl space-y-5">

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === key
                  ? "border-[#D4AF37] text-[#D4AF37]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ── GENERAL ── */}
        {tab === "general" && (
          <form onSubmit={generalForm.handleSubmit(handleGeneralSave)} className="space-y-5">
            <div className="bg-card border border-border rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Información de la plataforma</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Nombre de la plataforma"
                  error={generalForm.formState.errors.platformName?.message}
                >
                  <Input {...generalForm.register("platformName")} />
                </Field>
                <Field
                  label="Moneda por defecto"
                  error={generalForm.formState.errors.defaultCurrency?.message}
                >
                  <select
                    {...generalForm.register("defaultCurrency")}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="EUR">EUR — Euro</option>
                    <option value="USD">USD — Dólar</option>
                    <option value="GBP">GBP — Libra</option>
                  </select>
                </Field>
                <Field
                  label="Email de soporte"
                  error={generalForm.formState.errors.supportEmail?.message}
                >
                  <Input {...generalForm.register("supportEmail")} type="email" />
                </Field>
                <Field label="Teléfono de contacto">
                  <Input {...generalForm.register("supportPhone")} type="tel" />
                </Field>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={generalForm.formState.isSubmitting}
                className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
              >
                {generalForm.formState.isSubmitting
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Check size={14} />
                }
                Guardar cambios
              </button>
            </div>
          </form>
        )}

        {/* ── NOTIFICACIONES ── */}
        {tab === "notificaciones" && (
          <div className="bg-card border border-border rounded-lg p-5 space-y-1">
            <h3 className="text-sm font-semibold text-foreground mb-3">Notificaciones por email</h3>
            <Toggle
              label="Nueva inscripción recibida"
              checked={notifSettings.newRegistration}
              onChange={(v) => setNotifSettings((s) => ({ ...s, newRegistration: v }))}
            />
            <Toggle
              label="Pago confirmado"
              checked={notifSettings.paymentReceived}
              onChange={(v) => setNotifSettings((s) => ({ ...s, paymentReceived: v }))}
            />
            <Toggle
              label="Resultado de partido introducido"
              checked={notifSettings.matchResult}
              onChange={(v) => setNotifSettings((s) => ({ ...s, matchResult: v }))}
            />
            <Toggle
              label="Solicitud de cambio de categoría"
              checked={notifSettings.categoryChange}
              onChange={(v) => setNotifSettings((s) => ({ ...s, categoryChange: v }))}
            />
            <Toggle
              label="Alertas del sistema"
              checked={notifSettings.systemAlerts}
              onChange={(v) => setNotifSettings((s) => ({ ...s, systemAlerts: v }))}
            />
            <Toggle
              label="Resumen semanal"
              checked={notifSettings.weeklyReport}
              onChange={(v) => setNotifSettings((s) => ({ ...s, weeklyReport: v }))}
            />
            <div className="pt-3">
              <button
                onClick={() => toast.success("Preferencias guardadas")}
                className="px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors"
              >
                Guardar preferencias
              </button>
            </div>
          </div>
        )}

        {/* ── PAGOS ── */}
        {tab === "pagos" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Métodos de pago</h3>
              <div className="space-y-3">
                {[
                  { name: "Stripe", desc: "Tarjetas de crédito y débito", active: true  },
                  { name: "Bizum", desc: "Pago móvil instantáneo (España)", active: false },
                  { name: "Transferencia bancaria", desc: "SEPA / SWIFT", active: true  },
                ].map((m) => (
                  <div key={m.name} className="flex items-center gap-4 p-3 bg-secondary/50 rounded-md border border-border">
                    <div className="w-8 h-8 rounded bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                      <CreditCard size={14} className="text-[#D4AF37]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.active ? "text-green-400 bg-green-400/10 border-green-400/30" : "text-muted-foreground bg-secondary border-border"}`}>
                      {m.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">IVA y facturación</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo de IVA (%)">
                  <Input type="number" defaultValue={21} min={0} max={100} />
                </Field>
                <Field label="Prefijo de factura">
                  <Input defaultValue="AMT-" />
                </Field>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => toast.success("Configuración de pagos guardada")}
                  className="px-5 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PERMISOS ── */}
        {tab === "permisos" && (
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Roles de administrador</h3>
            <div className="space-y-3">
              {[
                { name: "Super Admin", email: "admin@amt.com",        perms: ["Acceso total"],                               active: true  },
                { name: "Árbitro",     email: "arbitro@amt.com",      perms: ["Resultados", "Calendario"],                  active: true  },
                { name: "Coordinador", email: "coord@amt.com",        perms: ["Torneos", "Inscripciones"],                  active: false },
              ].map((admin) => (
                <div key={admin.email} className="flex items-center gap-4 p-3 bg-secondary/50 rounded-md border border-border">
                  <div className="w-9 h-9 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-[#D4AF37]">{admin.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {admin.perms.map((p) => (
                        <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.2)]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full border ${admin.active ? "text-green-400 bg-green-400/10 border-green-400/30" : "text-muted-foreground bg-secondary border-border"}`}>
                    {admin.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              La gestión completa de permisos estará disponible próximamente.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
