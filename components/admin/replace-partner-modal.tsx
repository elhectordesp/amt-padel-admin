"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, UserCheck, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import type { AdminRegistration, Player } from "@/types";

interface Props {
  registration: AdminRegistration;
  tournamentId: string;
  onClose: () => void;
}

export default function ReplacePartnerModal({ registration, tournamentId, onClose }: Props) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Player | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const qc = useQueryClient();

  const categoryGender = registration.category.gender;

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await adminService.players.list({ q, gender: categoryGender !== "MX" ? categoryGender : undefined, pageSize: 8 });
        setResults(data.data.slice(0, 8));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [categoryGender]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { search(query); }, [query, search]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const replaceMut = useMutation({
    mutationFn: () => adminService.registrations.replacePartner(registration.id, selected!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-registrations", tournamentId] });
      toast.success(`Pareja actualizada a ${selected!.name}`);
      onClose();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? "Error al cambiar la pareja");
    },
  });

  const currentPartnerName = registration.partner?.name ?? "Sin pareja";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="font-heading text-lg text-foreground">Cambiar pareja</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {registration.user.name} · Pareja actual: <span className="font-medium text-foreground">{currentPartnerName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Warning */}
          {registration.partner && (
            <div className="flex gap-2 p-3 rounded-md bg-yellow-400/10 border border-yellow-400/30 text-xs text-yellow-400">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>La inscripción de <strong>{currentPartnerName}</strong> quedará cancelada.</span>
            </div>
          )}

          {/* Search */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Buscar nuevo compañero</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Nombre o email…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                className="w-full h-9 pl-9 pr-9 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]"
                autoFocus
              />
              {searching && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && !selected && (
            <ul className="border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto bg-secondary/40">
              {results.map((p) => {
                const isCurrentPlayer  = p.id === registration.userId;
                const isCurrentPartner = p.id === registration.partnerId;
                const disabled = isCurrentPlayer || isCurrentPartner;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => { if (!disabled) { setSelected(p); setQuery(p.name); setResults([]); } }}
                      disabled={disabled}
                      className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors ${
                        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-[rgba(212,175,55,0.08)]"
                      }`}
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-foreground">{p.name}</span>
                        {p.email && <span className="text-muted-foreground ml-2 text-xs">{p.email}</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {p.level} · {p.gender === "M" ? "Masc" : "Fem"}
                        {isCurrentPartner && " · (pareja actual)"}
                        {isCurrentPlayer  && " · (jugador)"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Selected confirmation */}
          {selected && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)]">
              <UserCheck size={16} className="text-[#D4AF37] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{selected.level} · {selected.gender === "M" ? "Masculino" : "Femenino"}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setQuery(""); }}
                className="text-xs text-[#D4AF37] hover:underline shrink-0"
              >
                Cambiar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => replaceMut.mutate()}
            disabled={!selected || replaceMut.isPending}
            className="flex-1 py-2 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold hover:bg-[#C49F2A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {replaceMut.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Guardando…</>
            ) : (
              "Confirmar cambio"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
