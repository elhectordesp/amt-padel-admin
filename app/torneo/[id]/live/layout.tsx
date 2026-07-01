import type { Metadata } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function getTournament(id: string) {
  try {
    const res = await fetch(`${API_URL}/tournaments/${id}/public`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? json;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const t = await getTournament(id);
  if (!t) return { title: "En directo · AMT Pádel" };

  const title       = `${t.name} — En directo · AMT Pádel`;
  const description = `Sigue en tiempo real los resultados de ${t.name}. Marcadores, grupos y clasificación actualizados al momento.`;
  const ogImageUrl  = `${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/torneo/${id}/opengraph-image`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:   "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: t.name }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
      images:      [ogImageUrl],
    },
  };
}

export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
