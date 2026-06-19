"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, Pencil, Trash2, ExternalLink, Globe, Trophy, MapPin,
  Image as ImageIcon, ToggleLeft, ToggleRight, GripVertical, Loader2,
  Upload, MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { AUTONOMOUS_COMMUNITIES } from "@/lib/constants/spain";
import type { Sponsor, SponsorScope } from "@/types";

// ── Constants ──────────────────────────────────────────────────────────────

const SCOPE_CONFIG: Record<SponsorScope, { label: string; icon: React.ElementType; color: string; description: string }> = {
  CIRCUIT:    { label: "Circuito",  icon: Trophy, color: "text-[#D4AF37] bg-[rgba(212,175,55,0.1)] border-[rgba(212,175,55,0.3)]", description: "Visible en toda la app" },
  TOURNAMENT: { label: "Torneo",   icon: Globe,  color: "text-blue-400 bg-blue-400/10 border-blue-400/30",                         description: "Visible solo en ese torneo" },
  REGIONAL:   { label: "Regional", icon: MapPin, color: "text-purple-400 bg-purple-400/10 border-purple-400/30",                   description: "Visible al filtrar por CCAA" },
};

const TABS: { key: SponsorScope | "ALL"; label: string }[] = [
  { key: "ALL",        label: "Todos" },
  { key: "CIRCUIT",    label: "Circuito" },
  { key: "TOURNAMENT", label: "Por torneo" },
  { key: "REGIONAL",   label: "Regional" },
];

// ── Badges ─────────────────────────────────────────────────────────────────

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

// ── ImagePreview ────────────────────────────────────────────────────────────

function ImagePreview({ url, name }: { url?: string | null; name: string }) {
  if (!url) {
    return (
      <div className="w-16 h-[22px] rounded bg-secondary border border-border flex items-center justify-center shrink-0">
        <ImageIcon size={10} className="text-muted-foreground" />
      </div>
    );
  }
  return (
    <div className="w-16 h-[22px] rounded bg-secondary border border-border overflow-hidden shrink-0 relative">
      <Image src={url} alt={name} fill unoptimized className="object-cover" />
    </div>
  );
}

// ── ImageUploader ──────────────────────────────────────────────────────────

function ImageUploader({
  url, onUrl,
}: {
  url:   string;
  onUrl: (url: string) => void;
}) {
  const inputRef           = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Máximo 5 MB"); return; }
    setUploading(true);
    try {
      const { imageUrl } = await adminService.upload.sponsorImage(file);
      onUrl(imageUrl);
    } catch {
      toast.error("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        Imagen del banner{" "}
        <span className="opacity-60">(JPG/PNG, ratio 3:1 — ej. 1200×400 px, máx 5 MB)</span>
      </label>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => onUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[rgba(212,175,55,0.5)] disabled:opacity-50 transition-colors shrink-0"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          Subir
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
      </div>
      {url && (
        <div className="mt-2 rounded-md border border-border bg-secondary overflow-hidden relative" style={{ aspectRatio: "3/1", maxHeight: 120 }}>
          <Image src={url} alt="Preview" fill unoptimized className="object-cover" />
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1 opacity-70">
        La imagen se mostrará como banner horizontal en el carrusel de la app. Usa tu logo sobre fondo de marca, o una imagen diseñada con nombre y slogan.
      </p>
    </div>
  );
}

// ── CarouselPreview ────────────────────────────────────────────────────────

type SlideEntry = { id: string; name: string; imageUrl?: string | null; tagline?: string | null };

function CarouselPreview({
  peers,
  editingId,
  formName,
  formImageUrl,
  formTagline,
}: {
  peers:        Sponsor[];
  editingId?:   string;
  formName:     string;
  formImageUrl: string;
  formTagline:  string;
}) {
  const [idx,    setIdx]    = useState(0);
  const [fading, setFading] = useState(false);

  const slides = useMemo<SlideEntry[]>(() => {
    const live: SlideEntry = {
      id:       editingId ?? "__new__",
      name:     formName     || "Nombre del patrocinador",
      imageUrl: formImageUrl || null,
      tagline:  formTagline  || null,
    };
    if (editingId) {
      const found = peers.some((p) => p.id === editingId);
      if (found) return peers.map<SlideEntry>((p) => (p.id === editingId ? { ...p, ...live } : p));
    }
    return [...peers.map<SlideEntry>((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl, tagline: p.tagline })), live];
  }, [peers, editingId, formName, formImageUrl, formTagline]);

  const safeIdx   = Math.min(idx, slides.length - 1);
  const slide     = slides[safeIdx];
  const previewPos = slides.findIndex((s) => s.id === (editingId ?? "__new__")) + 1;

  // Auto-advance with fade
  useEffect(() => {
    if (slides.length <= 1) return;
    const next = (safeIdx + 1) % slides.length;
    const outer = setTimeout(() => {
      setFading(true);
      const inner = setTimeout(() => { setIdx(next); setFading(false); }, 200);
      return () => clearTimeout(inner);
    }, 3500);
    return () => clearTimeout(outer);
  }, [safeIdx, slides.length]);

  const goTo = (next: number) => {
    setFading(true);
    setTimeout(() => { setIdx(next); setFading(false); }, 200);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vista previa · App</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">Carrusel en tiempo real</p>
      </div>

      {/* Phone mockup */}
      <div className="flex justify-center">
        <div
          className="rounded-[28px] border-2 border-[rgba(212,175,55,0.2)] shadow-2xl overflow-hidden"
          style={{ width: 256, background: "#0B0B0B" }}
        >
          {/* Status bar */}
          <div className="px-5 pt-3 pb-1 flex justify-between items-center">
            <span className="text-[7px] text-[#555] font-semibold">9:41</span>
            <div className="w-10 h-2 bg-[#111] rounded-full" />
            <div className="flex gap-0.5 items-center">
              <div className="w-2 h-1.5 bg-[#444] rounded-[1px]" />
              <div className="w-1.5 h-1.5 bg-[#444] rounded-sm" />
              <div className="w-2 h-1.5 bg-[#444] rounded-[1px]" />
            </div>
          </div>

          {/* App header */}
          <div className="px-4 py-2 flex items-center justify-between">
            <div>
              <div className="text-[9px] font-black text-[#D4AF37] tracking-widest">AMT PÁDEL</div>
              <div className="text-[6.5px] text-[#444] mt-0.5">¡Hola, Usuario!</div>
            </div>
            <div className="w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#282828]" />
          </div>

          {/* Stats strip */}
          <div className="mx-4 mb-3 bg-[#141414] border border-[#1e1e1e] rounded-lg flex justify-around py-2">
            {["#3", "1.240", "12", "CM"].map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[7.5px] font-bold text-[#D4AF37]">{v}</span>
                <span className="text-[5.5px] text-[#3a3a3a] uppercase tracking-wider">···</span>
              </div>
            ))}
          </div>

          {/* Sponsor label */}
          <div className="px-4 mb-1.5 flex items-center justify-between">
            <span className="text-[6.5px] text-[#3a3a3a] uppercase tracking-widest font-bold">Patrocinadores</span>
            {slides.length > 1 && (
              <span className="text-[6px] text-[#3a3a3a]">{safeIdx + 1}/{slides.length}</span>
            )}
          </div>

          {/* Banner slide */}
          <div className="mx-4 rounded-xl overflow-hidden relative" style={{ height: 86 }}>
            <div
              className="w-full h-full relative"
              style={{ transition: "opacity 0.2s ease", opacity: fading ? 0 : 1 }}
            >
              {slide?.imageUrl ? (
                <Image
                  src={slide.imageUrl}
                  alt={slide.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#141414] border border-[#1e1e1e] flex flex-col items-center justify-center gap-1">
                  <span className="text-[9px] font-bold text-[#D4AF37] text-center px-3 leading-snug">{slide?.name}</span>
                  {slide?.tagline && (
                    <span className="text-[7px] text-[#444] text-center px-3 leading-snug">{slide.tagline}</span>
                  )}
                </div>
              )}
              {slide?.imageUrl && (slide.name || slide.tagline) && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-5">
                  <p className="text-[7.5px] font-bold text-white leading-tight">{slide.name}</p>
                  {slide.tagline && <p className="text-[6px] text-white/60 mt-0.5">{slide.tagline}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-1 py-2.5">
            {slides.length > 1 ? slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="rounded-full transition-all duration-300 focus:outline-none"
                style={{ width: i === safeIdx ? 10 : 4, height: 4, backgroundColor: i === safeIdx ? "#D4AF37" : "#2a2a2a" }}
              />
            )) : (
              <div className="w-2.5 h-1 rounded-full bg-[#D4AF37]" />
            )}
          </div>

          {/* Bottom placeholders */}
          <div className="px-4 pb-4 space-y-1.5">
            <div className="h-2 bg-[#141414] rounded w-28" />
            <div className="h-9 bg-[#141414] rounded-lg" />
            <div className="h-9 bg-[#141414] rounded-lg" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="bg-[rgba(212,175,55,0.05)] border border-[rgba(212,175,55,0.12)] rounded-lg p-3 space-y-1">
        <p className="text-[10px] font-semibold text-[#D4AF37]">
          {slides.length} patrocinador{slides.length !== 1 ? "es" : ""} en el carrusel
        </p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Tu banner ocupa la posición{" "}
          <span className="text-foreground font-medium">{previewPos}</span>.
          El orden se ajusta desde la tabla principal.
        </p>
      </div>
    </div>
  );
}

// ── SponsorModal ───────────────────────────────────────────────────────────

interface ModalState { open: boolean; editing?: Sponsor }

const EMPTY_FORM = {
  name: "", imageUrl: "", websiteUrl: "", tagline: "",
  scope: "TOURNAMENT" as SponsorScope,
  tournamentId: "", autonomousCommunity: "", displayOrder: 0, active: true,
  validFrom: "", validUntil: "",
};
type FormState = typeof EMPTY_FORM;

function SponsorModal({
  state, onClose, tournaments,
}: {
  state:       ModalState;
  onClose:     () => void;
  tournaments: { id: string; name: string }[];
}) {
  const qc        = useQueryClient();
  const isEditing = !!state.editing;

  const [form, setForm] = useState<FormState>(() =>
    state.editing
      ? {
          name:         state.editing.name,
          imageUrl:     state.editing.imageUrl    ?? "",
          websiteUrl:   state.editing.websiteUrl  ?? "",
          tagline:             state.editing.tagline             ?? "",
          scope:               state.editing.scope,
          tournamentId:        state.editing.tournamentId        ?? "",
          autonomousCommunity: state.editing.autonomousCommunity ?? "",
          displayOrder:        state.editing.displayOrder,
          active:       state.editing.active,
          validFrom:    state.editing.validFrom  ? state.editing.validFrom.slice(0, 10)  : "",
          validUntil:   state.editing.validUntil ? state.editing.validUntil.slice(0, 10) : "",
        }
      : EMPTY_FORM,
  );

  const set = (key: keyof FormState, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name:         form.name.trim(),
        imageUrl:     form.imageUrl.trim()   || undefined,
        websiteUrl:   form.websiteUrl.trim() || undefined,
        tagline:             form.tagline.trim()            || undefined,
        scope:               form.scope,
        tournamentId:        form.scope === "TOURNAMENT" ? (form.tournamentId || undefined)        : undefined,
        autonomousCommunity: form.scope === "REGIONAL"   ? (form.autonomousCommunity || undefined) : undefined,
        displayOrder:        Number(form.displayOrder),
        active:       form.active,
        validFrom:    form.validFrom  || undefined,
        validUntil:   form.validUntil || undefined,
      };
      return isEditing
        ? adminService.sponsors.update(state.editing!.id, payload)
        : adminService.sponsors.create(payload as Omit<Sponsor, "id" | "createdAt" | "tournament" | "clickCount">);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sponsors"] });
      toast.success(isEditing ? "Patrocinador actualizado" : "Patrocinador creado");
      onClose();
    },
    onError: () => toast.error("Error al guardar el patrocinador"),
  });

  const allSponsors  = (qc.getQueryData<Sponsor[]>(["sponsors"]) ?? []).filter((s) => s.active);
  const previewPeers = allSponsors.filter((s) => s.scope === form.scope);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-[880px] shadow-2xl flex flex-col max-h-[calc(100vh-48px)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="font-heading font-semibold text-foreground">
            {isEditing ? "Editar patrocinador" : "Nuevo patrocinador"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
        </div>

        {/* Body: 2-column */}
        <div className="grid grid-cols-[280px_1fr] flex-1 overflow-hidden">
          {/* Left: live preview */}
          <div className="bg-secondary/20 border-r border-border px-5 py-5 overflow-y-auto">
            <CarouselPreview
              peers={previewPeers}
              editingId={state.editing?.id}
              formName={form.name}
              formImageUrl={form.imageUrl}
              formTagline={form.tagline}
            />
          </div>

          {/* Right: form */}
          <div className="p-6 space-y-4 overflow-y-auto">
          {/* Scope selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">Alcance</label>
            <div className="grid grid-cols-3 gap-2">
              {(["CIRCUIT", "TOURNAMENT", "REGIONAL"] as SponsorScope[]).map((s) => {
                const cfg  = SCOPE_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <button
                    key={s}
                    type="button"
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

          {/* Imagen */}
          <ImageUploader
            url={form.imageUrl}
            onUrl={(v) => set("imageUrl", v)}
          />

          {/* Website */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">URL destino <span className="opacity-60">(al hacer tap en el banner)</span></label>
            <input
              value={form.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
              placeholder="https://raquetasgarcia.com"
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
            />
          </div>

          {/* Torneo (solo TOURNAMENT) */}
          {form.scope === "TOURNAMENT" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Torneo <span className="opacity-60">(opcional)</span></label>
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

          {/* Comunidad Autónoma (solo REGIONAL) */}
          {form.scope === "REGIONAL" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Comunidad Autónoma</label>
              <select
                value={form.autonomousCommunity}
                onChange={(e) => set("autonomousCommunity", e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              >
                <option value="">— Selecciona CCAA —</option>
                {AUTONOMOUS_COMMUNITIES.map((ccaa) => (
                  <option key={ccaa} value={ccaa}>{ccaa}</option>
                ))}
              </select>
            </div>
          )}

          {/* Validez */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Válido desde <span className="opacity-60">(opcional)</span></label>
              <input
                type="date"
                value={form.validFrom}
                onChange={(e) => set("validFrom", e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Válido hasta <span className="opacity-60">(opcional)</span></label>
              <input
                type="date"
                value={form.validUntil}
                onChange={(e) => set("validUntil", e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-[rgba(212,175,55,0.5)] transition-colors"
              />
            </div>
          </div>

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
                type="button"
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
        </div>{/* end grid */}

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
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

// ── SortableSponsorRow ──────────────────────────────────────────────────────

function SortableSponsorRow({
  sponsor, onEdit, onDelete, onToggle,
}: {
  sponsor:  Sponsor;
  onEdit:   (s: Sponsor) => void;
  onDelete: (s: Sponsor) => void;
  onToggle: (s: Sponsor) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sponsor.id });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    position:   isDragging ? "relative" : undefined,
    zIndex:     isDragging ? 10 : undefined,
  };

  return (
    <tr ref={setNodeRef} style={style} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors group">
      {/* Patrocinador */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
            title="Arrastrar para reordenar"
          >
            <GripVertical size={14} />
          </button>
          <ImagePreview url={sponsor.imageUrl} name={sponsor.name} />
          <div>
            <p className="text-sm font-medium text-foreground">{sponsor.name}</p>
            {sponsor.tagline && <p className="text-[11px] text-muted-foreground mt-0.5">{sponsor.tagline}</p>}
          </div>
        </div>
      </td>
      {/* Alcance */}
      <td className="px-4 py-3">
        <ScopeBadge scope={sponsor.scope} />
        {sponsor.scope === "TOURNAMENT" && sponsor.tournament && (
          <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[120px]">{sponsor.tournament.name}</p>
        )}
        {sponsor.scope === "REGIONAL" && sponsor.autonomousCommunity && (
          <p className="text-[10px] text-muted-foreground mt-1">{sponsor.autonomousCommunity}</p>
        )}
      </td>
      {/* Enlace */}
      <td className="px-4 py-3">
        {sponsor.websiteUrl ? (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-[#D4AF37] hover:underline"
          >
            <ExternalLink size={10} />
            <span className="truncate max-w-[100px]">{sponsor.websiteUrl.replace(/^https?:\/\//, "")}</span>
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">—</span>
        )}
      </td>
      {/* Clics */}
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center gap-1 text-xs tabular-nums ${(sponsor.clickCount ?? 0) > 0 ? "text-[#D4AF37]" : "text-muted-foreground/40"}`}>
          {(sponsor.clickCount ?? 0) > 0 && <MousePointerClick size={10} />}
          {sponsor.clickCount ?? 0}
        </span>
      </td>
      {/* Estado */}
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
      {/* Acciones */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 sm:gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
          <button
            onClick={() => onEdit(sponsor)}
            className="p-2 sm:p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(sponsor)}
            className="p-2 sm:p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors"
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => adminService.sponsors.reorder(ids),
    onMutate: async (ids: string[]) => {
      await qc.cancelQueries({ queryKey: ["sponsors"] });
      const previous = qc.getQueryData<Sponsor[]>(["sponsors"]);
      qc.setQueryData<Sponsor[]>(["sponsors"], (old = []) => {
        const byId = Object.fromEntries(old.map((s) => [s.id, s]));
        const reordered = ids.map((id, i) => byId[id] ? { ...byId[id], displayOrder: i } : null).filter(Boolean) as Sponsor[];
        const rest = old.filter((s) => !ids.includes(s.id));
        return [...reordered, ...rest];
      });
      return { previous };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.previous) qc.setQueryData(["sponsors"], ctx.previous);
      toast.error("Error al reordenar");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["sponsors"] }),
  });

  const filtered = activeTab === "ALL" ? sponsors : sponsors.filter((s) => s.scope === activeTab);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex((s) => s.id === active.id);
    const newIndex = filtered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filtered, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map((s) => s.id));
  };

  const counts: Record<string, number> = {
    ALL:        sponsors.length,
    CIRCUIT:    sponsors.filter((s) => s.scope === "CIRCUIT").length,
    TOURNAMENT: sponsors.filter((s) => s.scope === "TOURNAMENT").length,
    REGIONAL:   sponsors.filter((s) => s.scope === "REGIONAL").length,
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Patrocinadores" />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1 bg-secondary/60 rounded-lg p-1 border border-border overflow-x-auto no-scrollbar">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Patrocinador", "Alcance", "Enlace", "Clics", "Estado", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <SortableContext items={filtered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <tbody>
                      {filtered.map((sponsor) => (
                        <SortableSponsorRow
                          key={sponsor.id}
                          sponsor={sponsor}
                          onEdit={(s)   => setModal({ open: true, editing: s })}
                          onDelete={(s) => setDeleting(s)}
                          onToggle={(s) => toggleMutation.mutate(s)}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </div>
            </DndContext>
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
              ¿Eliminar <span className="text-foreground font-medium">&quot;{deleting.name}&quot;</span>? Esta acción no se puede deshacer.
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
