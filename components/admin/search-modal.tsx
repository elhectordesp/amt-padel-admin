"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Trophy, Users, X } from "lucide-react";
import { adminService } from "@/lib/services/admin";
import { CATEGORY_LABEL_SHORT, GENDER_LABEL } from "@/lib/constants";
import { useSearch } from "@/components/admin/search-context";
import type { Tournament, Player } from "@/types";
import { useState } from "react";

interface SearchResult {
  type:  "tournament" | "player";
  id:    string;
  title: string;
  sub:   string;
  href:  string;
}

export function SearchModal() {
  const router        = useRouter();
  const { open, close, toggle } = useSearch();
  const [query, setQuery] = useState("");

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); toggle(); }
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle, close]);

  const { data: tournaments = [] } = useQuery({
    queryKey: ["tournaments"],
    queryFn:  adminService.tournaments.list,
    enabled:  open,
  });

  const { data: mPlayers } = useQuery({
    queryKey: ["players", "M"],
    queryFn:  () => adminService.players.list({ gender: "M" }),
    enabled:  open && query.length >= 2,
  });

  const { data: fPlayers } = useQuery({
    queryKey: ["players", "F"],
    queryFn:  () => adminService.players.list({ gender: "F" }),
    enabled:  open && query.length >= 2,
  });

  // Fixed: useMemo instead of useCallback()()
  const results: SearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    const tResults: SearchResult[] = (tournaments as Tournament[])
      .filter((t) => t.name.toLowerCase().includes(q) || (t.club?.name ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .map((t) => ({
        type: "tournament", id: t.id,
        title: t.name,
        sub:   `${t.dates} · ${t.club?.name ?? ""}`,
        href:  `/torneos/${t.id}`,
      }));

    const pResults: SearchResult[] = [...(mPlayers?.data ?? []), ...(fPlayers?.data ?? [])]
      .filter((p: Player) => p.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((p: Player) => ({
        type: "player", id: p.id,
        title: p.name,
        sub:   `${GENDER_LABEL[p.gender].short} ${CATEGORY_LABEL_SHORT[p.level]} · ${p.points.toLocaleString()} pts`,
        href:  `/jugadores/${p.id}`,
      }));

    return [...tResults, ...pResults];
  }, [query, tournaments, mPlayers, fPlayers]);

  const navigate = (href: string) => { router.push(href); close(); setQuery(""); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { close(); setQuery(""); }} />
      <div className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar torneos, jugadores..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {!query.trim() ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">Escribe para buscar torneos y jugadores</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">Sin resultados para &quot;{query}&quot;</div>
          ) : (
            <div className="py-2">
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => navigate(r.href)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className={`p-1.5 rounded-md ${r.type === "tournament" ? "bg-[rgba(212,175,55,0.1)]" : "bg-secondary"}`}>
                    {r.type === "tournament" ? <Trophy size={13} className="text-[#D4AF37]" /> : <Users size={13} className="text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-border">↵</kbd> Seleccionar
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-border">⌘K</kbd> Abrir/cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
