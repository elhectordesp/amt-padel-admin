"use client";

import { useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronLeft, MapPin, Mail, Phone, Trophy,
  TrendingUp, TrendingDown, Minus, X, Loader2, BarChart3, History, Zap,
  Edit2, Trash2, Send, ShieldCheck, Clock, AlertCircle, Activity, MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { CustomSelect } from "@/components/admin/form";
import type { CategoryLevel, CategoryChange, UpdatePlayerPayload, Gender, PlayerRegistrationEntry, AuditLogEntry } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª",
  "4a": "4ª", "5a": "5ª", "6a": "6ª", "iniciacion": "Iniciación",
};
const LEVELS: CategoryLevel[] = ["1a","2a","3a","4a","5a","6a","iniciacion"];

const LEVEL_COLOR: Record<string, string> = {
  "1a":"#D4AF37","2a":"#C084FC","3a":"#60A5FA",
  "4a":"#34D399","5a":"#A78BFA","6a":"#FB923C","iniciacion":"#94A3B8",
};

const changeCatSchema = z.object({
  level:  z.string().min(1, "Selecciona una categoría"),
  reason: z.string().min(5, "Añade una razón (mínimo 5 caracteres)"),
});
type ChangeCatForm = z.infer<typeof changeCatSchema>;

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center py-4 border-r border-border last:border-0">
      <p className="text-2xl font-heading text-[#D4AF37]">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function JugadorDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();
  const [showCatModal,  setShowCatModal]  = useState(false);
  const [showEdit,      setShowEdit]      = useState(false);
  const [showDelete,    setShowDelete]    = useState(false);
  const [editForm,      setEditForm]      = useState<UpdatePlayerPayload>({});

  const { data: player, isLoading } = useQuery({
    queryKey: ["player", id],
    queryFn:  () => adminService.players.detail(id),
  });

  const { data: catHistory = [] } = useQuery({
    queryKey: ["player-cat-history", id],
    queryFn:  () => adminService.players.categoryHistory(id),
  });

  const { data: playerRegs = [] } = useQuery({
    queryKey: ["player-registrations", id],
    queryFn:  () => adminService.players.registrations(id),
  });

  const { data: playerAudit = [] } = useQuery({
    queryKey: ["player-audit", id],
    queryFn:  () => adminService.players.auditLog(id),
  });

  const catForm  = useForm<ChangeCatForm>({ resolver: zodResolver(changeCatSchema) });

  const editMutation = useMutation({
    mutationFn: (data: UpdatePlayerPayload) => adminService.players.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player", id] });
      qc.invalidateQueries({ queryKey: ["admin-players"] });
      toast.success("Datos del jugador actualizados");
      setShowEdit(false);
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al actualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminService.players.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-players"] });
      toast.success("Jugador eliminado");
      router.push("/jugadores");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al eliminar"),
  });

  const resendMutation = useMutation({
    mutationFn: () => adminService.players.resendInvite(id),
    onSuccess: () => toast.success("Invitación reenviada"),
    onError:   (err: Error) => toast.error(err.message ?? "Error al reenviar"),
  });

  const inviteLinkMutation = useMutation({
    mutationFn: () => adminService.players.getInviteLink(id),
    onSuccess: ({ url, name }) => {
      const text = encodeURIComponent(
        `¡Hola ${name}! Te invitamos a unirte a la app AMT Pádel. Activa tu cuenta aquí: ${url}`,
      );
      window.open(`https://wa.me/?text=${text}`, "_blank");
    },
    onError: (err: Error) => toast.error(err.message ?? "Error al generar el enlace"),
  });

  function openEdit() {
    if (!player) return;
    const [firstName = "", ...rest] = player.name.split(" ");
    setEditForm({
      firstName,
      lastName:      rest.join(" "),
      gender:        player.gender,
      email:         player.email  ?? "",
      phone:         player.phone  ?? "",
      city:          player.city   ?? "",
      categoryLevel: player.level,
      bio:           player.bio    ?? "",
    });
    setShowEdit(true);
  }

  const changeCat = useMutation({
    mutationFn: (data: ChangeCatForm) =>
      adminService.players.changeLevel(id, data.level, data.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player", id] });
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["player-cat-history", id] });
      toast.success("Categoría actualizada");
      setShowCatModal(false);
      catForm.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Jugador" />
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-card animate-pulse border border-border" />
          ))}
        </div>
      </div>
    );
  }

  if (!player || !player.name) return null;

  const winRate = player.played > 0 ? Math.round((player.wins / player.played) * 100) : 0;
  const initials = player.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const TrendIcon = player.trend === "up"   ? TrendingUp :
                    player.trend === "down" ? TrendingDown : Minus;
  const trendColor = player.trend === "up" ? "text-green-400" :
                     player.trend === "down" ? "text-destructive" : "text-muted-foreground";
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedLevel = catForm.watch("level") ?? "";

  return (
    <>
      <div className="flex flex-col min-h-full">
        <Header title="Perfil de jugador" />

        <div className="flex-1 p-6 space-y-5 max-w-5xl">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/jugadores" className="hover:text-foreground flex items-center gap-1">
              <ChevronLeft size={14} /> Jugadores
            </Link>
            <span>/</span>
            <span className="text-foreground">{player.name}</span>
          </div>

          {/* Hero card */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-6 flex-wrap">
              {/* Avatar */}
              <div className="relative shrink-0">
                {player.photoUrl
                  ? <Image src={player.photoUrl} alt={player.name} width={80} height={80} unoptimized className="rounded-full object-cover border-2 border-[#D4AF37]" />
                  : (
                    <div className="w-20 h-20 rounded-full bg-[rgba(212,175,55,0.1)] border-2 border-[#D4AF37] flex items-center justify-center">
                      <span className="font-heading text-2xl text-[#D4AF37]">{initials}</span>
                    </div>
                  )
                }
                {player.managedByAdmin ? (
                  <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card flex items-center justify-center ${
                    player.activationStatus === "active"
                      ? "bg-green-500"
                      : player.activationStatus === "invited"
                      ? "bg-yellow-500"
                      : "bg-orange-500"
                  }`}>
                    {player.activationStatus === "active"
                      ? null
                      : player.activationStatus === "invited"
                      ? <Clock size={10} className="text-black" />
                      : <AlertCircle size={10} className="text-black" />
                    }
                  </div>
                ) : (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-card" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-heading text-xl text-foreground">{player.name}</h2>
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]">
                    {player.gender === "M" ? "Masc." : "Fem."} {CATEGORY_LABEL[player.level]}
                  </span>
                  {player.managedByAdmin && (() => {
                    const cfg = {
                      pending_invite: { label: "Sin invitar",        cls: "bg-orange-500/10 text-orange-400 border-orange-500/30", Icon: AlertCircle },
                      invited:        { label: "Invitado — pendiente", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30", Icon: Clock       },
                      active:         { label: "Cuenta gestionada",    cls: "bg-blue-500/10 text-blue-400 border-blue-500/30",       Icon: ShieldCheck  },
                    };
                    const s = cfg[player.activationStatus ?? "active"];
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.cls}`}>
                        <s.Icon size={10} /> {s.label}
                      </span>
                    );
                  })()}
                  <div className={`flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon size={14} />
                    <span className="text-xs font-medium capitalize">{player.trend}</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                  {player.city && (
                    <span className="flex items-center gap-1.5"><MapPin size={13} className="text-[#D4AF37]" />{player.city}</span>
                  )}
                  {player.email ? (
                    <span className="flex items-center gap-1.5"><Mail size={13} className="text-[#D4AF37]" />{player.email}</span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-400/10 border-amber-400/30 text-amber-400"
                      title="Sin email: este jugador no puede activar su cuenta ni recibir notificaciones"
                    >
                      <AlertCircle size={10} /> Sin email
                    </span>
                  )}
                  {player.phone && (
                    <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#D4AF37]" />{player.phone}</span>
                  )}
                </div>

                {player.bio && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">{player.bio}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => setShowCatModal(true)}
                  className="px-4 py-2 rounded-md bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.3)] text-sm text-[#D4AF37] font-medium hover:bg-[rgba(212,175,55,0.2)] transition-colors"
                >
                  Cambiar categoría
                </button>
                <button
                  onClick={openEdit}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors"
                >
                  <Edit2 size={13} /> Editar datos
                </button>
                {player.managedByAdmin && player.activationStatus !== "active" && (
                  <>
                    <button
                      onClick={() => resendMutation.mutate()}
                      disabled={resendMutation.isPending}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-muted-foreground hover:text-blue-400 hover:border-blue-400/50 disabled:opacity-50 transition-colors"
                    >
                      {resendMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {player.activationStatus === "pending_invite" ? "Enviar invitación" : "Reenviar invitación"}
                    </button>
                    <button
                      onClick={() => inviteLinkMutation.mutate()}
                      disabled={inviteLinkMutation.isPending}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-muted-foreground hover:text-green-400 hover:border-green-400/50 disabled:opacity-50 transition-colors"
                    >
                      {inviteLinkMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                      Compartir por WhatsApp
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowDelete(true)}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-secondary border border-border text-sm text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                >
                  <Trash2 size={13} /> Eliminar jugador
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-5 pt-5 border-t border-border grid grid-cols-3 sm:grid-cols-6">
              <StatBox label="Puntos AMT"    value={player.points.toLocaleString()} />
              <StatBox label="Partidos"      value={player.played} />
              <StatBox label="% Victorias"   value={`${winRate}%`} sub={`${player.wins} ganados`} />
              <StatBox label="Ranking global"   value={player.globalRank   ? `#${player.globalRank}`   : "—"} sub={player.gender === "M" ? "Masc." : "Fem."} />
              <StatBox label="Ranking categoría" value={player.categoryRank ? `#${player.categoryRank}` : "—"} sub={CATEGORY_LABEL[player.level]} />
            </div>
          </div>

          {/* Partner */}
          {player.partner && (
            <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
              <div className="p-2 rounded-md bg-[rgba(212,175,55,0.1)]">
                <Trophy size={16} className="text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Compañero habitual</p>
                <p className="text-sm font-medium text-foreground">{player.partner}</p>
              </div>
              {player.partnerId && (
                <Link href={`/jugadores/${player.partnerId}`} className="ml-auto text-xs text-[#D4AF37] hover:underline">
                  Ver perfil →
                </Link>
              )}
            </div>
          )}

          {/* Quick stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Victorias",  value: player.wins,              icon: TrendingUp,  color: "text-green-400" },
              { label: "Derrotas",   value: player.played - player.wins, icon: TrendingDown, color: "text-destructive" },
              { label: "% Win",      value: `${winRate}%`,            icon: BarChart3,   color: "text-[#D4AF37]" },
              { label: "Categoría",  value: CATEGORY_LABEL[player.level], icon: Trophy,   color: "text-[#D4AF37]" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
                <div className="p-2 rounded-md bg-secondary">
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className="text-lg font-heading text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* SPA Profile */}
          {player.spa && (
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={15} className="text-[#D4AF37]" />
                <h3 className="text-sm font-semibold text-foreground">Perfil SPA</h3>
                {player.spa.isCalibrating && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/30 text-[10px] font-semibold text-yellow-400">
                    Calibrando
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p
                    className="text-2xl font-heading"
                    style={{ color: LEVEL_COLOR[player.spa.spaLevel] }}
                  >
                    {CATEGORY_LABEL[player.spa.spaLevel]}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Nivel SPA</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-heading text-foreground">{player.spa.spaPoints.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">SPA pts</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-2xl font-heading text-foreground">{player.spa.spaMatches}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Partidos SPA</p>
                </div>
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Progresión</p>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(player.spa.spaProgression / 10) * 100}%`,
                        backgroundColor: LEVEL_COLOR[player.spa.spaLevel],
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {player.spa.spaProgression.toFixed(1)} / 10
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1.5">Fiabilidad</p>
                {(() => {
                  const reliabilityPct = Math.round(player.spa.spaReliability * 100);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${reliabilityPct}%`,
                            backgroundColor: reliabilityPct >= 70 ? "#34D399" : reliabilityPct >= 40 ? "#D4AF37" : "#EF4444",
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10 text-right">
                        {reliabilityPct}%
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tournament registrations */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Trophy size={15} className="text-[#D4AF37]" />
              <h3 className="text-sm font-semibold text-foreground">Torneos</h3>
              {playerRegs.length > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{playerRegs.length} inscripción(es)</span>
              )}
            </div>
            {playerRegs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin inscripciones registradas</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Torneo", "Fecha", "Categoría", "Estado", "Pago"].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(playerRegs as PlayerRegistrationEntry[]).map((r) => {
                      const STATUS_CFG: Record<string, { label: string; cls: string }> = {
                        CONFIRMED: { label: "Confirmado", cls: "text-green-400 bg-green-400/10 border-green-400/30" },
                        PENDING:   { label: "Pendiente",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
                        WAITLIST:  { label: "En espera",  cls: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
                        CANCELLED: { label: "Cancelado",  cls: "text-red-400 bg-red-400/10 border-red-400/30" },
                      };
                      const scfg = STATUS_CFG[r.status] ?? STATUS_CFG.PENDING;
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3 text-xs text-foreground max-w-[180px] truncate">{r.tournament}</td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {new Date(r.startDate).toLocaleDateString("es-ES")}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {r.gender} {CATEGORY_LABEL[r.level] ?? r.level}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${scfg.cls}`}>
                              {scfg.label}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium ${r.paid ? "text-green-400" : "text-yellow-400"}`}>
                              {r.paid ? "Pagado" : "Pendiente"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Match history */}
          {player.matches && player.matches.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <BarChart3 size={15} className="text-[#D4AF37]" />
                <h3 className="text-sm font-semibold text-foreground">Historial de partidos</h3>
                <span className="ml-auto text-xs text-muted-foreground">{player.matches.length} partidos</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {["Fecha", "Torneo", "Categoría", "Resultado", ""].map((h) => (
                        <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {player.matches.map((m) => (
                      <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {m.date ? new Date(m.date).toLocaleDateString("es-ES") : "—"}
                        </td>
                        <td className="px-5 py-3 text-xs text-foreground max-w-[160px] truncate">{m.tournament}</td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">{m.category}</td>
                        <td className="px-5 py-3">
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{m.team1.join(" / ")}</span>
                            {m.sets1.length > 0 && (
                              <span className="ml-2 text-[10px]">
                                {m.sets1.map((s, i) => `${s}-${m.sets2[i]}`).join("  ")}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span>{m.team2.join(" / ")}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            m.isWinner
                              ? "text-green-400 bg-green-400/10 border-green-400/30"
                              : "text-red-400 bg-red-400/10 border-red-400/30"
                          }`}>
                            {m.isWinner ? "Victoria" : "Derrota"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin activity timeline */}
          {playerAudit.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Activity size={15} className="text-[#D4AF37]" />
                <h3 className="text-sm font-semibold text-foreground">Actividad admin</h3>
                <span className="ml-auto text-xs text-muted-foreground">{playerAudit.length} acciones</span>
              </div>
              <ul className="divide-y divide-border">
                {(playerAudit as AuditLogEntry[]).map((entry) => (
                  <li key={entry.id} className="flex gap-3 px-5 py-3">
                    <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{entry.action.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.adminName} · {new Date(entry.createdAt).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{entry.resource}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Category change history */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <History size={15} className="text-[#D4AF37]" />
              <h3 className="text-sm font-semibold text-foreground">Historial de categoría</h3>
            </div>
            {catHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin cambios de categoría registrados</p>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    {["Fecha", "De", "A", "Motivo", "Admin"].map((h) => (
                      <th key={h} className="px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(catHistory as CategoryChange[]).map((ch) => (
                    <tr key={ch.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(ch.date).toLocaleDateString("es-ES")}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                          {CATEGORY_LABEL[ch.from]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(212,175,55,0.1)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]">
                          {CATEGORY_LABEL[ch.to]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-w-xs truncate">{ch.reason}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">{ch.adminName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Edit Player Modal ── */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 size={15} className="text-[#D4AF37]" />
                <h2 className="text-sm font-semibold text-foreground">Editar jugador</h2>
              </div>
              <button onClick={() => setShowEdit(false)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                  <input
                    value={editForm.firstName ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Apellidos</label>
                  <input
                    value={editForm.lastName ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Género</label>
                  <div className="flex gap-2">
                    {([["M", "Masculino"], ["F", "Femenino"]] as [Gender, string][]).map(([val, label]) => (
                      <button key={val} type="button"
                        onClick={() => setEditForm((f) => ({ ...f, gender: val }))}
                        className={`flex-1 h-9 rounded-md text-xs font-medium border transition-colors ${
                          editForm.gender === val
                            ? "bg-[rgba(212,175,55,0.15)] border-[rgba(212,175,55,0.4)] text-[#D4AF37]"
                            : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <select
                    value={editForm.categoryLevel ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, categoryLevel: (e.target.value || undefined) as CategoryLevel | undefined }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">Sin asignar</option>
                    {(["1a","2a","3a","4a","5a","6a","iniciacion"] as CategoryLevel[]).map((l) => (
                      <option key={l} value={l}>{CATEGORY_LABEL[l]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={editForm.email ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Teléfono</label>
                  <input
                    value={editForm.phone ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ciudad</label>
                  <input
                    value={editForm.city ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Posición</label>
                  <select
                    value={editForm.position ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, position: (e.target.value || undefined) as UpdatePlayerPayload["position"] }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">No indicado</option>
                    <option value="reves">Revés</option>
                    <option value="drive">Drive</option>
                    <option value="indiferente">Indiferente</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Mano</label>
                  <select
                    value={editForm.hand ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, hand: (e.target.value || undefined) as UpdatePlayerPayload["hand"] }))}
                    className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                  >
                    <option value="">No indicado</option>
                    <option value="diestro">Diestro</option>
                    <option value="zurdo">Zurdo</option>
                    <option value="ambidiestro">Ambidiestro</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Bio</label>
                <textarea
                  rows={3}
                  value={editForm.bio ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowEdit(false)}
                className="px-4 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={editMutation.isPending}
                onClick={() => editMutation.mutate({
                  ...editForm,
                  email: editForm.email?.trim() || undefined,
                  phone: editForm.phone?.trim() || undefined,
                  city:  editForm.city?.trim()  || undefined,
                  bio:   editForm.bio?.trim()   || undefined,
                })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-[#D4AF37] text-black hover:bg-[#C9A227] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Edit2 size={13} />}
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10">
                <Trash2 size={18} className="text-destructive" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Eliminar jugador</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar a <span className="font-medium text-foreground">{player.name}</span>? Se perderán todos sus datos, historial y resultados.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="flex-1 py-2 rounded-md bg-destructive text-white text-sm font-semibold hover:bg-destructive/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
              >
                {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Category Modal ── */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCatModal(false)} />
          <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg text-foreground">Cambiar categoría</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{player.name}</p>
              </div>
              <button onClick={() => setShowCatModal(false)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Current */}
            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border border-border">
              <span className="text-xs text-muted-foreground">Categoría actual</span>
              <span className="ml-auto font-semibold text-sm text-foreground">
                {player.gender === "M" ? "Masc." : "Fem."} {CATEGORY_LABEL[player.level]}
              </span>
            </div>

            <form onSubmit={catForm.handleSubmit((d) => changeCat.mutate(d))} className="space-y-4">
              {/* New level */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nueva categoría</label>
                <CustomSelect
                  value={watchedLevel}
                  onChange={(v) => catForm.setValue("level", v, { shouldValidate: true })}
                  options={[
                    { value: "", label: "Seleccionar categoría..." },
                    ...LEVELS.filter((l) => l !== player.level).map((l) => ({ value: l, label: CATEGORY_LABEL[l] })),
                  ]}
                />
                {catForm.formState.errors.level && (
                  <p className="text-xs text-destructive">{catForm.formState.errors.level.message}</p>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Motivo del cambio</label>
                <textarea
                  {...catForm.register("reason")}
                  rows={3}
                  placeholder="Ej: Solicitud del jugador, resultados consistentes en categoría superior..."
                  className="w-full px-3 py-2 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] resize-none"
                />
                {catForm.formState.errors.reason && (
                  <p className="text-xs text-destructive">{catForm.formState.errors.reason.message}</p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={changeCat.isPending}
                  className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
                >
                  {changeCat.isPending && <Loader2 size={14} className="animate-spin" />}
                  Confirmar cambio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
