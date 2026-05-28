"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Pencil, Power, PowerOff, Globe, Instagram,
  MapPin, Phone, Mail, Image as ImageIcon, Loader2, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import type { Club } from "@/types";

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
                <Instagram size={11} /> Instagram
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

function ClubCard({ club, onEdit }: { club: Club; onEdit: (c: Club) => void }) {
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
                <Instagram size={10} /> {club.instagram}
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
  const [modal, setModal] = useState<{ open: boolean; club?: Club }>({ open: false });
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

      <Header title="Clubes" />

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {active.length} club{active.length !== 1 ? "s" : ""} activo{active.length !== 1 ? "s" : ""}
              {inactive.length > 0 && ` · ${inactive.length} inactivo${inactive.length !== 1 ? "s" : ""}`}
            </p>
            {inactive.length > 0 && (
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                {showInactive ? "Ocultar inactivos" : "Ver inactivos"}
              </button>
            )}
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
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
