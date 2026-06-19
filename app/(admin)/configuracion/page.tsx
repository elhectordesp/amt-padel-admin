"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save, Loader2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Settings, Calendar, Trophy, Mail, Bell, Layers, Users, Shield,
  Plus, Trash2, UserPlus, X, ChevronRight, MessageCircleQuestion,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import type {
  SpaConfig,
  AppConfigGeneral, AppConfigCircuit, AppConfigSeason,
  AppConfigEmail, AppConfigPush, AppConfigTournamentDefaults,
  AppConfigFaqs, FaqCategory, FaqEntry,
  AdminMember,
} from "@/types";

// ── Shared UI primitives ────────────────────────────────────────────────────

function Section({
  title, description, children, collapsible = false,
}: {
  title: string; description?: string; children: React.ReactNode; collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 border-b border-border hover:bg-secondary/30 transition-colors"
        onClick={() => collapsible && setOpen((o) => !o)}
        type="button"
      >
        <div className="text-left">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {collapsible && (open
          ? <ChevronUp size={15} className="text-muted-foreground shrink-0" />
          : <ChevronDown size={15} className="text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] ${className || "w-56"}`}
    />
  );
}

function NumInput({ label, value, onChange, step = 1, min, suffix }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; suffix?: string;
}) {
  return (
    <FieldRow label={label}>
      <input
        type="number" value={value} step={step} min={min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
      />
      {suffix && <span className="text-xs text-muted-foreground w-6">{suffix}</span>}
    </FieldRow>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[#D4AF37]" : "bg-border"}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

// Used by every tab — prevents losing unsaved changes via tab close,
// reload, address bar typing, or clicking any anchor outside /configuracion.
// Returns the JSX of the leave-confirm modal so the tab can render it.
function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [isDirty]);

  const handleLinkClick = useCallback((e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || !isDirty) return;
    const href = anchor.getAttribute("href");
    if (!href || href.includes("/configuracion")) return;
    e.preventDefault();
    setPendingHref(href);
  }, [isDirty]);

  useEffect(() => {
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [handleLinkClick]);

  return (
    <ConfirmModal
      open={!!pendingHref}
      title="¿Salir sin guardar?"
      description="Tienes cambios sin guardar en esta sección de la configuración."
      confirmLabel="Salir sin guardar"
      danger
      onClose={() => setPendingHref(null)}
      onConfirm={() => { const h = pendingHref; setPendingHref(null); if (h) router.push(h); }}
    />
  );
}

function SaveBar({ isDirty, saving, onSave, onDiscard }: {
  isDirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void;
}) {
  // Wraps the unsaved-changes guard so every tab using SaveBar gets it for free
  // (replaces the per-tab beforeunload + link interceptor that only TabSpa had).
  const leaveGuard = useUnsavedChangesGuard(isDirty);
  return (
    <>
      {isDirty && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)] rounded-lg">
          <span className="text-sm text-[#D4AF37] font-medium">Hay cambios sin guardar</span>
          <div className="flex gap-2">
            <button
              onClick={onDiscard}
              className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-xs font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>
        </div>
      )}
      {leaveGuard}
    </>
  );
}

// ── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: "general",            label: "General",            icon: Settings              },
  { id: "temporada",          label: "Temporada",          icon: Calendar              },
  { id: "circuito",           label: "Circuito",           icon: Trophy                },
  { id: "comunicaciones",     label: "Comunicaciones",     icon: Mail                  },
  { id: "notificaciones",     label: "Notificaciones",     icon: Bell                  },
  { id: "torneos",            label: "Torneos",            icon: Layers                },
  { id: "spa",                label: "SPA",                icon: ChevronRight          },
  { id: "faqs",               label: "FAQs",               icon: MessageCircleQuestion },
  { id: "administradores",    label: "Administradores",    icon: Users                 },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Tab: General ─────────────────────────────────────────────────────────────

function TabGeneral() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "general"],
    queryFn:  () => adminService.config.getSection("general") as Promise<AppConfigGeneral>,
  });
  const [local, setLocal] = useState<AppConfigGeneral | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !local) setLocal(structuredClone(data)); }, [data, local]);

  const cfg = local ?? data;
  const isDirty = local && data && JSON.stringify(local) !== JSON.stringify(data);

  const save = useMutation({
    mutationFn: () => adminService.config.updateGeneral(local!),
    onSuccess: (updated) => {
      qc.setQueryData(["config", "general"], updated);
      setLocal(null);
      toast.success("Configuración general guardada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AppConfigGeneral>(k: K, v: AppConfigGeneral[K]) =>
    setLocal((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <TabSkeleton />;
  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(null)} />

      <Section title="Identidad del circuito">
        <FieldRow label="Nombre del circuito">
          <TextInput value={cfg.circuitName} onChange={(v) => set("circuitName", v)} className="w-72" />
        </FieldRow>
        <FieldRow label="Email de contacto">
          <TextInput value={cfg.contactEmail} onChange={(v) => set("contactEmail", v)} type="email" className="w-72" />
        </FieldRow>
        <FieldRow label="WhatsApp de soporte">
          <TextInput value={cfg.supportWhatsapp} onChange={(v) => set("supportWhatsapp", v)} placeholder="+34 600 000 000" className="w-56" />
        </FieldRow>
        <FieldRow label="URL Reglamento">
          <TextInput value={cfg.reglamentoUrl} onChange={(v) => set("reglamentoUrl", v)} placeholder="https://…" className="w-72" />
        </FieldRow>
        <FieldRow label="URL Política de privacidad">
          <TextInput value={cfg.privacyPolicyUrl} onChange={(v) => set("privacyPolicyUrl", v)} placeholder="https://…" className="w-72" />
        </FieldRow>
      </Section>

      <Section title="Banner de anuncio" description="Aparece en la parte superior de la app para todos los jugadores">
        <FieldRow label="Activado">
          <Toggle
            checked={cfg.announcementBanner.enabled}
            onChange={(v) => set("announcementBanner", { ...cfg.announcementBanner, enabled: v })}
          />
        </FieldRow>
        <FieldRow label="Tipo">
          <select
            value={cfg.announcementBanner.type}
            onChange={(e) => set("announcementBanner", { ...cfg.announcementBanner, type: e.target.value as "info" | "warning" | "error" })}
            className="h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          >
            <option value="info">Info</option>
            <option value="warning">Aviso</option>
            <option value="error">Error / Urgente</option>
          </select>
        </FieldRow>
        <FieldRow label="Mensaje">
          <TextInput
            value={cfg.announcementBanner.text}
            onChange={(v) => set("announcementBanner", { ...cfg.announcementBanner, text: v })}
            placeholder="Texto del banner…"
            className="w-96"
          />
        </FieldRow>
      </Section>

      <Section title="Modo mantenimiento" description="Bloquea el acceso a la app y muestra un mensaje personalizado">
        <FieldRow label="Activado">
          <Toggle
            checked={cfg.maintenanceMode.enabled}
            onChange={(v) => set("maintenanceMode", { ...cfg.maintenanceMode, enabled: v })}
          />
        </FieldRow>
        <FieldRow label="Mensaje">
          <TextInput
            value={cfg.maintenanceMode.message}
            onChange={(v) => set("maintenanceMode", { ...cfg.maintenanceMode, message: v })}
            className="w-96"
          />
        </FieldRow>
      </Section>
    </div>
  );
}

// ── Tab: Temporada ────────────────────────────────────────────────────────────

function TabTemporada() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "season"],
    queryFn:  () => adminService.config.getSection("season") as Promise<AppConfigSeason>,
  });
  const [local, setLocal] = useState<AppConfigSeason | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !local) setLocal(structuredClone(data)); }, [data, local]);
  const [showClose,   setShowClose]   = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);

  const cfg = local ?? data;
  const isDirty = local && data && JSON.stringify(local) !== JSON.stringify(data);

  const save = useMutation({
    mutationFn: () => adminService.config.updateSeason(local!),
    onSuccess: (updated) => { qc.setQueryData(["config", "season"], updated); setLocal(null); toast.success("Temporada guardada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeSeason = useMutation({
    mutationFn: adminService.config.closeSeason,
    onSuccess: (res) => {
      toast.success(`Temporada ${res.previousSeason} cerrada`);
      setShowClose(false);
      qc.invalidateQueries({ queryKey: ["config", "season"] });
      setLocal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advanceSeason = useMutation({
    mutationFn: adminService.config.advanceSeason,
    onSuccess: (res) => {
      toast.success(`Temporada avanzada a ${res.newSeason}`);
      setShowAdvance(false);
      qc.invalidateQueries({ queryKey: ["config", "season"] });
      setLocal(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AppConfigSeason>(k: K, v: AppConfigSeason[K]) =>
    setLocal((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <TabSkeleton />;
  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(null)} />

      <Section title="Temporada activa">
        <FieldRow label="Año de temporada">
          <input
            type="number" value={cfg.currentSeason}
            onChange={(e) => set("currentSeason", Number(e.target.value))}
            className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
        </FieldRow>
        <FieldRow label="Fecha inicio">
          <TextInput value={cfg.startDate} onChange={(v) => set("startDate", v)} type="date" className="w-40" />
        </FieldRow>
        <FieldRow label="Fecha fin">
          <TextInput value={cfg.endDate} onChange={(v) => set("endDate", v)} type="date" className="w-40" />
        </FieldRow>
        <FieldRow label="Estado">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${cfg.status === "ACTIVE" ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
            {cfg.status === "ACTIVE" ? "Activa" : "Cerrada"}
          </span>
        </FieldRow>
      </Section>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Cerrar temporada</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Marca la temporada actual como CERRADA. El ranking queda congelado. No crea todavía la nueva temporada.
          </p>
          <button
            onClick={() => setShowClose(true)}
            disabled={cfg.status === "CLOSED"}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
          >
            Cerrar temporada {cfg.currentSeason}
          </button>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Avanzar temporada</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Incrementa el año de temporada en 1, resetea fechas al nuevo año y vuelve al estado ACTIVA.
          </p>
          <button
            onClick={() => setShowAdvance(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors"
          >
            Avanzar a {cfg.currentSeason + 1}
          </button>
        </div>
      </div>

      <ConfirmModal
        open={showClose}
        title={`¿Cerrar temporada ${cfg.currentSeason}?`}
        description="El ranking quedará congelado y la temporada marcada como CERRADA. Podrás avanzar después."
        confirmLabel="Sí, cerrar"
        danger
        loading={closeSeason.isPending}
        onClose={() => setShowClose(false)}
        onConfirm={() => closeSeason.mutate()}
      />
      <ConfirmModal
        open={showAdvance}
        title={`¿Avanzar a temporada ${cfg.currentSeason + 1}?`}
        description={`Se creará la temporada ${cfg.currentSeason + 1} con fechas ${cfg.currentSeason + 1}-01-01 → ${cfg.currentSeason + 1}-12-31 y estado ACTIVA.`}
        confirmLabel={`Avanzar a ${cfg.currentSeason + 1}`}
        loading={advanceSeason.isPending}
        onClose={() => setShowAdvance(false)}
        onConfirm={() => advanceSeason.mutate()}
      />
    </div>
  );
}

// ── Tab: Circuito ─────────────────────────────────────────────────────────────

function TabCircuito() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "circuit"],
    queryFn:  () => adminService.config.getSection("circuit") as Promise<AppConfigCircuit>,
  });
  const [local, setLocal] = useState<AppConfigCircuit | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !local) setLocal(structuredClone(data)); }, [data, local]);

  const cfg = local ?? data;
  const isDirty = local && data && JSON.stringify(local) !== JSON.stringify(data);

  const save = useMutation({
    mutationFn: () => adminService.config.updateCircuit(local!),
    onSuccess: (updated) => { qc.setQueryData(["config", "circuit"], updated); setLocal(null); toast.success("Config de circuito guardada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AppConfigCircuit>(k: K, v: AppConfigCircuit[K]) =>
    setLocal((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <TabSkeleton />;
  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(null)} />

      <Section title="Ranking de circuito">
        <NumInput
          label="Mejores N resultados (0 = todos)"
          value={cfg.bestNResults}
          onChange={(v) => set("bestNResults", v)}
          min={0}
        />
        <FieldRow label="Permitir doble categoría">
          <Toggle checked={cfg.allowDoubleCategory} onChange={(v) => set("allowDoubleCategory", v)} />
        </FieldRow>
        <FieldRow label="Mostrar solo temporada actual">
          <Toggle checked={cfg.showCurrentSeasonOnly} onChange={(v) => set("showCurrentSeasonOnly", v)} />
        </FieldRow>
        <FieldRow label="Criterio de desempate">
          <select
            value={cfg.tiebreaker}
            onChange={(e) => set("tiebreaker", e.target.value as AppConfigCircuit["tiebreaker"])}
            className="h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          >
            <option value="wins">Victorias</option>
            <option value="points">Puntos</option>
            <option value="head2head">Head-to-head</option>
          </select>
        </FieldRow>
        <FieldRow label="Congelación del ranking">
          <TextInput
            value={cfg.rankingFreezeDate ?? ""}
            onChange={(v) => set("rankingFreezeDate", v || null)}
            type="date"
            className="w-40"
          />
        </FieldRow>
      </Section>
    </div>
  );
}

// ── Tab: Comunicaciones ───────────────────────────────────────────────────────

function TabComunicaciones() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "email"],
    queryFn:  () => adminService.config.getSection("email") as Promise<AppConfigEmail>,
  });
  const [local, setLocal] = useState<AppConfigEmail | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !local) setLocal(structuredClone(data)); }, [data, local]);

  const cfg = local ?? data;
  const isDirty = local && data && JSON.stringify(local) !== JSON.stringify(data);

  const save = useMutation({
    mutationFn: () => adminService.config.updateEmail(local!),
    onSuccess: (updated) => { qc.setQueryData(["config", "email"], updated); setLocal(null); toast.success("Config de email guardada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AppConfigEmail>(k: K, v: AppConfigEmail[K]) =>
    setLocal((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <TabSkeleton />;

  const toggles: [keyof AppConfigEmail, string][] = [
    ["enableRegistrationConfirmation", "Confirmación de inscripción"],
    ["enableResultNotification",       "Notificación de resultado"],
    ["enableCategoryChange",           "Cambio de categoría"],
    ["enableInviteEmail",              "Email de invitación"],
    ["enablePasswordReset",            "Restablecimiento de contraseña"],
    ["enableWelcomeEmail",             "Bienvenida al circuito"],
  ];

  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(null)} />

      <Section title="Remitente">
        <FieldRow label="Nombre del remitente">
          <TextInput value={cfg.fromName} onChange={(v) => set("fromName", v)} className="w-56" />
        </FieldRow>
        <FieldRow label="Responder a">
          <TextInput value={cfg.replyTo} onChange={(v) => set("replyTo", v)} type="email" className="w-56" />
        </FieldRow>
      </Section>

      <Section title="Tipos de email habilitados">
        {toggles.map(([key, label]) => (
          <FieldRow key={key} label={label}>
            <Toggle checked={cfg[key] as boolean} onChange={(v) => set(key, v as boolean)} />
          </FieldRow>
        ))}
      </Section>
    </div>
  );
}

// ── Tab: Notificaciones ───────────────────────────────────────────────────────

function TabNotificaciones() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "push"],
    queryFn:  () => adminService.config.getSection("push") as Promise<AppConfigPush>,
  });
  const [local, setLocal] = useState<AppConfigPush | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !local) setLocal(structuredClone(data)); }, [data, local]);

  const cfg = local ?? data;
  const isDirty = local && data && JSON.stringify(local) !== JSON.stringify(data);

  const save = useMutation({
    mutationFn: () => adminService.config.updatePush(local!),
    onSuccess: (updated) => { qc.setQueryData(["config", "push"], updated); setLocal(null); toast.success("Config de notificaciones guardada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AppConfigPush>(k: K, v: AppConfigPush[K]) =>
    setLocal((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <TabSkeleton />;

  const toggles: [keyof AppConfigPush, string][] = [
    ["enableMatchScheduled",        "Partido programado"],
    ["enableResultRecorded",        "Resultado registrado"],
    ["enableTournamentPublished",   "Torneo publicado"],
    ["enableMatchReminder",         "Recordatorio de partido"],
    ["enableRegistrationConfirmed", "Inscripción confirmada"],
    ["enableCategoryChange",        "Cambio de categoría"],
  ];

  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(null)} />

      <Section title="Notificaciones push habilitadas" description="Los jugadores pueden desactivar individualmente en su app">
        {toggles.map(([key, label]) => (
          <FieldRow key={key} label={label}>
            <Toggle checked={cfg[key] as boolean} onChange={(v) => set(key, v as boolean)} />
          </FieldRow>
        ))}
      </Section>
    </div>
  );
}

// ── Tab: Torneos ──────────────────────────────────────────────────────────────

function TabTorneos() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "tournamentDefaults"],
    queryFn:  () => adminService.config.getSection("tournamentDefaults") as Promise<AppConfigTournamentDefaults>,
  });
  const [local, setLocal] = useState<AppConfigTournamentDefaults | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (data && !local) setLocal(structuredClone(data)); }, [data, local]);

  const cfg = local ?? data;
  const isDirty = local && data && JSON.stringify(local) !== JSON.stringify(data);

  const save = useMutation({
    mutationFn: () => adminService.config.updateTournamentDefaults(local!),
    onSuccess: (updated) => { qc.setQueryData(["config", "tournamentDefaults"], updated); setLocal(null); toast.success("Valores por defecto guardados"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof AppConfigTournamentDefaults>(k: K, v: AppConfigTournamentDefaults[K]) =>
    setLocal((p) => p ? { ...p, [k]: v } : p);

  if (isLoading || !cfg) return <TabSkeleton />;
  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(null)} />

      <Section title="Valores por defecto para nuevos torneos" description="Estos valores se usan como punto de partida al crear un torneo; se pueden modificar por torneo">
        <NumInput label="Duración de partido" value={cfg.matchDuration} onChange={(v) => set("matchDuration", v)} min={15} suffix="min" />
        <FieldRow label="Sistema de puntuación">
          <select
            value={cfg.scoringSystem}
            onChange={(e) => set("scoringSystem", e.target.value)}
            className="h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          >
            <option value="BEST_OF_3">Mejor de 3 sets</option>
            <option value="BEST_OF_1">1 set</option>
            <option value="PRO_SET">Pro set</option>
          </select>
        </FieldRow>
        <NumInput label="Días límite de inscripción" value={cfg.registrationDeadlineDays} onChange={(v) => set("registrationDeadlineDays", v)} min={0} suffix="días" />
        <FieldRow label="Formato por defecto">
          <select
            value={cfg.defaultFormat}
            onChange={(e) => set("defaultFormat", e.target.value)}
            className="h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          >
            <option value="grupos+eliminatoria">Grupos + eliminatoria</option>
            <option value="grupos">Solo grupos</option>
            <option value="eliminatoria">Solo eliminatoria</option>
          </select>
        </FieldRow>
        <FieldRow label="Camisetas incluidas por defecto">
          <Toggle checked={cfg.hasShirtsDefault} onChange={(v) => set("hasShirtsDefault", v)} />
        </FieldRow>
        <FieldRow label="Cabezas de serie por defecto">
          <Toggle checked={cfg.useSeedingDefault} onChange={(v) => set("useSeedingDefault", v)} />
        </FieldRow>
      </Section>
    </div>
  );
}

// ── Tab: SPA ─────────────────────────────────────────────────────────────────

function TabSpa() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showRecalcModal, setShowRecalcModal]  = useState(false);
  const [recalcStartedAt, setRecalcStartedAt]  = useState<number | null>(null);
  const [local, setLocal] = useState<SpaConfig | null>(null);

  const { data: config, isLoading } = useQuery({ queryKey: ["spa-config"], queryFn: adminService.spa.config });
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (config && !local) setLocal(structuredClone(config)); }, [config, local]);

  const cfg: SpaConfig | undefined = local ?? config;
  const isDirty = local && config && JSON.stringify(local) !== JSON.stringify(config);

  const save = useMutation({
    mutationFn: () => adminService.spa.updateConfig(local!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["spa-config"] }); toast.success("Configuración SPA guardada"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const recalculate = useMutation({
    mutationFn: adminService.spa.recalculate,
    onSuccess: () => {
      toast.success("Recalculación iniciada — puede tardar varios minutos");
      setShowRecalcModal(false);
      setRecalcStartedAt(Date.now());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setNested = (key: keyof SpaConfig, subKey: string, val: number) =>
    setLocal((p) => p ? { ...p, [key]: { ...(p[key] as Record<string, number>), [subKey]: val } } : p);

  if (isLoading || !cfg || !cfg.k_factors) return <TabSkeleton />;

  return (
    <div className="space-y-5">
      <SaveBar isDirty={!!isDirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setLocal(structuredClone(config!))} />

      <Section title="K-factors — Volatilidad" description="Cuántos puntos SPA se mueven por partido según el historial del jugador">
        <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
          K mayor = cambios más bruscos. Recomendado: Calibrando 32, Asentando 16, Estable 8.
        </p>
        <NumInput label="Calibrando (< partidos de calibración)" value={cfg.k_factors.calibrating} onChange={(v) => setNested("k_factors", "calibrating", v)} min={1} />
        <NumInput label="Asentando (fiabilidad < 60%)"           value={cfg.k_factors.settling}    onChange={(v) => setNested("k_factors", "settling",    v)} min={1} />
        <NumInput label="Estable (fiabilidad ≥ 60%)"             value={cfg.k_factors.stable}      onChange={(v) => setNested("k_factors", "stable",      v)} min={1} />
      </Section>

      <Section title="Multiplicadores por tier">
        <NumInput label="⚪ Open"   value={cfg.tier_multipliers.open}   onChange={(v) => setNested("tier_multipliers", "open",   v)} step={0.1} min={0.1} />
        <NumInput label="🥈 Silver" value={cfg.tier_multipliers.silver} onChange={(v) => setNested("tier_multipliers", "silver", v)} step={0.1} min={0.1} />
        <NumInput label="🥇 Gold"   value={cfg.tier_multipliers.gold}   onChange={(v) => setNested("tier_multipliers", "gold",   v)} step={0.1} min={0.1} />
      </Section>

      <Section title="Multiplicadores por ronda">
        <NumInput label="Fase de grupos"   value={cfg.round_multipliers.groups}       onChange={(v) => setNested("round_multipliers", "groups",       v)} step={0.05} min={0.1} />
        <NumInput label="R16 / Previas"    value={cfg.round_multipliers.r16}          onChange={(v) => setNested("round_multipliers", "r16",          v)} step={0.05} min={0.1} />
        <NumInput label="Cuartos de final" value={cfg.round_multipliers.quarterfinal} onChange={(v) => setNested("round_multipliers", "quarterfinal", v)} step={0.05} min={0.1} />
        <NumInput label="Semifinal"        value={cfg.round_multipliers.semifinal}    onChange={(v) => setNested("round_multipliers", "semifinal",    v)} step={0.05} min={0.1} />
        <NumInput label="Final"            value={cfg.round_multipliers.final}        onChange={(v) => setNested("round_multipliers", "final",        v)} step={0.05} min={0.1} />
      </Section>

      <Section title="Puntos de circuito base" collapsible>
        <NumInput label="Ganador"        value={cfg.circuit_base_points.winner}       onChange={(v) => setNested("circuit_base_points", "winner",       v)} min={0} />
        <NumInput label="Finalista"      value={cfg.circuit_base_points.finalist}     onChange={(v) => setNested("circuit_base_points", "finalist",     v)} min={0} />
        <NumInput label="Semifinal"      value={cfg.circuit_base_points.semifinal}    onChange={(v) => setNested("circuit_base_points", "semifinal",    v)} min={0} />
        <NumInput label="Cuartos"        value={cfg.circuit_base_points.quarterfinal} onChange={(v) => setNested("circuit_base_points", "quarterfinal", v)} min={0} />
        <NumInput label="R16"            value={cfg.circuit_base_points.r16}          onChange={(v) => setNested("circuit_base_points", "r16",          v)} min={0} />
        <NumInput label="Fase de grupos" value={cfg.circuit_base_points.groups}       onChange={(v) => setNested("circuit_base_points", "groups",       v)} min={0} />
      </Section>

      <Section title="Parámetros generales" collapsible>
        <NumInput label="SPA inicial (nuevos jugadores)"       value={cfg.starting_spa}        onChange={(v) => setLocal((p) => p ? { ...p, starting_spa: v } : p)} min={0} />
        <NumInput label="Partidos para calibración completa"   value={cfg.calibration_matches} onChange={(v) => setLocal((p) => p ? { ...p, calibration_matches: v } : p)} min={1} suffix="prt" />
      </Section>

      <Section title="Umbrales de categoría SPA" collapsible>
        <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
          Define el rango [mín, máx] de puntos SPA para cada categoría. Tras modificarlos, recalcula.
        </p>
        {(Object.entries(cfg.thresholds) as [string, [number, number]][]).map(([level, [min, max]]) => {
          const label = level === "iniciacion" ? "Iniciación" : level.replace("a", "ª");
          return (
            <div key={level} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
              <span className="text-sm text-muted-foreground w-24">{label}</span>
              <input type="number" value={min} min={0}
                onChange={(e) => setLocal((p) => p ? { ...p, thresholds: { ...p.thresholds, [level]: [Number(e.target.value), max] as [number, number] } } : p)}
                className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input type="number" value={max} min={0}
                onChange={(e) => setLocal((p) => p ? { ...p, thresholds: { ...p.thresholds, [level]: [min, Number(e.target.value)] as [number, number] } } : p)}
                className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="text-xs text-muted-foreground ml-auto">SPA</span>
            </div>
          );
        })}
      </Section>

      <div className="bg-card border border-destructive/30 rounded-lg p-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle size={14} className="text-destructive" />
            Zona de peligro — Recalcular SPA
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Recalcula los puntos SPA de todos los jugadores desde el historial de partidos usando la configuración actual. No se puede deshacer.
          </p>
        </div>
        <button
          onClick={() => setShowRecalcModal(true)}
          disabled={recalculate.isPending || recalcStartedAt !== null}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-destructive/40 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {recalculate.isPending
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />}
          {recalcStartedAt ? "Recalculando…" : "Recalcular todo"}
        </button>
      </div>

      {recalcStartedAt && (
        <div className="flex items-start gap-3 p-3 rounded-md bg-yellow-400/10 border border-yellow-400/30">
          <Loader2 size={14} className="text-yellow-400 shrink-0 mt-0.5 animate-spin" />
          <div className="flex-1 text-xs text-yellow-400">
            <p className="font-semibold">Recalculación SPA en marcha</p>
            <p className="text-yellow-400/80 mt-0.5">
              Iniciada hace {Math.round((Date.now() - recalcStartedAt) / 1000)}s. Puede tardar varios minutos. Puedes cerrar esta página, el cálculo continúa en el servidor.
            </p>
          </div>
          <button
            onClick={() => setRecalcStartedAt(null)}
            className="text-xs text-yellow-400/70 hover:text-yellow-400 underline shrink-0"
          >
            Ocultar
          </button>
        </div>
      )}

      <ConfirmModal
        open={showRecalcModal}
        title="¿Recalcular todo el SPA?"
        description="Se recalcularán los puntos SPA de TODOS los jugadores. No se puede deshacer."
        confirmLabel="Sí, recalcular"
        danger
        loading={recalculate.isPending}
        onClose={() => setShowRecalcModal(false)}
        onConfirm={() => recalculate.mutate()}
      />
    </div>
  );
}

// ── Tab: Administradores ──────────────────────────────────────────────────────

function TabAdministradores() {
  const qc = useQueryClient();
  const [showInvite,  setShowInvite]  = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AdminMember | null>(null);
  const [inviteForm, setInviteForm]   = useState({ email: "", firstName: "", lastName: "", role: "ADMIN" as "ADMIN" | "SUPERADMIN" });

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admin-members"],
    queryFn:  adminService.admins.list,
  });

  const invite = useMutation({
    mutationFn: () => adminService.admins.invite(inviteForm),
    onSuccess: () => {
      toast.success(`Invitación enviada a ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: "", firstName: "", lastName: "", role: "ADMIN" });
      qc.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: () => adminService.admins.revoke(revokeTarget!.id),
    onSuccess: () => {
      toast.success(`Acceso de ${revokeTarget!.name} revocado`);
      setRevokeTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleLabel = (role: string) =>
    role === "SUPERADMIN" ? "Super Admin" : "Admin";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{admins.length} administrador{admins.length !== 1 ? "es" : ""}</p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-xs font-semibold hover:bg-[#C49F2A] transition-colors"
        >
          <UserPlus size={13} />
          Invitar administrador
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay administradores registrados</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {admin.name}
                    {admin.managedByAdmin && (
                      <span className="ml-2 text-xs text-muted-foreground">(gestionado)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{admin.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${admin.role === "SUPERADMIN" ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37]" : "bg-secondary text-muted-foreground"}`}>
                      {roleLabel(admin.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setRevokeTarget(admin)}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                    >
                      <Trash2 size={12} />
                      Revocar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Shield size={16} className="text-[#D4AF37]" />
                Invitar administrador
              </h2>
              <button onClick={() => setShowInvite(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nombre</label>
                  <input value={inviteForm.firstName} onChange={(e) => setInviteForm((p) => ({ ...p, firstName: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="Nombre"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Apellidos</label>
                  <input value={inviteForm.lastName} onChange={(e) => setInviteForm((p) => ({ ...p, lastName: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                    placeholder="Apellidos"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Email</label>
                <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  placeholder="admin@email.com"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Rol</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm((p) => ({ ...p, role: e.target.value as "ADMIN" | "SUPERADMIN" }))}
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPERADMIN">Super Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => invite.mutate()}
                disabled={!inviteForm.email || !inviteForm.firstName || !inviteForm.lastName || invite.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors"
              >
                {invite.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                Invitar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!revokeTarget}
        title={`¿Revocar acceso de ${revokeTarget?.name}?`}
        description="El usuario perderá todos los permisos de administración. Su cuenta de jugador (si existe) se mantendrá."
        confirmLabel="Revocar acceso"
        danger
        loading={revoke.isPending}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revoke.mutate()}
      />
    </div>
  );
}

// ── Tab: FAQs ─────────────────────────────────────────────────────────────────

function TabFaqs() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["config", "faqs"],
    queryFn:  () => adminService.config.getSection("faqs") as Promise<AppConfigFaqs>,
  });

  const [cats, setCats] = useState<FaqCategory[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCats((data as AppConfigFaqs).categories ?? []);
      setDirty(false);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => adminService.config.updateFaqs({ categories: cats }),
    onSuccess: () => {
      toast.success("FAQs guardadas");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["config", "faqs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (updated: FaqCategory[]) => { setCats(updated); setDirty(true); };

  const addCategory = () =>
    update([...cats, { category: "Nueva categoría", faqs: [] }]);

  const removeCategory = (ci: number) =>
    update(cats.filter((_, i) => i !== ci));

  const updateCategoryName = (ci: number, name: string) =>
    update(cats.map((c, i) => i === ci ? { ...c, category: name } : c));

  const addFaq = (ci: number) =>
    update(cats.map((c, i) => i === ci
      ? { ...c, faqs: [...c.faqs, { q: "", a: "" }] }
      : c,
    ));

  const removeFaq = (ci: number, fi: number) =>
    update(cats.map((c, i) => i === ci
      ? { ...c, faqs: c.faqs.filter((_, j) => j !== fi) }
      : c,
    ));

  const updateFaq = (ci: number, fi: number, field: keyof FaqEntry, value: string) =>
    update(cats.map((c, i) => i === ci
      ? { ...c, faqs: c.faqs.map((f, j) => j === fi ? { ...f, [field]: value } : f) }
      : c,
    ));

  if (isLoading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cats.reduce((sum, c) => sum + c.faqs.length, 0)} preguntas en {cats.length} categorías · visibles en la app móvil
        </p>
        <button
          onClick={addCategory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <Plus size={13} /> Añadir categoría
        </button>
      </div>

      {cats.map((cat, ci) => (
        <div key={ci} className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Category header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/20">
            <GripVertical size={14} className="text-muted-foreground shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm font-semibold text-foreground focus:outline-none"
              value={cat.category}
              onChange={(e) => updateCategoryName(ci, e.target.value)}
              placeholder="Nombre de categoría"
            />
            <button
              onClick={() => removeCategory(ci)}
              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Eliminar categoría"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* FAQ list */}
          <div className="divide-y divide-border">
            {cat.faqs.map((faq, fi) => (
              <div key={fi} className="px-4 py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-2 shrink-0 w-4">P</span>
                  <input
                    className="flex-1 bg-secondary/30 rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    value={faq.q}
                    onChange={(e) => updateFaq(ci, fi, "q", e.target.value)}
                    placeholder="Pregunta…"
                  />
                  <button
                    onClick={() => removeFaq(ci, fi)}
                    className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-2 shrink-0 w-4">R</span>
                  <textarea
                    className="flex-1 bg-secondary/30 rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    rows={2}
                    value={faq.a}
                    onChange={(e) => updateFaq(ci, fi, "a", e.target.value)}
                    placeholder="Respuesta…"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Add FAQ */}
          <div className="px-4 py-2 border-t border-border">
            <button
              onClick={() => addFaq(ci)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus size={12} /> Añadir pregunta
            </button>
          </div>
        </div>
      ))}

      {cats.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground border border-dashed border-border rounded-lg">
          <MessageCircleQuestion size={32} />
          <p className="text-sm">Sin categorías. Pulsa &quot;Añadir categoría&quot; para empezar.</p>
        </div>
      )}

      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <button
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar FAQs
          </button>
        </div>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-36 rounded-lg bg-card animate-pulse border border-border" />
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ConfiguracionContent() {
  const params  = useSearchParams();
  const router  = useRouter();
  const tab     = (params.get("tab") ?? "general") as TabId;

  const setTab = (id: TabId) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    router.replace(url.pathname + url.search);
  };

  const tabContent: Record<TabId, React.ReactNode> = {
    general:         <TabGeneral />,
    temporada:       <TabTemporada />,
    circuito:        <TabCircuito />,
    comunicaciones:  <TabComunicaciones />,
    notificaciones:  <TabNotificaciones />,
    torneos:         <TabTorneos />,
    spa:             <TabSpa />,
    faqs:            <TabFaqs />,
    administradores: <TabAdministradores />,
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Configuración" />

      {/* Tab bar */}
      <div className="border-b border-border bg-card/40 sticky top-0 z-10">
        <div className="flex gap-0 overflow-x-auto no-scrollbar scroll-mask-x px-6">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                tab === id
                  ? "border-[#D4AF37] text-[#D4AF37]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-6 max-w-4xl">
        {tabContent[tab] ?? tabContent["general"]}
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-full">
        <Header title="Configuración" />
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    }>
      <ConfiguracionContent />
    </Suspense>
  );
}
