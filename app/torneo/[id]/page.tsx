/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TournamentViewer from "./viewer";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function getTournament(id: string) {
  const res = await fetch(`${API_URL}/tournaments/${id}/public`, { next: { revalidate: 30 } });
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
async function getMatches(tournamentId: string) {
  const res = await fetch(`${API_URL}/tournaments/${tournamentId}/matches/public`, { next: { revalidate: 30 } });
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data ?? json;
  return data.matches ?? data ?? [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getTournament(id);
  if (!t) return { title: "Torneo · AMT Pádel" };
  return {
    title: `${t.name} · AMT Pádel`,
    description: `Sigue en directo el cuadro de ${t.name}. Grupos, resultados, eliminatorias y horarios.`,
    openGraph: { title: `${t.name} · AMT Pádel` },
  };
}

export default async function TorneoPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournament(id);
  if (!tournament) notFound();

  const categories = tournament.categories ?? [];
  const [initialMatches, ...initialCats] = await Promise.all([
    getMatches(id),
    ...categories.map(async (cat: any) => {
      const [groups, bracket] = await Promise.all([getGroups(id, cat.id), getBracket(id, cat.id)]);
      return { cat, groups, bracket };
    }),
  ]);

  return (
    <TournamentViewer
      tournamentId={id}
      tournament={tournament}
      initialCats={initialCats}
      initialMatches={initialMatches}
    />
  );
}
