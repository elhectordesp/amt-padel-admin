"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { adminService } from "@/lib/services/admin";
import type { SpaConfig } from "@/types";

// ── Small helpers ────────────────────────────────────────────────────────
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

function NumInput({
  label, value, onChange, step = 1, min, suffix,
}: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; min?: number; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
        />
        {suffix && <span className="text-xs text-muted-foreground w-6">{suffix}</span>}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showRecalcModal,  setShowRecalcModal]  = useState(false);
  const [showLeaveModal,   setShowLeaveModal]   = useState(false);
  const [pendingHref,      setPendingHref]      = useState<string | null>(null);
  const [local, setLocal] = useState<SpaConfig | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["spa-config"],
    queryFn:  adminService.spa.config,
  });

  useEffect(() => {
    if (config && !local) setLocal(structuredClone(config));
  }, [config]);

  const cfg: SpaConfig | undefined = local ?? config;

  const save = useMutation({
    mutationFn: () => adminService.spa.updateConfig(local!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["spa-config"] });
      toast.success("Configuración SPA guardada correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const recalculate = useMutation({
    mutationFn: adminService.spa.recalculate,
    onSuccess: () => {
      toast.success("Recalculación iniciada — puede tardar varios minutos");
      setShowRecalcModal(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setNested = (key: keyof SpaConfig, subKey: string, val: number) =>
    setLocal((p) => p ? { ...p, [key]: { ...(p[key] as Record<string, number>), [subKey]: val } } : p);

  const isDirty = local && config && JSON.stringify(local) !== JSON.stringify(config);

  // Aviso en recarga / cierre de pestaña
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Interceptar clics en <a> del sidebar cuando hay cambios sin guardar
  const handleLinkClick = useCallback((e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || !isDirty) return;
    const href = anchor.getAttribute("href");
    if (!href || href === "/configuracion") return;
    e.preventDefault();
    setPendingHref(href);
    setShowLeaveModal(true);
  }, [isDirty]);

  useEffect(() => {
    document.addEventListener("click", handleLinkClick, true);
    return () => document.removeEventListener("click", handleLinkClick, true);
  }, [handleLinkClick]);

  const confirmLeave = () => {
    setShowLeaveModal(false);
    if (pendingHref) router.push(pendingHref);
  };

  if (isLoading || !cfg || !cfg.k_factors) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Configuración" />
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Configuración" />

      <div className="flex-1 p-6 space-y-5 max-w-4xl">

        {/* Unsaved changes bar */}
        {isDirty && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)] rounded-lg">
            <span className="text-sm text-[#D4AF37] font-medium">Hay cambios sin guardar</span>
            <div className="flex gap-2">
              <button
                onClick={() => setLocal(structuredClone(config!))}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
              >
                Descartar
              </button>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-xs font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
              >
                {save.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            </div>
          </div>
        )}


        {/* K-factors */}
        <Section
          title="K-factors — Volatilidad"
          description="Cuántos puntos SPA se mueven por partido según el historial del jugador"
        >
          <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
            K mayor = cambios más bruscos. Recomendado: Calibrando 32, Asentando 16, Estable 8.
            Reducir K estabiliza el ranking; aumentarlo lo hace más reactivo a resultados recientes.
          </p>
          <NumInput
            label="Calibrando (< partidos de calibración)"
            value={cfg.k_factors.calibrating}
            onChange={(v) => setNested("k_factors", "calibrating", v)}
            min={1}
          />
          <NumInput
            label="Asentando (fiabilidad < 60%)"
            value={cfg.k_factors.settling}
            onChange={(v) => setNested("k_factors", "settling", v)}
            min={1}
          />
          <NumInput
            label="Estable (fiabilidad ≥ 60%)"
            value={cfg.k_factors.stable}
            onChange={(v) => setNested("k_factors", "stable", v)}
            min={1}
          />
        </Section>

        {/* Tier multipliers */}
        <Section
          title="Multiplicadores por tier de torneo"
          description="Los puntos SPA y de circuito se multiplican según el tier del torneo"
        >
          <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
            Un Open con base 100 pts y multiplicador 1.0 otorga 100 pts. Un Gold con 2.0 otorga 200 pts.
            Ajusta la distancia entre tiers para reflejar la dificultad relativa.
          </p>
          <NumInput label="⚪ Open"   value={cfg.tier_multipliers.open}   onChange={(v) => setNested("tier_multipliers", "open",   v)} step={0.1} min={0.1} />
          <NumInput label="🥈 Silver" value={cfg.tier_multipliers.silver} onChange={(v) => setNested("tier_multipliers", "silver", v)} step={0.1} min={0.1} />
          <NumInput label="🥇 Gold"   value={cfg.tier_multipliers.gold}   onChange={(v) => setNested("tier_multipliers", "gold",   v)} step={0.1} min={0.1} />
        </Section>

        {/* Round multipliers */}
        <Section
          title="Multiplicadores por ronda"
          description="Los puntos base se multiplican según la importancia del partido dentro del torneo"
        >
          <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
            Ganar en Final vale más que en grupos. Multiplica los puntos SPA base por este factor.
            Valores sugeridos: Grupos 0.85, Final 1.5. No bajar de 0.5 ni subir de 3.0.
          </p>
          <NumInput label="Fase de grupos"  value={cfg.round_multipliers.groups}       onChange={(v) => setNested("round_multipliers", "groups",       v)} step={0.05} min={0.1} />
          <NumInput label="R16 / Previas"   value={cfg.round_multipliers.r16}          onChange={(v) => setNested("round_multipliers", "r16",          v)} step={0.05} min={0.1} />
          <NumInput label="Cuartos de final" value={cfg.round_multipliers.quarterfinal} onChange={(v) => setNested("round_multipliers", "quarterfinal", v)} step={0.05} min={0.1} />
          <NumInput label="Semifinal"        value={cfg.round_multipliers.semifinal}    onChange={(v) => setNested("round_multipliers", "semifinal",    v)} step={0.05} min={0.1} />
          <NumInput label="Final"            value={cfg.round_multipliers.final}        onChange={(v) => setNested("round_multipliers", "final",        v)} step={0.05} min={0.1} />
        </Section>

        {/* Circuit base points */}
        <Section
          title="Puntos de circuito base (torneo Open)"
          description="Puntos que otorga cada ronda en un Open. Se multiplican por el tier del torneo."
          collapsible
        >
          <NumInput label="Ganador"        value={cfg.circuit_base_points.winner}       onChange={(v) => setNested("circuit_base_points", "winner",       v)} min={0} />
          <NumInput label="Finalista"      value={cfg.circuit_base_points.finalist}     onChange={(v) => setNested("circuit_base_points", "finalist",     v)} min={0} />
          <NumInput label="Semifinal"      value={cfg.circuit_base_points.semifinal}    onChange={(v) => setNested("circuit_base_points", "semifinal",    v)} min={0} />
          <NumInput label="Cuartos"        value={cfg.circuit_base_points.quarterfinal} onChange={(v) => setNested("circuit_base_points", "quarterfinal", v)} min={0} />
          <NumInput label="R16"            value={cfg.circuit_base_points.r16}          onChange={(v) => setNested("circuit_base_points", "r16",          v)} min={0} />
          <NumInput label="Fase de grupos" value={cfg.circuit_base_points.groups}       onChange={(v) => setNested("circuit_base_points", "groups",       v)} min={0} />

          {/* Preview table */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Vista previa puntos por tier</p>
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Ronda", "⚪ Open", "🥈 Silver", "🥇 Gold"].map((h) => (
                    <th key={h} className="pb-2 text-left text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["winner","finalist","semifinal","quarterfinal","r16","groups"] as const).map((round) => {
                  const base = cfg.circuit_base_points[round];
                  const labels: Record<string, string> = { winner: "Ganador", finalist: "Finalista", semifinal: "Semifinal", quarterfinal: "Cuartos", r16: "R16", groups: "Grupos" };
                  return (
                    <tr key={round} className="border-b border-border last:border-0">
                      <td className="py-1.5 text-muted-foreground">{labels[round]}</td>
                      <td className="py-1.5 text-foreground font-medium">{Math.round(base * cfg.tier_multipliers.open)}</td>
                      <td className="py-1.5 text-foreground font-medium">{Math.round(base * cfg.tier_multipliers.silver)}</td>
                      <td className="py-1.5 text-[#D4AF37] font-bold">{Math.round(base * cfg.tier_multipliers.gold)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </Section>

        {/* General */}
        <Section
          title="Parámetros generales"
          description="SPA inicial de nuevos jugadores y umbral de calibración"
          collapsible
        >
          <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
            El SPA inicial determina el nivel de partida de cada jugador nuevo. La calibración es el número
            de partidos necesarios para que el sistema considere el rating fiable y reduzca la volatilidad.
          </p>
          <NumInput
            label="SPA inicial (nuevos jugadores)"
            value={cfg.starting_spa}
            onChange={(v) => setLocal((p) => p ? { ...p, starting_spa: v } : p)}
            min={0}
          />
          <NumInput
            label="Partidos para calibración completa"
            value={cfg.calibration_matches}
            onChange={(v) => setLocal((p) => p ? { ...p, calibration_matches: v } : p)}
            min={1}
            suffix="prt"
          />
        </Section>

        {/* Thresholds */}
        <Section
          title="Umbrales de categoría SPA"
          description="Rango de puntos SPA que define cada nivel. Cambiar estos valores requiere recalcular."
          collapsible
        >
          <p className="text-xs text-muted-foreground mb-3 pb-3 border-b border-border">
            Define el rango [mín, máx] de puntos SPA para cada categoría. Los rangos deben ser
            continuos y no solaparse. Tras modificarlos, pulsa &quot;Recalcular SPA&quot; para reasignar categorías.
          </p>
          <div className="space-y-0">
            {(Object.entries(cfg.thresholds) as [string, [number, number]][]).map(([level, [min, max]]) => {
              const label = level === "iniciacion" ? "Iniciación" : level.replace("a", "ª");
              return (
                <div key={level} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground w-24">{label}</span>
                  <input
                    type="number" value={min} min={0}
                    onChange={(e) => setLocal((p) => p ? { ...p, thresholds: { ...p.thresholds, [level]: [Number(e.target.value), max] as [number, number] } } : p)}
                    className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                  <span className="text-xs text-muted-foreground">—</span>
                  <input
                    type="number" value={max} min={0}
                    onChange={(e) => setLocal((p) => p ? { ...p, thresholds: { ...p.thresholds, [level]: [min, Number(e.target.value)] as [number, number] } } : p)}
                    className="w-24 h-8 px-2 text-right rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                  <span className="text-xs text-muted-foreground ml-auto">SPA</span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Danger zone */}
        <div className="bg-card border border-destructive/30 rounded-lg p-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle size={14} className="text-destructive" />
              Zona de peligro — Recalcular SPA
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Recalcula los puntos SPA de todos los jugadores desde el historial de partidos usando la configuración actual. El proceso corre en background y puede tardar varios minutos. Los rankings actuales serán sobreescritos.
            </p>
          </div>
          <button
            onClick={() => setShowRecalcModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-destructive/40 text-sm text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          >
            <RefreshCw size={14} />
            Recalcular todo
          </button>
        </div>

      </div>

      <ConfirmModal
        open={showRecalcModal}
        title="¿Recalcular todo el SPA?"
        description="Se recalcularán los puntos SPA de TODOS los jugadores desde el inicio del historial usando la configuración actual. Los valores de SPA y las categorías asignadas actualmente serán sobreescritos. Esta operación corre en background y puede tardar varios minutos. No se puede deshacer."
        confirmLabel="Sí, recalcular"
        danger
        loading={recalculate.isPending}
        onClose={() => setShowRecalcModal(false)}
        onConfirm={() => recalculate.mutate()}
      />

      <ConfirmModal
        open={showLeaveModal}
        title="¿Salir sin guardar?"
        description="Tienes cambios en la configuración SPA que no se han guardado. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        danger
        onClose={() => setShowLeaveModal(false)}
        onConfirm={confirmLeave}
      />
    </div>
  );
}
