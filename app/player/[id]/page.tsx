import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Trophy, TrendingUp, TrendingDown, Minus, Star } from "lucide-react";

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

async function getPlayer(id: string) {
  const res = await fetch(`${API_URL}/players/${id}/profile`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const player = await getPlayer(params.id);
  if (!player) return { title: "Jugador no encontrado · AMT Pádel" };
  return {
    title: `${player.player.name} · AMT Pádel`,
    description: `Perfil de ${player.player.name} en el circuito AMT Pádel. Categoría ${CATEGORY_LABEL[player.player.level] ?? player.player.level}.`,
    openGraph: {
      title: `${player.player.name} · AMT Pádel`,
      images: player.player.photoUrl ? [player.player.photoUrl] : [],
    },
  };
}

export default async function PublicPlayerPage({ params }: { params: { id: string } }) {
  const data = await getPlayer(params.id);
  if (!data) notFound();

  const { player, tournaments } = data;
  const winRate = player.played > 0 ? Math.round((player.wins / player.played) * 100) : 0;
  const spaLevel = player.spa?.spaLevel;
  const levelColor = spaLevel ? (LEVEL_COLOR[spaLevel] ?? "#D4AF37") : "#D4AF37";

  const TrendIcon = player.trend === "up" ? TrendingUp : player.trend === "down" ? TrendingDown : Minus;
  const trendColor = player.trend === "up" ? "text-green-400" : player.trend === "down" ? "text-red-400" : "text-zinc-500";

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      {/* Header AMT */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <span className="font-serif text-2xl text-[#D4AF37] tracking-widest font-bold">AMT</span>
        <div className="w-px h-5 bg-zinc-700" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Circuito de Pádel</span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">

        {/* Perfil */}
        <div className="flex items-center gap-5">
          {player.photoUrl ? (
            <Image src={player.photoUrl} alt={player.name} width={80} height={80} unoptimized className="w-20 h-20 rounded-full object-cover border-2 border-[#D4AF37]" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-[#D4AF37] flex items-center justify-center">
              <span className="text-2xl font-bold text-[#D4AF37]">
                {player.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-serif font-bold">{player.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {spaLevel && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{ color: levelColor, borderColor: levelColor + "66", backgroundColor: levelColor + "22" }}>
                  {CATEGORY_LABEL[spaLevel] ?? spaLevel}
                </span>
              )}
              {player.city && <span className="text-xs text-zinc-500">{player.city}</span>}
              <span className="text-xs text-zinc-500">{player.gender === "M" ? "Masculino" : "Femenino"}</span>
            </div>
            {player.bio && <p className="text-sm text-zinc-400 mt-2 max-w-sm">{player.bio}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Partidos", value: player.played },
            { label: "Victorias", value: player.wins },
            { label: "% victorias", value: `${winRate}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
              <p className="text-xl font-bold text-[#D4AF37]">{value}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* SPA */}
        {player.spa && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star size={15} className="text-[#D4AF37]" />
                <span className="text-sm font-semibold">Rating SPA</span>
              </div>
              <div className={`flex items-center gap-1 ${trendColor}`}>
                <TrendIcon size={13} />
                <span className="text-xs">{player.trend === "up" ? "Subiendo" : player.trend === "down" ? "Bajando" : "Estable"}</span>
              </div>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-serif font-bold" style={{ color: levelColor }}>
                {Number(player.spa.spaPoints).toFixed(0)}
              </span>
              <span className="text-sm text-zinc-400 mb-1">puntos · {player.spa.spaMatches} partidos</span>
            </div>
          </div>
        )}

        {/* Torneos recientes */}
        {tournaments.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Torneos recientes</h2>
            <div className="space-y-2">
              {tournaments.slice(0, 5).map((t: { name: string; categoryDisplay: string; result: string }, i: number) => (
                <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-zinc-500">{t.categoryDisplay}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${t.result.includes("Ganador") || t.result.includes("Final") ? "text-[#D4AF37]" : "text-zinc-400"}`}>
                      {t.result}
                    </span>
                    {(t.result.includes("Ganador") || t.result.includes("Final")) && <Trophy size={13} className="text-[#D4AF37]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 pt-4">
          Perfil generado por <span className="text-[#D4AF37]">AMT Pádel</span>
        </p>
      </main>
    </div>
  );
}
