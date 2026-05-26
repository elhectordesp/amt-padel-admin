import type { Metadata } from "next";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export const metadata: Metadata = {
  title:       "Ranking · AMT Pádel",
  description: "Ranking SPA oficial del Circuito AMT Pádel. Consulta la clasificación de todos los jugadores por categoría.",
  openGraph: {
    title:       "Ranking · AMT Pádel",
    description: "Clasificación oficial del Circuito AMT Pádel",
    type:        "website",
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const CATEGORY_LABEL: Record<string, string> = {
  "1a": "1ª", "2a": "2ª", "3a": "3ª", "4a": "4ª",
  "5a": "5ª", "6a": "6ª", iniciacion: "Iniciación",
};

const LEVEL_COLOR: Record<string, string> = {
  "1a": "#D4AF37", "2a": "#C0C0C0", "3a": "#CD7F32",
  "4a": "#4CAF50", "5a": "#2196F3", "6a": "#9C27B0",
  iniciacion: "#607D8B",
};

async function getPublicRanking(gender: string) {
  try {
    const res = await fetch(`${API_URL}/ranking/public?gender=${gender}&type=spa&limit=100`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data ?? []);
  } catch {
    return [];
  }
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up")   return <TrendingUp   size={12} className="text-green-400" />;
  if (trend === "down") return <TrendingDown  size={12} className="text-red-400" />;
  return <Minus size={12} className="text-zinc-600" />;
}

function RankingTable({ players }: { players: any[] }) {
  if (players.length === 0) {
    return <p className="text-center text-zinc-500 py-12 text-sm">Sin datos disponibles</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-500 text-[11px] uppercase tracking-wider">
            <th className="px-4 py-3 text-left w-10">#</th>
            <th className="px-4 py-3 text-left">Jugador</th>
            <th className="px-4 py-3 text-center">Cat.</th>
            <th className="px-4 py-3 text-center">SPA</th>
            <th className="px-4 py-3 text-center">PJ</th>
            <th className="px-4 py-3 text-center">PG</th>
            <th className="px-4 py-3 text-center w-8"></th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const color = LEVEL_COLOR[p.level ?? p.categoryLevel] ?? "#D4AF37";
            const spa   = p.spaPoints != null ? Math.round(Number(p.spaPoints)) : null;
            const rank  = p.globalRank ?? i + 1;
            return (
              <tr
                key={p.id}
                className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${rank <= 3 ? "text-[#D4AF37]" : "text-zinc-500"}`}>
                    {rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/player/${p.id}`}
                    className="font-medium text-white hover:text-[#D4AF37] transition-colors"
                  >
                    {p.name}
                  </Link>
                  {p.partner && (
                    <span className="block text-xs text-zinc-500">{p.partner}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    style={{ color, borderColor: color + "66", backgroundColor: color + "22" }}
                  >
                    {CATEGORY_LABEL[p.level ?? p.categoryLevel] ?? p.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-mono font-semibold text-[#D4AF37]">
                  {spa ?? "—"}
                </td>
                <td className="px-4 py-3 text-center text-zinc-400">{p.played ?? "—"}</td>
                <td className="px-4 py-3 text-center text-zinc-400">{p.wins ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <TrendIcon trend={p.trend ?? "stable"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PublicRankingPage() {
  const [masc, fem] = await Promise.all([
    getPublicRanking("M"),
    getPublicRanking("F"),
  ]);

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <Link href="/" className="font-serif text-2xl text-[#D4AF37] tracking-widest font-bold">AMT</Link>
        <div className="w-px h-5 bg-zinc-700" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Circuito de Pádel</span>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        <div>
          <h1 className="font-serif text-3xl font-bold text-white">Ranking SPA</h1>
          <p className="text-sm text-zinc-400 mt-1">Clasificación oficial del Circuito AMT Pádel · Temporada {new Date().getFullYear()}</p>
        </div>

        <div className="space-y-8">
          {/* Masculino */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">Masculino</span>
              <span className="text-xs text-zinc-600">({masc.length} jugadores)</span>
            </div>
            <RankingTable players={masc} />
          </div>

          {/* Femenino */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-800">
              <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37]">Femenino</span>
              <span className="text-xs text-zinc-600">({fem.length} jugadoras)</span>
            </div>
            <RankingTable players={fem} />
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 pt-4">
          Actualizado cada 5 minutos · <span className="text-[#D4AF37]">AMT Pádel</span>
        </p>
      </main>
    </div>
  );
}
