"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, ExternalLink, Globe, Trophy, MapPin,
  Image as ImageIcon, ToggleLeft, ToggleRight, GripVertical, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { Sponsor, SponsorScope } from "@/types";

// ── Constants ──────────────────────────────────────────────────────────────

const SCOPE_CONFIG: Record<SponsorScope, { label: string; icon: React.ElementType; color: string; description: string }> = {
  CIRCUIT:    { label: "Circuito",   icon: Trophy,  color: "text-[#D4AF37] bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.3)]",   description: "Visible en toda la app" },
  TOURNAMENT: { label: "Torneo",    icon: Globe,   color: "text-blue-400 bg-blue-400/10 border-blue-400/30",                           description: "Visible solo en ese torneo" },
  REGIONAL:   { label: "Regional",  icon: MapPin,  color: "text-purple-400 bg-purple-400/10 border-purple-400/30",                     description: "Visible al filtrar por ciudad" },
};

const TABS: { key: SponsorScope | "ALL"; label: string }[] = [
  { key: "ALL",        label: "Todos" },
  { key: "CIRCUIT",    label: "Circuito" },
  { key: "TOURNAMENT", label: "Por torneo" },
  { key: "REGIONAL",   label: "Regional" },
];

// ── ScopeBadge ─────────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: SponsorScope }) {
  const cfg = SCOPE_CONFIG[scope];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

// ── LogoPreview ────────────────────────────────────────────────────────────

function LogoPreview({ url, name }: { url?: string | null; name: string }) {
  if (!url) {
    return (
      <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center shrink-0">
        <ImageIcon size={14} className="text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-md bg-secondary border border-border flex items-center justify-center overflow-hidden shrink-0">
      <img src={url} alt={name} className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    </div>
  );
}

// ── SponsorModal ───────────────────────────────────────────────────────────

interface ModalState {
  open:     boolean;
  editing?: Sponsor;
}

const EMPTY_FORM = { name: "", logoUrl: "", websiteUrl: "", tagline: "", scope: "TOURNAMENT" as SponsorScope, tournamentId: "", city: "", displayOrder: 0, active: true };
type FormState = typeof EMPTY_FORM;

function SponsorModal({
  state, onClose, tournaments,
}: {
  state: ModalState;
  onClose: () => void;
  tournaments: { id: string; name: string }[];
}) {
  const qc        = useQueryClient();
  const isEditing = !!state.editing;

  const [form, setForm] = useState<FormState>(() =>
    state.editing
      ? {
          name:         state.editing.name,
          logoUrl:      state.editing.logoUrl ?? "",
          websiteUrl:   state.editing.websiteUrl ?? "",
          tagline:      state.editing.tagline ?? "",
          scope:        state.editing.scope,
          tournamentId: state.editing.tournamentId ?? "",
          city:         state.editing.city ?? "",
          displayOrder: state.editing.displayOrder,
          active:       state.editing.active,
        }
      : EMPTY_FORM,
  );

  const set = (key: keyof FormState, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name:         form.name.trim(),
        logoUrl:      form.logoUrl.trim()      || undefined,
        websiteUrl:   form.websiteUrl.trim()   || undefined,
        tagline:      form.tagline.trim()      || undefined,
        scope:        form.scope,
        tournamentId: form.scope === "TOURNAMENT" ? (form.tournamentId || undefined) : undefined,
        city:         form.scope === "REGIONAL"   ? (form.city.trim() || undefined)  : undefined,
        displayOrder: Number(form.displayOrder),
        active:       form.active,
      };
      return isEditing
        ? adminService.sponsors.update(state.editing!.id, payload)
        : adminService.sponsors.create(payload as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sponsors"] });
      toast.success(isEditing ? "Patrocinador actualizado" : "Patrocinador creado");
      onClose();
    },
    onError: () => toast.error("Error al guardar el patrocinador"),
  });

  const scopeCfg = SCOPE_CONFIG[form.scope];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading font-semibold text-foreground">
            {isEditing ? "Editar patrocinador" : "Nuevo patrocinador"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
        </div>

        <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Scope selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Tipo de patrocinador</label>
            <div className="grid grid-cols-3 gap-2">
              {(["CIRCUIT", "TOURNAMENT", "REGIONAL"] as SponsorScope[]).map((s) => {
                const cfg  = SCOPE_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <button
                    key={s}
                    onClick={() => set("scope", s)}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg border text-center transition-all ${
                      form.scope === s
                        ? `${cfg.color} border-current`
                        : "border-border text-muted-foreground hover:border-[rgba(212,175,55,0.3)] hover:text-foreground"
                    }`}
                  >
                    <Icon size={16} />
                    <span className="text-[11px] font-semibold">{cfg.label}</span>
                    <span className="text-[9px] opacity-70 leading-tight">{cfg.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Raquetas García"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
            />
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tagline <span className="opacity-60">(opcional)</span></label>
            <input
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Tu tienda de pádel en Sevilla"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">URL del logo <span className="opacity-60">(PNG/SVG con fondo transparente)</span></label>
            <div className="flex gap-2">
              <input
                value={form.logoUrl}
                onChange={(e) => set("logoUrl", e.target.value)}
                placeholder="https://example.com/logo.png"
                className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              />
              {form.logoUrl && (
                <div className="w-9 h-9 rounded-md border border-border bg-secondary overflow-hidden flex items-center justify-center shrink-0">
                  <img src={form.logoUrl} alt="" className="w-full h-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
            </div>
          </div>

          {/* Website */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">URL destino <span className="opacity-60">(al hacer tap en el logo)</span></label>
            <input
              value={form.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
              placeholder="https://raquetasgarcia.com"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
            />
          </div>

          {/* Torneo (solo scope TOURNAMENT) */}
          {form.scope === "TOURNAMENT" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Torneo <span className="opacity-60">(opcional — vincula al torneo específico)</span></label>
              <select
                value={form.tournamentId}
                onChange={(e) => set("tournamentId", e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              >
                <option value="">Sin torneo específico</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Ciudad (solo scope REGIONAL) */}
          {form.scope === "REGIONAL" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Ciudad</label>
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Sevilla"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              />
            </div>
          )}

          {/* Orden y activo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Orden de aparición</label>
              <input
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) => set("displayOrder", e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              />
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={() => set("active", !form.active)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-all ${
                  form.active
                    ? "border-green-400/30 bg-green-400/10 text-green-400"
                    : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {form.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {form.active ? "Activo" : "Inactivo"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!form.name.trim() || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#c9a52e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saveMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            {isEditing ? "Guardar cambios" : "Crear patrocinador"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SponsorRow ──────────────────────────────────────────────────────────────

function SponsorRow({
  sponsor, onEdit, onDelete, onToggle,
}: {
  sponsor:  Sponsor;
  onEdit:   (s: Sponsor) => void;
  onDelete: (s: Sponsor) => void;
  onToggle: (s: Sponsor) => void;
}) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <GripVertical size={14} className="text-muted-foreground/40 cursor-grab shrink-0" />
          <LogoPreview url={sponsor.logoUrl} name={sponsor.name} />
          <div>
            <p className="text-sm font-medium text-foreground">{sponsor.name}</p>
            {sponsor.tagline && <p className="text-[11px] text-muted-foreground mt-0.5">{sponsor.tagline}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <ScopeBadge scope={sponsor.scope} />
        {sponsor.scope === "TOURNAMENT" && sponsor.tournament && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[140px]">{sponsor.tournament.name}</p>
        )}
        {sponsor.scope === "REGIONAL" && sponsor.city && (
          <p className="text-[10px] text-muted-foreground mt-1">{sponsor.city}</p>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm text-muted-foreground tabular-nums">{sponsor.displayOrder}</span>
      </td>
      <td className="px-4 py-3">
        {sponsor.websiteUrl ? (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#D4AF37] hover:underline"
          >
            <ExternalLink size={10} />
            <span className="truncate max-w-[120px]">{sponsor.websiteUrl.replace(/^https?:\/\//, "")}</span>
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onToggle(sponsor)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
            sponsor.active
              ? "text-green-400 bg-green-400/10 border-green-400/30"
              : "text-muted-foreground bg-secondary border-border"
          }`}
        >
          {sponsor.active ? <ToggleRight size={10} /> : <ToggleLeft size={10} />}
          {sponsor.active ? "Activo" : "Inactivo"}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(sponsor)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(sponsor)}
            className="p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors"
            title="Eliminar"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PatrocinadoresPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<SponsorScope | "ALL">("ALL");
  const [modal, setModal]         = useState<ModalState>({ open: false });
  const [deleting, setDeleting]   = useState<Sponsor | null>(null);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey:  ["sponsors"],
    queryFn:   () => adminService.sponsors.list(),
    staleTime: 30_000,
  });

  const { data: tournaments = [] } = useQuery({
    queryKey:  ["tournaments-list"],
    queryFn:   adminService.tournaments.list,
    staleTime: 5 * 60_000,
    select:    (data) => data.map((t) => ({ id: t.id, name: t.name })),
  });

  const toggleMutation = useMutation({
    mutationFn: (s: Sponsor) => adminService.sponsors.update(s.id, { active: !s.active }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["sponsors"] }),
    onError:    () => toast.error("Error al actualizar el patrocinador"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminService.sponsors.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["sponsors"] }); toast.success("Patrocinador eliminado"); setDeleting(null); },
    onError:    () => toast.error("Error al eliminar el patrocinador"),
  });

  const filtered = activeTab === "ALL" ? sponsors : sponsors.filter((s) => s.scope === activeTab);

  const counts: Record<string, number> = {
    ALL:        sponsors.length,
    CIRCUIT:    sponsors.filter((s) => s.scope === "CIRCUIT").length,
    TOURNAMENT: sponsors.filter((s) => s.scope === "TOURNAMENT").length,
    REGIONAL:   sponsors.filter((s) => s.scope === "REGIONAL").length,
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Patrocinadores" />

      <div className="flex-1 p-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-1 border border-border">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${
                  activeTab === tab.key ? "bg-[rgba(212,175,55,0.2)] text-[#D4AF37]" : "bg-secondary text-muted-foreground"
                }`}>
                  {counts[tab.key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-black text-sm font-semibold hover:bg-[#c9a52e] transition-colors"
          >
            <Plus size={15} />
            Nuevo patrocinador
          </button>
        </div>

        {/* Scope info cards */}
        <div className="grid grid-cols-3 gap-3">
          {(["CIRCUIT", "TOURNAMENT", "REGIONAL"] as SponsorScope[]).map((scope) => {
            const cfg  = SCOPE_CONFIG[scope];
            const Icon = cfg.icon;
            return (
              <div key={scope} className={`rounded-lg border p-4 ${counts[scope] ? "bg-card" : "bg-card/50"}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-md border shrink-0 ${cfg.color}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.description}</p>
                    <p className={`text-xl font-heading font-bold mt-1 ${cfg.color.split(" ")[0]}`}>{counts[scope]}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
              <ImageIcon size={32} className="opacity-30" />
              <p className="text-sm">
                {activeTab === "ALL" ? "No hay patrocinadores todavía" : `No hay patrocinadores de tipo ${SCOPE_CONFIG[activeTab as SponsorScope]?.label}`}
              </p>
              <button
                onClick={() => setModal({ open: true })}
                className="text-xs text-[#D4AF37] hover:underline"
              >
                Añadir el primero
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["Patrocinador", "Tipo", "Orden", "Enlace", "Estado", ""].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sponsor) => (
                    <SponsorRow
                      key={sponsor.id}
                      sponsor={sponsor}
                      onEdit={(s)   => setModal({ open: true, editing: s })}
                      onDelete={(s) => setDeleting(s)}
                      onToggle={(s) => toggleMutation.mutate(s)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit modal */}
      {modal.open && (
        <SponsorModal
          state={modal}
          tournaments={tournaments}
          onClose={() => setModal({ open: false })}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-heading font-semibold text-foreground">Eliminar patrocinador</h3>
            <p className="text-sm text-muted-foreground">
              ¿Eliminar <span className="text-foreground font-medium">"{deleting.name}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleteMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
