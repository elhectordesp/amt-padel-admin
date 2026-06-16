"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const POLL_INTERVAL_MS = 10_000;

const TIER_COLOR: Record<string, string> = {
  PLATINUM: "#E5E4E2", GOLD: "#D4AF37", SILVER: "#C0C0C0", BRONZE: "#CD7F32",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "BORRADOR", OPEN: "INSCRIPCIONES", DRAW: "SORTEO",
  SCHEDULED: "PROGRAMADO", ONGOING: "EN CURSO", FINISHED: "FINALIZADO", CANCELLED: "CANCELADO",
};

// ── Types ─────────────────────────────────────────────────────────────────

interface LiveMatch {
  id:            string;
  phase:         string;
  round?:        number | null;
  phaseLabel:    string;
  phaseOrder:    number;
  categoryId?:   string;
  gender?:       string;
  level?:        string;
  categoryLabel?:string;
  status:        string;
  team1:         string[];
  team2:         string[];
  sets:          { score1: number; score2: number }[];
  winnerTeam?:   number | null;
  date?:         string | null;
  court?:        string | null;
  isWalkover:    boolean;
}

interface LiveData {
  tournament: {
    id:     string;
    name:   string;
    status: string;
    club:   { name: string };
    tier:   string;
  };
  matches: LiveMatch[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatScore(sets: { score1: number; score2: number }[]): string {
  if (!sets.length) return "";
  return sets.map((s) => `${s.score1}–${s.score2}`).join("  ");
}

function groupMatchesBySection(matches: LiveMatch[]) {
  const sections = new Map<string, { phaseLabel: string; categoryLabel: string; phaseOrder: number; matches: LiveMatch[] }>();
  const sorted = [...matches].sort((a, b) => {
    const phaseD = (a.phaseOrder ?? 99) - (b.phaseOrder ?? 99);
    if (phaseD !== 0) return phaseD;
    const genderD = (a.gender ?? "").localeCompare(b.gender ?? "");
    if (genderD !== 0) return genderD;
    return (a.level ?? "").localeCompare(b.level ?? "");
  });

  for (const m of sorted) {
    const key = m.phase === "CONSOLATION"
      ? `${m.phase}::r${m.round ?? 1}::${m.categoryId ?? ""}`
      : `${m.phase}::${m.categoryId ?? ""}`;
    if (!sections.has(key)) {
      sections.set(key, {
        phaseLabel:    m.phaseLabel,
        categoryLabel: m.categoryLabel ?? "",
        phaseOrder:    m.phaseOrder ?? 99,
        matches:       [],
      });
    }
    sections.get(key)!.matches.push(m);
  }
  return [...sections.values()];
}

// ── Sub-components ────────────────────────────────────────────────────────

function MatchRow({ match, tierColor }: { match: LiveMatch; tierColor: string }) {
  const isFinished = match.status === "FINISHED";
  const isOngoing  = match.status === "ONGOING";

  const team1Wins = match.winnerTeam === 1;
  const team2Wins = match.winnerTeam === 2;
  const score     = formatScore(match.sets);

  return (
    <div
      className={`flex items-center py-5 px-6 gap-4 border-b border-zinc-800/70 last:border-0 transition-all ${
        isOngoing ? "bg-[rgba(212,175,55,0.03)]" : ""
      }`}
    >
      {/* Status dot */}
      <div className="w-6 shrink-0 flex justify-center">
        {isOngoing && <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: tierColor }} />}
        {isFinished && <div className="w-2 h-2 rounded-full bg-zinc-600" />}
        {!isOngoing && !isFinished && <div className="w-2 h-2 rounded-full bg-zinc-800" />}
      </div>

      {/* Team 1 */}
      <div className={`flex-1 text-right ${team1Wins ? "text-white" : isFinished ? "text-zinc-500" : "text-zinc-300"}`}>
        <span className={`font-bold leading-tight ${team1Wins ? "text-2xl" : "text-xl"}`}>
          {match.isWalkover && team1Wins ? "WO" : (match.team1.join(" / ") || "—")}
        </span>
        {team1Wins && !match.isWalkover && (
          <span className="ml-2 text-sm font-bold" style={{ color: tierColor }}>✓</span>
        )}
      </div>

      {/* Score / VS */}
      <div className="w-36 shrink-0 text-center">
        {isFinished && score ? (
          <span className="font-mono text-xl font-bold text-zinc-200 tracking-widest tabular-nums">
            {score}
          </span>
        ) : isOngoing ? (
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: tierColor }}>
            En juego
          </span>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-zinc-600 text-base font-bold">VS</span>
            {match.court && (
              <span className="text-[10px] text-zinc-700 uppercase tracking-wider">{match.court}</span>
            )}
          </div>
        )}
      </div>

      {/* Team 2 */}
      <div className={`flex-1 ${team2Wins ? "text-white" : isFinished ? "text-zinc-500" : "text-zinc-300"}`}>
        {team2Wins && !match.isWalkover && (
          <span className="mr-2 text-sm font-bold" style={{ color: tierColor }}>✓</span>
        )}
        <span className={`font-bold leading-tight ${team2Wins ? "text-2xl" : "text-xl"}`}>
          {match.isWalkover && team2Wins ? "WO" : (match.team2.join(" / ") || "—")}
        </span>
      </div>

      {/* Court (right side) */}
      <div className="w-6 shrink-0" />
    </div>
  );
}

function SectionBlock({
  phaseLabel, categoryLabel, matches, tierColor,
}: {
  phaseLabel: string; categoryLabel: string; matches: LiveMatch[]; tierColor: string;
}) {
  const finished = matches.filter((m) => m.status === "FINISHED").length;
  const ongoing  = matches.filter((m) => m.status === "ONGOING").length;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div
        className="flex items-center gap-4 px-6 py-3 border-b"
        style={{ borderColor: tierColor + "33", backgroundColor: tierColor + "0A" }}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[3px] text-zinc-500">{phaseLabel}</p>
          {categoryLabel && (
            <p className="text-lg font-bold text-white mt-0.5">{categoryLabel}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          {ongoing > 0 && (
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: tierColor }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: tierColor }} />
              {ongoing} en juego
            </span>
          )}
          <span>{finished}/{matches.length} finalizados</span>
        </div>
      </div>

      {/* Matches */}
      <div>
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} tierColor={tierColor} />
        ))}
      </div>
    </div>
  );
}

// ── Clock ─────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-3xl font-bold text-zinc-200 tabular-nums">{time}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function LiveWidgetPage() {
  const params = useParams<{ id: string }>();
  const id     = params?.id ?? "";

  const [data,        setData]        = useState<LiveData | null>(null);
  const [error,       setError]       = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secsAgo,     setSecsAgo]     = useState(0);
  const lastUpdatedRef                = useRef<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/tournaments/${id}/matches/public`, { cache: "no-store" });
      if (!res.ok) { setError(true); return; }
      const json = await res.json();
      const body = json.data ?? json;
      if (!body?.tournament) { setError(true); return; }
      setData(body);
      setError(false);
      const now = new Date();
      setLastUpdated(now);
      lastUpdatedRef.current = now;
      setSecsAgo(0);
    } catch {
      setError(true);
    }
  }, [id]);

  // Initial fetch + polling
  useEffect(() => {
    if (!id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const poll = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [id, fetchData]);

  // "X seconds ago" counter
  useEffect(() => {
    const id = setInterval(() => {
      if (!lastUpdatedRef.current) return;
      const diff = Math.floor((Date.now() - lastUpdatedRef.current.getTime()) / 1000);
      setSecsAgo(diff);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-zinc-500 text-lg">Torneo no encontrado o sin partidos disponibles</p>
          <p className="text-zinc-700 text-sm font-mono">{API_URL}/tournaments/{id}/matches/public</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-[#D4AF37] rounded-full animate-spin" />
          <p className="text-zinc-600 text-sm">Cargando resultados…</p>
        </div>
      </div>
    );
  }

  const { tournament, matches } = data;
  const tierColor  = TIER_COLOR[tournament.tier] ?? "#D4AF37";
  const sections   = groupMatchesBySection(matches);
  const hasOngoing = matches.some((m) => m.status === "ONGOING");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/80" style={{ backgroundColor: "#0D0D0D" }}>
        {/* AMT Brand */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-3xl font-black tracking-[8px]" style={{ color: tierColor }}>AMT</p>
            <p className="text-[9px] tracking-[3px] text-zinc-600 uppercase mt-0.5">Circuito Pádel</p>
          </div>
          <div className="w-px h-10 bg-zinc-800" />
          <div>
            <p className="text-sm text-zinc-500 uppercase tracking-[2px]">En Directo</p>
            <p className="text-xl font-bold text-white leading-tight mt-0.5">{tournament.name}</p>
          </div>
        </div>

        {/* Center: live indicator */}
        <div className="flex flex-col items-center gap-1">
          {hasOngoing ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border" style={{ borderColor: tierColor + "55", backgroundColor: tierColor + "11" }}>
              <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: tierColor }} />
              <span className="text-sm font-bold uppercase tracking-widest" style={{ color: tierColor }}>LIVE</span>
            </div>
          ) : (
            <span
              className="text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-500"
            >
              {STATUS_LABEL[tournament.status] ?? tournament.status}
            </span>
          )}
          <p className="text-[10px] text-zinc-700">{tournament.club?.name ?? ""}</p>
        </div>

        {/* Right: clock */}
        <div className="text-right">
          <LiveClock />
          <p className="text-[10px] text-zinc-700 mt-1 tabular-nums">
            {lastUpdated
              ? secsAgo < 5 ? "Actualizado ahora" : `Hace ${secsAgo}s`
              : "Conectando…"}
          </p>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto">
        {matches.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-zinc-600 text-xl">Sin partidos disponibles</p>
          </div>
        ) : (
          <div className="py-4">
            {sections.map((section, i) => (
              <SectionBlock
                key={i}
                phaseLabel={section.phaseLabel}
                categoryLabel={section.categoryLabel}
                matches={section.matches}
                tierColor={tierColor}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="flex items-center justify-between px-8 py-3 border-t border-zinc-800/50">
        <p className="text-zinc-700 text-xs">
          amtpadel.com
        </p>
        <p className="text-zinc-700 text-xs">
          Actualización automática cada 10 segundos
        </p>
        <p className="text-zinc-700 text-xs">
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </footer>
    </div>
  );
}
