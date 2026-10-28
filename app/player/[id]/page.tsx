import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { fetchPublicApi } from "@/lib/utils/public-api";
import type { PublicPlayer } from "@/types";

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

// Solo nombre, categoría, SPA y puesto (PublicPlayer): lo que da el back sin
// sesión. Solo un 404 es «no encontrado»: un 429 (límite de peticiones) o un 5xx se
// enseñan como error, para no decir que un jugador que existe no existe
function getPlayer(id: string) {
  return fetchPublicApi<{ player: PublicPlayer }>(`${API_URL}/players/${id}/profile`, {
    next: { revalidate: 300 },
  });
}

// En Next 16 params es una promesa: con params.id (síncrono) llegaba undefined
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const result = await getPlayer(id);
  if (result.kind === "not-found") return { title: "Jugador no encontrado · AMT Pádel" };
  if (result.kind === "error") return { title: "Jugador · AMT Pádel" };
  const { player } = result.data;
  const level = player.level;
  return {
    title: `${player.name} · AMT Pádel`,
    // Un jugador nuevo no tiene categoría (antes la API decía 4ª)
    description: `Perfil de ${player.name} en el circuito AMT Pádel. ${level ? `Categoría ${CATEGORY_LABEL[level] ?? level}` : "Sin categoría"}.`,
    openGraph: { title: `${player.name} · AMT Pádel` },
  };
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0C0C0C] text-white">
      {/* Header AMT */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <span className="font-serif text-2xl text-[#D4AF37] tracking-widest font-bold">AMT</span>
        <div className="w-px h-5 bg-zinc-700" />
        <span className="text-xs text-zinc-500 uppercase tracking-widest">Circuito de Pádel</span>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        {children}
        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 pt-4">
          Perfil generado por <span className="text-[#D4AF37]">AMT Pádel</span>
        </p>
      </main>
    </div>
  );
}

export default async function PublicPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPlayer(id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "error") {
    return (
      <Layout>
        <div role="alert" className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 text-center">
          <p className="text-sm font-semibold">No se ha podido cargar el perfil</p>
          <p className="text-xs text-zinc-500 mt-1">Vuelve a intentarlo en unos minutos.</p>
        </div>
      </Layout>
    );
  }

  const { player } = result.data;
  const spaLevel = player.spa?.spaLevel;
  const levelColor = spaLevel ? (LEVEL_COLOR[spaLevel] ?? "#D4AF37") : "#D4AF37";
  // El distintivo, con su categoría oficial (no la del SPA); un jugador nuevo
  // no tiene: «Sin categoría», como la app
  const category = player.level ?? null;
  const categoryColor = category ? (LEVEL_COLOR[category] ?? "#D4AF37") : "#71717A";
  const initials = player.name.split(" ").map((n) => n[0] ?? "").join("").slice(0, 2);

  return (
    <Layout>
      {/* Perfil */}
      <div className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-zinc-800 border-2 border-[#D4AF37] flex items-center justify-center">
          <span className="text-2xl font-bold text-[#D4AF37]">{initials}</span>
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold">{player.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{ color: categoryColor, borderColor: categoryColor + "66", backgroundColor: categoryColor + "22" }}>
              {category ? (CATEGORY_LABEL[category] ?? category) : "Sin categoría"}
            </span>
            {/* Su puesto en el circuito de la temporada (en su categoría, como
                el «#N Circuito» de la app, y en general) */}
            {player.categoryRank != null && (
              <span className="text-xs text-zinc-500">#{player.categoryRank} Circuito</span>
            )}
            {player.globalRank != null && (
              <span className="text-xs text-zinc-500">· #{player.globalRank} general</span>
            )}
          </div>
        </div>
      </div>

      {/* SPA */}
      {player.spa && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-[#D4AF37]" />
            <span className="text-sm font-semibold">Rating SPA</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-serif font-bold" style={{ color: levelColor }}>
              {Number(player.spa.spaPoints).toFixed(0)}
            </span>
            <span className="text-sm text-zinc-400 mb-1">puntos</span>
          </div>
        </div>
      )}
    </Layout>
  );
}
