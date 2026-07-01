/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trophy, Users, Calendar } from "lucide-react";
import { formatDateRange } from "@/lib/utils/formatDateRange";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª", "4a": "4ª",
  "5a": "5ª", "6a": "6ª", iniciacion: "Iniciación",
};
const TIER_COLOR: Record<string, string> = {
  PLATINUM: "#E5E4E2", GOLD: "#D4AF37", SILVER: "#C0C0C0", BRONZE: "#CD7F32",
};

// Rondas de la eliminatoria, en orden, con etiqueta amable.
const BRACKET_ROUNDS: { key: string; label: string }[] = [
  { key: "r32", label: "Dieciseisavos" },
  { key: "r16", label: "Octavos" },
  { key: "qf", label: "Cuartos" },
  { key: "sf", label: "Semifinales" },
  { key: "final", label: "Final" },
];

type BracketMatch = {
  id: string;
  team1: string[];
  team2: string[];
  sets1: number[];
  sets2: number[];
  isWalkover: boolean;
  winner: "team1" | "team2" | null;
  status: "finished" | "scheduled" | "pending";
};

function scoreText(m: BracketMatch): string {
  if (m.isWalkover) return "W.O.";
  if (m.sets1?.length) return m.sets1.map((s, i) => `${s}-${m.sets2[i]}`).join("  ");
  return "vs";
}

function MatchCard({ m }: { m: BracketMatch }) {
  const t1 = m.team1?.join(" / ") || "Por definir";
  const t2 = m.team2?.join(" / ") || "Por definir";
  const undef1 = !m.team1?.length;
  const undef2 = !m.team2?.length;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5 w-[210px] shrink-0">
      <div className={`flex items-center justify-between gap-2 ${m.winner === "team1" ? "text-white font-semibold" : undef1 ? "text-zinc-600 italic" : "text-zinc-300"}`}>
        <span className="truncate text-xs">{t1}</span>
        {m.winner === "team1" && <span className="text-[#D4AF37] text-xs">✓</span>}
      </div>
      <div className="text-[10px] text-zinc-600 font-mono text-center py-1">{scoreText(m)}</div>
      <div className={`flex items-center justify-between gap-2 ${m.winner === "team2" ? "text-white font-semibold" : undef2 ? "text-zinc-600 italic" : "text-zinc-300"}`}>
        <span className="truncate text-xs">{t2}</span>
        {m.winner === "team2" && <span className="text-[#D4AF37] text-xs">✓</span>}
      </div>
    </div>
  );
}
async function getTournament(id: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}/public`, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

async function getGroups(tournamentId: string, categoryId: string) {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/categories/${categoryId}/groups/public`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? json;
}

async function getBracket(tournamentId: string, categoryId: string) {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/categories/${categoryId}/bracket/public`, { next: { revalidate: 30 } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const t = await getTournament(params.id);
  if (!t) return { title: "Torneo · AMT Pádel" };
  return {
    title: `${t.name} · AMT Pádel`,
    description: `Sigue en directo el cuadro de ${t.name}. Grupos, resultados y clasificación.`,
    openGraph: { title: `${t.name} · AMT Pádel` },
  };
}

export default async function TorneoPublicoPage({ params }: { params: { id: string } }) {
  const tournament = await getTournament(params.id);
  if (!tournament) notFound();

  const tierColor = TIER_COLOR[tournament.tier] ?? "#D4AF37";
  const categories = tournament.categories ?? [];

  // Cargar grupos + eliminatoria de todas las categorías en paralelo
  const dataByCategory = await Promise.all(
    categories.map(async (cat: any) => {
      const [groups, bracket] = await Promise.all([
        getGroups(params.id, cat.id),
        getBracket(params.id, cat.id),
      ]);
      return { cat, groups, bracket };
    })
  );

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <span className="font-serif text-2xl font-bold tracking-widest" style={{ color: tierColor }}>AMT</span>
        <div className="w-px h-5 bg-zinc-700" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Modo Espectador</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400">En directo</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-10 space-y-10">

        {/* Info del torneo */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded border" style={{ color: tierColor, borderColor: tierColor + "66", backgroundColor: tierColor + "11" }}>
              {tournament.tier}
            </span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">{tournament.status}</span>
          </div>
          <h1 className="text-3xl font-serif font-bold">{tournament.name}</h1>
          <div className="flex items-center gap-5 text-sm text-zinc-400 flex-wrap">
            <span className="flex items-center gap-1.5"><Calendar size={14} />{formatDateRange(tournament.startDate, tournament.endDate)}</span>
            <span className="flex items-center gap-1.5"><Trophy size={14} />{tournament.club?.name ?? ""}</span>
            {tournament.prize && <span className="text-[#D4AF37] font-semibold">{tournament.prize}</span>}
          </div>
        </div>

        {/* Categorías con grupos */}
        {dataByCategory.map(({ cat, groups, bracket }) => (
          <div key={cat.id} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <Users size={15} className="text-zinc-500" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-300">
                {cat.gender === "M" ? "Masculino" : "Femenino"} · {CATEGORY_LABEL[cat.level] ?? cat.level}
              </h2>
              <span className="text-xs text-zinc-600 ml-auto">{cat.registeredCount}/{cat.totalSpots} inscritos</span>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-6">Cuadro pendiente de generación</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {groups.map((group: any) => (
                  <div key={group.id} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-800/50">
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{group.name}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800">
                            {["Pareja", "PJ", "PG", "Sets", "Juegos", "Pts"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-zinc-600 font-semibold last:text-right">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(group.members ?? []).sort((a: any, b: any) => b.points - a.points || (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost)).map((m: any, i: number) => (
                            <tr key={m.userId} className={`border-b border-zinc-800/50 last:border-0 ${i < 2 ? "bg-[rgba(212,175,55,0.04)]" : ""}`}>
                              <td className="px-3 py-2.5 font-medium text-white max-w-[140px] truncate">
                                {i < 2 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D4AF37] mr-1.5 align-middle" />}
                                {m.playerName ?? "—"}
                                {m.partnerName && <span className="text-zinc-500"> / {m.partnerName}</span>}
                              </td>
                              <td className="px-3 py-2.5 text-zinc-400">{m.played}</td>
                              <td className="px-3 py-2.5 text-zinc-400">{m.wins}</td>
                              <td className="px-3 py-2.5 text-zinc-400">{m.setsWon}-{m.setsLost}</td>
                              <td className="px-3 py-2.5 text-zinc-400">{m.gamesWon}-{m.gamesLost}</td>
                              <td className="px-3 py-2.5 text-right font-bold" style={{ color: i < 2 ? "#D4AF37" : "#fff" }}>{m.points}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Partidos del grupo */}
                    {(group.matches ?? []).length > 0 && (
                      <div className="border-t border-zinc-800 divide-y divide-zinc-800/50">
                        {group.matches.filter((m: any) => m.status === "FINISHED").map((match: any) => {
                          const t1 = match.players?.filter((p: any) => p.team === 1).map((p: any) => p.userName).join(" / ");
                          const t2 = match.players?.filter((p: any) => p.team === 2).map((p: any) => p.userName).join(" / ");
                          const score = match.sets?.map((s: any) => `${s.score1}-${s.score2}`).join(" ");
                          return (
                            <div key={match.id} className="px-4 py-2 flex items-center gap-2 text-xs">
                              <span className={`flex-1 truncate ${match.winnerTeam === 1 ? "text-white font-semibold" : "text-zinc-500"}`}>{t1}</span>
                              <span className="text-zinc-600 text-[10px] font-mono">{score}</span>
                              <span className={`flex-1 truncate text-right ${match.winnerTeam === 2 ? "text-white font-semibold" : "text-zinc-500"}`}>{t2}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Eliminatoria */}
            {bracket && BRACKET_ROUNDS.some((r) => (bracket[r.key]?.length ?? 0) > 0) && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                  <Trophy size={15} className="text-zinc-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-300">Eliminatoria</h3>
                  {bracket.champion?.length ? (
                    <span className="ml-auto text-xs text-[#D4AF37] font-semibold flex items-center gap-1">
                      🏆 {bracket.champion.join(" / ")}
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {BRACKET_ROUNDS.filter((r) => (bracket[r.key]?.length ?? 0) > 0).map((r) => (
                    <div key={r.key} className="space-y-2 flex flex-col justify-around">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-center">{r.label}</p>
                      {bracket[r.key].map((m: BracketMatch) => <MatchCard key={m.id} m={m} />)}
                    </div>
                  ))}
                </div>

                {(bracket.consolation?.length ?? 0) > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Consolación</p>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                      {bracket.consolation.map((round: BracketMatch[], idx: number) => (
                        <div key={idx} className="space-y-2">
                          <p className="text-[10px] text-zinc-600 text-center">Ronda {idx + 1}</p>
                          {round.map((m) => <MatchCard key={m.id} m={m} />)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <p className="text-center text-xs text-zinc-700 pt-4">
          Resultados actualizados automáticamente · <span style={{ color: TIER_COLOR[tournament.tier] ?? "#D4AF37" }}>AMT Pádel</span>
        </p>
      </main>
    </div>
  );
}
