/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, Users, Calendar, MapPin, Clock, ListTree } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª", "4a": "4ª", "5a": "5ª", "6a": "6ª", iniciacion: "Iniciación",
};
const TIER_COLOR: Record<string, string> = {
  PLATINUM: "#E5E4E2", GOLD: "#D4AF37", SILVER: "#C0C0C0", BRONZE: "#CD7F32",
};
const BRACKET_ROUNDS: { key: string; label: string }[] = [
  { key: "r32", label: "Dieciseisavos" },
  { key: "r16", label: "Octavos" },
  { key: "qf", label: "Cuartos" },
  { key: "sf", label: "Semifinales" },
  { key: "final", label: "Final" },
];

async function fetchJson(url: string) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    return d.data ?? d;
  } catch {
    return null;
  }
}

const catName = (c: any) => `${c.gender === "M" ? "Masculino" : "Femenino"} · ${CATEGORY_LABEL[c.level] ?? c.level}`;
const pairLabel = (arr?: string[]) => (arr && arr.length ? arr.join(" / ") : "Por definir");

function scoreOf(m: any): string {
  if (m.isWalkover) return "W.O.";
  const s1 = m.sets1 ?? (m.sets ? m.sets.map((s: any) => s.score1) : []);
  const s2 = m.sets2 ?? (m.sets ? m.sets.map((s: any) => s.score2) : []);
  if (s1?.length) return s1.map((s: number, i: number) => `${s}-${s2[i]}`).join("  ");
  return "";
}

// ── Tarjeta de partido del cuadro ────────────────────────────────────────────
function BracketCard({ m }: { m: any }) {
  const undef1 = !m.team1?.length;
  const undef2 = !m.team2?.length;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-3 w-[230px] shrink-0">
      <div className={`flex items-center justify-between gap-2 ${m.winner === "team1" ? "text-white font-bold" : undef1 ? "text-zinc-600 italic" : "text-zinc-300"}`}>
        <span className="truncate text-sm">{pairLabel(m.team1)}</span>
        {m.winner === "team1" && <span className="text-[#D4AF37]">✓</span>}
      </div>
      <div className="text-sm text-zinc-500 font-mono text-center py-1.5 tracking-wide">{scoreOf(m) || "vs"}</div>
      <div className={`flex items-center justify-between gap-2 ${m.winner === "team2" ? "text-white font-bold" : undef2 ? "text-zinc-600 italic" : "text-zinc-300"}`}>
        <span className="truncate text-sm">{pairLabel(m.team2)}</span>
        {m.winner === "team2" && <span className="text-[#D4AF37]">✓</span>}
      </div>
    </div>
  );
}

export default function TournamentViewer({
  tournamentId,
  tournament,
  initialCats,
  initialMatches,
}: {
  tournamentId: string;
  tournament: any;
  initialCats: { cat: any; groups: any[]; bracket: any }[];
  initialMatches: any[];
}) {
  const [cats, setCats] = useState(initialCats);
  const [matches, setMatches] = useState(initialMatches);
  const [activeCatId, setActiveCatId] = useState<string>(initialCats[0]?.cat.id ?? "");
  const [secs, setSecs] = useState(0);

  const categories = useMemo(() => initialCats.map((c) => c.cat), [initialCats]);
  const tierColor = TIER_COLOR[tournament.tier] ?? "#D4AF37";

  const refresh = useCallback(async () => {
    const [ms, ...perCat] = await Promise.all([
      fetchJson(`${API_URL}/tournaments/${tournamentId}/matches/public`),
      ...categories.map(async (c: any) => ({
        cat: c,
        groups: (await fetchJson(`${API_URL}/tournaments/${tournamentId}/categories/${c.id}/groups/public`)) ?? [],
        bracket: await fetchJson(`${API_URL}/tournaments/${tournamentId}/categories/${c.id}/bracket/public`),
      })),
    ]);
    if (ms) setMatches(ms.matches ?? ms ?? []);
    setCats(perCat);
    setSecs(0);
  }, [tournamentId, categories]);

  useEffect(() => {
    const tick = setInterval(() => setSecs((s) => s + 1), 1000);
    const poll = setInterval(refresh, 30000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [refresh]);

  const active = cats.find((c) => c.cat.id === activeCatId) ?? cats[0];
  const bracket = active?.bracket;
  const hasBracket = bracket && BRACKET_ROUNDS.some((r) => (bracket[r.key]?.length ?? 0) > 0);

  // Partidos de la categoría activa, agrupados por fase (para el calendario)
  const catMatches = (matches ?? []).filter((m: any) => m.categoryId === active?.cat.id);
  const byPhase = useMemo(() => {
    const groupsMap = new Map<string, { label: string; order: number; items: any[] }>();
    for (const m of catMatches) {
      const key = m.phase;
      if (!groupsMap.has(key)) groupsMap.set(key, { label: m.phaseLabel ?? m.phase, order: m.phaseOrder ?? 99, items: [] });
      groupsMap.get(key)!.items.push(m);
    }
    return [...groupsMap.values()].sort((a, b) => a.order - b.order);
  }, [catMatches]);

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3 sticky top-0 bg-[#0C0C0C]/95 backdrop-blur z-10">
        <span className="font-serif text-2xl font-bold tracking-widest" style={{ color: tierColor }}>AMT</span>
        <div className="w-px h-5 bg-zinc-700" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest hidden sm:inline">Modo Espectador</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400">En directo</span>
          <span className="text-[10px] text-zinc-600 hidden sm:inline">· actualizado hace {secs}s</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Info del torneo */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded border" style={{ color: tierColor, borderColor: tierColor + "66", backgroundColor: tierColor + "11" }}>{tournament.tier}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-widest">{tournament.status}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold">{tournament.name}</h1>
          <div className="flex items-center gap-5 text-sm text-zinc-400 flex-wrap">
            {tournament.club?.name && <span className="flex items-center gap-1.5"><Trophy size={14} />{tournament.club.name}</span>}
            {tournament.prize && <span className="text-[#D4AF37] font-semibold">{tournament.prize}</span>}
          </div>
        </div>

        {/* Tabs de categoría */}
        {categories.length > 1 && (
          <div className="flex gap-2 flex-wrap border-b border-zinc-800 pb-3">
            {categories.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setActiveCatId(c.id)}
                className={`text-sm font-semibold rounded-full px-4 py-1.5 border transition-colors ${
                  active?.cat.id === c.id
                    ? "border-[#D4AF37] text-[#0C0C0C] bg-[#D4AF37]"
                    : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500"
                }`}
              >
                {catName(c)}
              </button>
            ))}
          </div>
        )}

        {active && (
          <div className="space-y-10">
            {categories.length === 1 && (
              <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                <Users size={15} className="text-zinc-500" /> {catName(active.cat)}
              </h2>
            )}

            {/* ── GRUPOS / CLASIFICACIÓN ── */}
            {(active.groups?.length ?? 0) > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><ListTree size={14} /> Clasificación de grupos</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {active.groups.map((g: any) => (
                    <div key={g.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-800/40">
                        <span className="text-sm font-bold uppercase tracking-widest text-zinc-300">{g.label}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-600">
                            <th className="px-3 py-2 text-left font-semibold">Pareja</th>
                            <th className="px-2 py-2 text-center font-semibold w-8">PJ</th>
                            <th className="px-2 py-2 text-center font-semibold w-8">PG</th>
                            <th className="px-2 py-2 text-center font-semibold w-14">Sets</th>
                            <th className="px-2 py-2 text-center font-semibold w-14">Juegos</th>
                            <th className="px-3 py-2 text-right font-semibold w-10">Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(g.rows ?? []).map((m: any, i: number) => {
                            const qualifies = i < (g.qualifyCount ?? 2);
                            return (
                              <tr key={m.userId ?? i} className={`border-b border-zinc-800/50 last:border-0 ${qualifies ? "bg-[rgba(212,175,55,0.06)]" : ""}`}>
                                <td className="px-3 py-2.5 font-medium text-white max-w-[190px] truncate">
                                  <span className={`inline-block w-5 text-center mr-1.5 font-bold ${qualifies ? "text-[#D4AF37]" : "text-zinc-600"}`}>{i + 1}</span>
                                  {m.name ?? "—"}
                                </td>
                                <td className="px-2 py-2.5 text-center text-zinc-400">{m.played}</td>
                                <td className="px-2 py-2.5 text-center text-zinc-400">{m.wins}</td>
                                <td className="px-2 py-2.5 text-center text-zinc-400">{m.setsWon}-{m.setsLost}</td>
                                <td className="px-2 py-2.5 text-center text-zinc-400">{m.gamesWon}-{m.gamesLost}</td>
                                <td className="px-3 py-2.5 text-right font-bold" style={{ color: qualifies ? "#D4AF37" : "#fff" }}>{m.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── ELIMINATORIA ── */}
            {hasBracket && (
              <section className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Trophy size={14} /> Eliminatoria</h3>
                  {bracket.champion?.length ? (
                    <span className="text-sm text-[#D4AF37] font-bold flex items-center gap-1">🏆 Campeón: {bracket.champion.join(" / ")}</span>
                  ) : null}
                </div>
                <div className="flex gap-5 overflow-x-auto pb-2">
                  {BRACKET_ROUNDS.filter((r) => (bracket[r.key]?.length ?? 0) > 0).map((r) => (
                    <div key={r.key} className="space-y-3 flex flex-col justify-around">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 text-center">{r.label}</p>
                      {bracket[r.key].map((m: any) => <BracketCard key={m.id} m={m} />)}
                    </div>
                  ))}
                </div>
                {(bracket.consolation?.length ?? 0) > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-600">Consolación</p>
                    <div className="flex gap-5 overflow-x-auto pb-2">
                      {bracket.consolation.map((round: any[], idx: number) => (
                        <div key={idx} className="space-y-3">
                          <p className="text-[11px] text-zinc-600 text-center">Ronda {idx + 1}</p>
                          {round.map((m: any) => <BracketCard key={m.id} m={m} />)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── CALENDARIO / PARTIDOS (hora + pista + resultado) ── */}
            {catMatches.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Calendar size={14} /> Partidos, horarios y pistas</h3>
                <div className="space-y-5 max-w-2xl">
                  {byPhase.map((ph) => (
                    <div key={ph.label} className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-600">{ph.label}</p>
                      <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/60 overflow-hidden">
                        {ph.items.map((m: any) => {
                          const finished = m.status === "FINISHED";
                          const when = m.date ? new Date(m.date).toLocaleString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
                          return (
                            <div key={m.id} className="px-4 py-2.5 grid items-center gap-2 text-sm" style={{ gridTemplateColumns: "1fr 130px 1fr" }}>
                              <span className={`truncate text-right ${m.winnerTeam === 1 ? "text-white font-semibold" : "text-zinc-300"}`}>{pairLabel(m.team1)}</span>
                              <span className="text-center">
                                {finished ? (
                                  <span className="font-mono text-zinc-300">{scoreOf(m) || "—"}</span>
                                ) : when ? (
                                  <span className="text-[11px] text-[#D4AF37] flex flex-col items-center leading-tight gap-0.5">
                                    <span className="flex items-center gap-1"><Clock size={10} /> {when}</span>
                                    {m.court && <span className="text-zinc-500 flex items-center gap-1"><MapPin size={10} /> {m.court}</span>}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-zinc-600 italic">sin horario</span>
                                )}
                              </span>
                              <span className={`truncate text-left ${m.winnerTeam === 2 ? "text-white font-semibold" : "text-zinc-300"}`}>{pairLabel(m.team2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <p className="text-center text-xs text-zinc-700 pt-6">
          Resultados actualizados automáticamente · <span style={{ color: tierColor }}>AMT Pádel</span>
        </p>
      </main>
    </div>
  );
}
