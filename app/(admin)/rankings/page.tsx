"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, Loader2,
  Download, ChevronLeft, ChevronRight, BarChart2, Trophy,
} from "lucide-react";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { adminService } from "@/lib/services/admin";
import { CATEGORY_LABEL_SHORT } from "@/lib/constants";
import { downloadCsv } from "@/lib/utils/csv";
import type { CategoryLevel, Gender, Player, RankingType } from "@/types";

const CATEGORY_LABEL = CATEGORY_LABEL_SHORT;
const ALL_LEVELS: CategoryLevel[] = ["1a", "2a", "3a", "4a", "5a", "6a", "iniciacion"];

const LEVEL_COLOR: Record<string, string> = {
  "1a": "#D4AF37", "2a": "#C084FC", "3a": "#60A5FA",
  "4a": "#34D399", "5a": "#A78BFA", "6a": "#FB923C", "iniciacion": "#94A3B8",
};

const PAGE_SIZE    = 20;
const CURRENT_YEAR = new Date().getFullYear();

type CatFilter = "global" | CategoryLevel;

export default function RankingsPage() {
  const qc = useQueryClient();
  const [gender,            setGender]            = useState<Gender>("M");
  const [rankType,          setRankType]          = useState<RankingType>("circuit");
  const [catFilter,         setCatFilter]         = useState<CatFilter>("global");
  const [page,              setPage]              = useState(0);
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);

  // Siempre pedimos todo el ranking global (sin filtro de level) para tener los ranks correctos
  const { data: allPlayers = [], isLoading } = useQuery({
    queryKey: ["ranking-admin", gender, rankType],
    queryFn:  () => adminService.rankings.list(
      gender,
      rankType,
      rankType === "circuit" ? CURRENT_YEAR : undefined,
    ),
  });

  // Derivar tabs disponibles: solo categorías que tengan al menos 1 jugador
  const availableLevels = ALL_LEVELS.filter((lvl) =>
    allPlayers.some((p: Player) => p.level === lvl),
  );

  // Vista actual: global o filtrada por categoría
  const displayPlayers: Player[] = catFilter === "global"
    ? allPlayers
    : allPlayers.filter((p: Player) => p.level === catFilter);

  const pagedPlayers = displayPlayers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleCatChange = (cat: CatFilter) => { setCatFilter(cat); setPage(0); };
  const handleTypeChange = (t: RankingType) => { setRankType(t); setCatFilter("global"); setPage(0); };
  const handleGenderChange = (g: Gender) => { setGender(g); setCatFilter("global"); setPage(0); };

  const recalculate = useMutation({
    mutationFn: adminService.rankings.recalculate,
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["ranking-admin"] });
      toast.success("Ranking recalculado correctamente");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const TREND = {
    up:     { icon: TrendingUp,   color: "text-green-400"       },
    down:   { icon: TrendingDown, color: "text-destructive"      },
    stable: { icon: Minus,        color: "text-muted-foreground" },
  };

  const medalColors = ["text-[#D4AF37]", "text-gray-300", "text-amber-600"];

  // Para el pódium usamos los top 3 de la vista actual
  const top3 = displayPlayers.slice(0, 3);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Rankings" />

      <div className="flex-1 p-6 space-y-5">

        {/* Rank type toggle */}
        <div className="flex items-center gap-2">
          {([
            { key: "circuit", label: `Circuito ${CURRENT_YEAR}`, icon: Trophy   },
            { key: "spa",     label: "Nivel SPA",                icon: BarChart2 },
          ] as { key: RankingType; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => handleTypeChange(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                rankType === key
                  ? "bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border-[rgba(212,175,55,0.4)]"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Gender + controls row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            {([
              { key: "M", label: "Masculino" },
              { key: "F", label: "Femenino"  },
            ] as { key: Gender; label: string }[]).map((g) => (
              <button
                key={g.key}
                onClick={() => handleGenderChange(g.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  gender === g.key
                    ? "bg-[rgba(212,175,55,0.15)] text-[#D4AF37] border border-[rgba(212,175,55,0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCsv(`ranking-${gender}-${catFilter}`, displayPlayers.map((p: Player, i: number) => ({
                "#Global":    p.globalRank   ?? i + 1,
                "#Categoría": p.categoryRank ?? "—",
                Jugador:      p.name,
                Categoría:    CATEGORY_LABEL[p.level],
                Puntos:       p.points,
                "% Victorias": p.played > 0 ? Math.round((p.wins / p.played) * 100) + "%" : "0%",
                Tendencia:    p.trend,
              })))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[#D4AF37] transition-colors"
            >
              <Download size={13} /> Exportar CSV
            </button>
            <button
              onClick={() => setShowRecalcConfirm(true)}
              disabled={recalculate.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] disabled:opacity-60 transition-colors"
            >
              {recalculate.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {recalculate.isPending ? "Recalculando..." : "Recalcular ranking"}
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {([{ key: "global", label: "Global" }, ...availableLevels.map((l) => ({ key: l, label: CATEGORY_LABEL[l] }))] as { key: CatFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleCatChange(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                catFilter === key
                  ? "bg-[rgba(212,175,55,0.12)] text-[#D4AF37] border-[rgba(212,175,55,0.4)]"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {label}
              {key !== "global" && (
                <span className="ml-1 opacity-60">
                  ({allPlayers.filter((p: Player) => p.level === key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Podium top 3 de la vista actual */}
        {!isLoading && top3.length >= 2 && (
          <div className="grid grid-cols-3 gap-4">
            {[top3[1], top3[0], top3[2]].map((p, i) => {
              const pos = i === 0 ? 2 : i === 1 ? 1 : 3;
              const heights = ["h-24", "h-32", "h-20"];
              const colors  = ["border-gray-300 bg-gray-300/5", "border-[#D4AF37] bg-[rgba(212,175,55,0.08)]", "border-amber-600 bg-amber-600/5"];
              if (!p) return <div key={i} />;
              const pts = rankType === "spa"
                ? `${(p.spa?.spaPoints ?? p.points).toFixed(0)} SPA`
                : `${p.points.toLocaleString()} pts`;
              return (
                <div key={p.id} className={`flex flex-col items-center gap-2 p-4 rounded-lg border ${colors[i]}`}>
                  <div className="w-10 h-10 rounded-full bg-[rgba(212,175,55,0.1)] border border-[rgba(212,175,55,0.2)] flex items-center justify-center">
                    <span className="text-xs font-bold text-[#D4AF37]">{p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-semibold text-foreground">{p.name.split(" ")[0]}</p>
                    <p className="text-[10px] text-muted-foreground">{CATEGORY_LABEL[p.level]}</p>
                    <p className="text-[10px] font-medium text-[#D4AF37]">{pts}</p>
                  </div>
                  <div className={`w-full rounded-md flex items-end justify-center ${heights[i]} ${colors[i]}`}>
                    <span className={`text-2xl font-heading ${medalColors[pos - 1]} pb-2`}>#{pos}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Título de vista */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {catFilter === "global"
                ? `Ranking global — ${gender === "M" ? "Masculino" : "Femenino"}`
                : `Ranking ${CATEGORY_LABEL[catFilter as CategoryLevel]}ª — ${gender === "M" ? "Masculino" : "Femenino"}`
              }
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {displayPlayers.length} jugadores
              {catFilter !== "global" && ` · posición en categoría`}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="space-y-0">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border">
                  <div className="h-4 w-6 rounded bg-secondary animate-pulse" />
                  <div className="w-8 h-8 rounded-full bg-secondary animate-pulse" />
                  <div className="h-4 w-36 rounded bg-secondary animate-pulse flex-1" />
                  <div className="h-4 w-20 rounded bg-secondary animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      {(rankType === "spa"
                        ? (catFilter === "global"
                          ? ["#Global", "#Cat.", "Jugador", "Nivel SPA", "SPA pts", "Progresión", ""]
                          : ["#Cat.",   "#Global", "Jugador", "Nivel SPA", "SPA pts", "Progresión", ""])
                        : (catFilter === "global"
                          ? ["#Global", "#Cat.", "Jugador", "Categoría", "Puntos", "Tendencia", ""]
                          : ["#Cat.",   "#Global", "Jugador", "Categoría", "Puntos", "Tendencia", ""])
                      ).map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPlayers.map((player: Player, idx: number) => {
                      const absIdx     = page * PAGE_SIZE + idx;
                      const primRank   = catFilter !== "global" ? (player.categoryRank ?? absIdx + 1) : (player.globalRank ?? absIdx + 1);
                      const secRank    = catFilter !== "global" ? (player.globalRank ?? "—") : (player.categoryRank ?? "—");
                      const trend      = TREND[player.trend as keyof typeof TREND] ?? TREND.stable;
                      const TIcon      = trend.icon;
                      const levelColor = LEVEL_COLOR[player.level] ?? "#94A3B8";

                      return (
                        <tr key={player.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                          {/* Rank principal */}
                          <td className="px-4 py-3.5 w-14">
                            <span className={`text-sm font-bold ${absIdx < 3 && catFilter === "global" ? medalColors[absIdx] : "text-foreground"}`}>
                              #{primRank}
                            </span>
                          </td>
                          {/* Rank secundario */}
                          <td className="px-4 py-3.5 w-14">
                            <span className="text-xs text-muted-foreground">#{secRank}</span>
                          </td>
                          {/* Jugador */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold"
                                style={{ backgroundColor: levelColor + "22", border: `1px solid ${levelColor}55`, color: levelColor }}
                              >
                                {player.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                              </div>
                              <div>
                                <Link href={`/jugadores/${player.id}`} className="text-sm font-medium text-foreground hover:text-[#D4AF37] transition-colors">
                                  {player.name}
                                </Link>
                                {player.partner && (
                                  <p className="text-xs text-muted-foreground">c/ {player.partner}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Columnas variables según tipo */}
                          {rankType === "spa" ? (
                            <>
                              <td className="px-4 py-3.5">
                                {player.spa ? (
                                  <span
                                    className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                    style={{
                                      color: LEVEL_COLOR[player.spa.spaLevel],
                                      backgroundColor: LEVEL_COLOR[player.spa.spaLevel] + "22",
                                      borderColor: LEVEL_COLOR[player.spa.spaLevel] + "55",
                                    }}
                                  >
                                    {CATEGORY_LABEL[player.spa.spaLevel]}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-sm font-bold text-foreground">
                                  {player.spa ? player.spa.spaPoints.toFixed(0) : "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                {player.spa && (
                                  <div className="flex items-center gap-2 w-28">
                                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${(player.spa.spaProgression / 10) * 100}%`,
                                          backgroundColor: LEVEL_COLOR[player.spa.spaLevel],
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">{player.spa.spaProgression.toFixed(1)}</span>
                                  </div>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3.5">
                                <span
                                  className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                                  style={{
                                    color: levelColor,
                                    backgroundColor: levelColor + "18",
                                    borderColor: levelColor + "44",
                                  }}
                                >
                                  {CATEGORY_LABEL[player.level]}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="text-sm font-bold text-foreground">
                                  {(player.points ?? 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                <TIcon size={15} className={trend.color} />
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3.5">
                            <Link href={`/jugadores/${player.id}`} className="text-xs text-[#D4AF37] hover:underline">
                              Ver →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedPlayers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                          Sin jugadores en esta categoría
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {displayPlayers.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, displayPlayers.length)} de {displayPlayers.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 0}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={(page + 1) * PAGE_SIZE >= displayPlayers.length}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={showRecalcConfirm}
        title="Recalcular ranking"
        description="Esta operación recalcula los puntos de circuito y SPA para todos los jugadores. Puede tardar unos segundos. ¿Continuar?"
        confirmLabel="Recalcular"
        onClose={() => setShowRecalcConfirm(false)}
        onConfirm={() => { setShowRecalcConfirm(false); recalculate.mutate(); }}
        loading={recalculate.isPending}
      />
    </div>
  );
}
