"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Pencil, Power, PowerOff, Globe, AtSign,
  MapPin, Phone, Mail, Image as ImageIcon, Loader2, Trophy,
  Star, Trash2, LayoutGrid, X, ChevronUp, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { Club, Court } from "@/types";

// ── CourtsPanel ────────────────────────────────────────────────────────────

const SURFACES = ["CLAY", "GRASS", "HARD", "ARTIFICIAL"];
const SURFACE_LABEL: Record<string, string> = {
  CLAY: "Tierra", GRASS: "Hierba", HARD: "Dura", ARTIFICIAL: "Artificial",
};

const EMPTY_COURT = { name: "", surface: "", isIndoor: false, isCentral: false, order: 0 };
type CourtForm = typeof EMPTY_COURT;

function CourtRow({
  court, clubId, onEdited,
}: {
  court: Court;
  clubId: string;
  onEdited: () => void;
}) {
  const qc      = useQueryClient();
  const [edit, setEdit]   = useState(false);
  const [form, setForm]   = useState<CourtForm>({
    name:      court.name,
    surface:   court.surface ?? "",
    isIndoor:  court.isIndoor,
    isCentral: court.isCentral,
    order:     court.order,
  });

  const save = useMutation({
    mutationFn: () => adminService.courts.update(clubId, court.id, {
      name:      form.name.trim() || undefined,
      surface:   form.surface    || undefined,
      isIndoor:  form.isIndoor,
      isCentral: form.isCentral,
      order:     form.order,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-courts", clubId] }); setEdit(false); onEdited(); toast.success("Pista actualizada"); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => adminService.courts.remove(clubId, court.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["admin-courts", clubId] }); toast.success("Pista eliminada"); },
    onError:    (e: Error) => toast.error(e.message),
  });

  if (edit) {
    return (
      <div className="border border-[#D4AF37]/30 rounded-lg p-3 space-y-2 bg-[rgba(212,175,55,0.04)]">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nombre pista"
            className="col-span-2 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
          />
          <select
            value={form.surface}
            onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value }))}
            className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none"
          >
            <option value="">Sin superficie</option>
            {SURFACES.map((s) => <option key={s} value={s}>{SURFACE_LABEL[s]}</option>)}
          </select>
          <input
            type="number" min={0}
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))}
            placeholder="Orden"
            className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.isIndoor} onChange={(e) => setForm((f) => ({ ...f, isIndoor: e.target.checked }))} className="accent-[#D4AF37]" />
            Cubierta
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={form.isCentral} onChange={(e) => setForm((f) => ({ ...f, isCentral: e.target.checked }))} className="accent-[#D4AF37]" />
            Pista Central
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => setEdit(false)} className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground">Cancelar</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-3 py-1 text-xs rounded bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center gap-1"
          >
            {save.isPending && <Loader2 size={11} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-border/80 bg-card group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {court.isCentral && <Star size={11} className="text-[#D4AF37] fill-[#D4AF37] shrink-0" />}
          <span className="text-sm font-medium truncate">{court.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          {court.surface && <span>{SURFACE_LABEL[court.surface] ?? court.surface}</span>}
          {court.isIndoor && <span>· Cubierta</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => setEdit(true)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
          <Pencil size={12} />
        </button>
        <button
          onClick={() => { if (confirm(`¿Eliminar "${court.name}"?`)) remove.mutate(); }}
          disabled={remove.isPending}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        >
          {remove.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
    </div>
  );
}

function CourtsPanel({ club, onClose }: { club: Club; onClose: () => void }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState<CourtForm>({ ...EMPTY_COURT });

  const { data: courts = [], isLoading } = useQuery({
    queryKey: ["admin-courts", club.id],
    queryFn:  () => adminService.courts.list(club.id),
  });

  const create = useMutation({
    mutationFn: () => adminService.courts.create(club.id, {
      name:      newForm.name.trim(),
      surface:   newForm.surface || undefined,
      isIndoor:  newForm.isIndoor,
      isCentral: newForm.isCentral,
      order:     newForm.order,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-courts", club.id] });
      setNewForm({ ...EMPTY_COURT });
      setShowAdd(false);
      toast.success("Pista creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!newForm.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <LayoutGrid size={16} className="text-[#D4AF37]" />
            <h2 className="font-heading text-base">Pistas — {club.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Court list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : courts.length === 0 && !showAdd ? (
            <div className="text-center py-8 space-y-2">
              <LayoutGrid size={28} className="mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No hay pistas registradas.</p>
            </div>
          ) : (
            courts.map((c) => (
              <CourtRow key={c.id} court={c} clubId={club.id} onEdited={() => {}} />
            ))
          )}

          {/* New court inline form */}
          {showAdd && (
            <div className="border border-[#D4AF37]/40 rounded-lg p-3 space-y-2 bg-[rgba(212,175,55,0.04)]">
              <p className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wide">Nueva pista</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newForm.name}
                  onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre *"
                  className="col-span-2 h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
                <select
                  value={newForm.surface}
                  onChange={(e) => setNewForm((f) => ({ ...f, surface: e.target.value }))}
                  className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none"
                >
                  <option value="">Sin superficie</option>
                  {SURFACES.map((s) => <option key={s} value={s}>{SURFACE_LABEL[s]}</option>)}
                </select>
                <input
                  type="number" min={0}
                  value={newForm.order}
                  onChange={(e) => setNewForm((f) => ({ ...f, order: Number(e.target.value) }))}
                  placeholder="Orden"
                  className="h-8 rounded border border-border bg-background px-2 text-sm focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={newForm.isIndoor} onChange={(e) => setNewForm((f) => ({ ...f, isIndoor: e.target.checked }))} className="accent-[#D4AF37]" />
                  Cubierta
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={newForm.isCentral} onChange={(e) => setNewForm((f) => ({ ...f, isCentral: e.target.checked }))} className="accent-[#D4AF37]" />
                  Pista Central
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => { setShowAdd(false); setNewForm({ ...EMPTY_COURT }); }} className="px-3 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground">
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={create.isPending}
                  className="px-3 py-1 text-xs rounded bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center gap-1"
                >
                  {create.isPending && <Loader2 size={11} className="animate-spin" />} Crear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded-md border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-[#D4AF37]/50 transition-colors"
            >
              <Plus size={14} /> Añadir pista
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ClubModal ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "", city: "", address: "", phone: "", website: "",
  instagram: "", logoUrl: "", contactEmail: "", isAmtPartner: true,
};
type FormState = typeof EMPTY_FORM & { isAmtPartner: boolean };

function ClubModal({
  club, onClose,
}: {
  club?: Club;
  onClose: () => void;
}) {
  const qc        = useQueryClient();
  const isEditing = !!club;

  const [form, setForm] = useState<FormState>(() =>
    club
      ? {
          name:         club.name,
          city:         club.city,
          address:      club.address      ?? "",
          phone:        club.phone        ?? "",
          website:      club.website      ?? "",
          instagram:    club.instagram    ?? "",
          logoUrl:      club.logoUrl      ?? "",
          contactEmail: club.contactEmail ?? "",
          isAmtPartner: club.isAmtPartner ?? true,
        }
      : { ...EMPTY_FORM }
  );

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name:         form.name.trim(),
        city:         form.city.trim(),
        address:      form.address.trim()      || undefined,
        phone:        form.phone.trim()        || undefined,
        website:      form.website.trim()      || undefined,
        instagram:    form.instagram.trim()    || undefined,
        logoUrl:      form.logoUrl.trim()      || undefined,
        contactEmail: form.contactEmail.trim() || undefined,
        isAmtPartner: form.isAmtPartner,
      };
      return isEditing
        ? adminService.clubs.update(club!.id, payload)
        : adminService.clubs.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clubs"] });
      toast.success(isEditing ? "Club actualizado" : "Club creado");
      onClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg">
            {isEditing ? "Editar club" : "Nuevo club"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name + City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Nombre <span className="text-destructive">*</span>
              </span>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Club Padel Pozuelo"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Ciudad <span className="text-destructive">*</span>
              </span>
              <input
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Madrid"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </label>
          </div>

          {/* Address */}
          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin size={11} /> Dirección
            </span>
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Calle Ejemplo 12, 28001 Madrid"
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </label>

          {/* Phone + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Phone size={11} /> Teléfono
              </span>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Mail size={11} /> Email contacto
              </span>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => set("contactEmail", e.target.value)}
                placeholder="info@clubejemplo.com"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </label>
          </div>

          {/* Website + Instagram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Globe size={11} /> Web
              </span>
              <input
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://clubejemplo.com"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <AtSign size={11} /> Instagram
              </span>
              <input
                value={form.instagram}
                onChange={(e) => set("instagram", e.target.value)}
                placeholder="@clubejemplo"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
            </label>
          </div>

          {/* Logo URL */}
          <label className="space-y-1.5 block">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <ImageIcon size={11} /> URL del logo
            </span>
            <input
              value={form.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="https://..."
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
          </label>

          {/* Partner toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isAmtPartner ? "bg-[#D4AF37]" : "bg-secondary"}`}
              onClick={() => set("isAmtPartner", !form.isAmtPartner)}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isAmtPartner ? "translate-x-5" : "translate-x-0"}`}
              />
            </div>
            <span className="text-sm text-foreground">Club asociado AMT</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              className="px-5 py-2 text-sm rounded-md bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227] disabled:opacity-50 flex items-center gap-2"
            >
              {save.isPending && <Loader2 size={14} className="animate-spin" />}
              {isEditing ? "Guardar cambios" : "Crear club"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── ClubCard ───────────────────────────────────────────────────────────────

function ClubCard({ club, onEdit, onCourts }: { club: Club; onEdit: (c: Club) => void; onCourts: (c: Club) => void }) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: () =>
      club.active
        ? adminService.clubs.deactivate(club.id)
        : adminService.clubs.update(club.id, { active: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-clubs"] });
      toast.success(club.active ? "Club desactivado" : "Club activado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`bg-card border rounded-lg p-5 space-y-3 transition-opacity ${!club.active ? "opacity-50" : ""}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {club.logoUrl ? (
            <img
              src={club.logoUrl}
              alt={club.name}
              className="w-10 h-10 rounded-lg object-contain bg-secondary border border-border p-1 shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{club.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin size={10} /> {club.city}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {club.isAmtPartner && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.12)] border border-[rgba(212,175,55,0.3)] text-[#D4AF37]">
              AMT
            </span>
          )}
          <button
            onClick={() => onCourts(club)}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Gestionar pistas"
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => onEdit(club)}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
            title={club.active ? "Desactivar" : "Activar"}
          >
            {toggle.isPending
              ? <Loader2 size={13} className="animate-spin" />
              : club.active
                ? <Power size={13} className="text-green-400" />
                : <PowerOff size={13} className="text-destructive" />
            }
          </button>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {club.address && (
          <p className="flex items-center gap-1.5 truncate">
            <MapPin size={10} className="shrink-0" /> {club.address}
          </p>
        )}
        {club.phone && (
          <p className="flex items-center gap-1.5">
            <Phone size={10} className="shrink-0" /> {club.phone}
          </p>
        )}
        {(club.website || club.instagram) && (
          <div className="flex items-center gap-3">
            {club.website && (
              <a href={club.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                <Globe size={10} /> Web
              </a>
            )}
            {club.instagram && (
              <a href={`https://instagram.com/${club.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                <AtSign size={10} /> {club.instagram}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Tournament count */}
      {(club.tournamentCount ?? 0) > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-border">
          <Trophy size={9} /> {club.tournamentCount} torneo{club.tournamentCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ClubesPage() {
  const [modal,        setModal]        = useState<{ open: boolean; club?: Club }>({ open: false });
  const [courtsClub,   setCourtsClub]   = useState<Club | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const { data: clubs = [], isLoading } = useQuery({
    queryKey:  ["admin-clubs", showInactive],
    queryFn:   () => adminService.clubs.list(showInactive),
  });

  const active   = clubs.filter((c) => c.active !== false);
  const inactive = clubs.filter((c) => c.active === false);
  const displayed = showInactive ? clubs : active;

  return (
    <>
      {modal.open && (
        <ClubModal
          club={modal.club}
          onClose={() => setModal({ open: false })}
        />
      )}
      {courtsClub && (
        <CourtsPanel
          club={courtsClub}
          onClose={() => setCourtsClub(null)}
        />
      )}

      <Header title="Clubes" />

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {active.length} club{active.length !== 1 ? "s" : ""} activo{active.length !== 1 ? "s" : ""}
              {inactive.length > 0 && ` · ${inactive.length} inactivo${inactive.length !== 1 ? "s" : ""}`}
            </p>
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {showInactive ? "Ocultar inactivos" : "Ver inactivos"}
            </button>
          </div>
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-[#D4AF37] text-[#0C0C0C] font-semibold hover:bg-[#C9A227]"
          >
            <Plus size={15} /> Nuevo club
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Building2 size={36} className="mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No hay clubes registrados todavía.</p>
            <button
              onClick={() => setModal({ open: true })}
              className="text-[#D4AF37] text-sm hover:underline"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                onEdit={(c) => setModal({ open: true, club: c })}
                onCourts={(c) => setCourtsClub(c)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
