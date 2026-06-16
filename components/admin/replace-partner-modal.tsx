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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Cambiar pareja</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {registration.user.name} · Pareja actual: <span className="font-medium">{currentPartnerName}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Warning */}
          {registration.partner && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>La inscripción de <strong>{currentPartnerName}</strong> quedará cancelada.</span>
            </div>
          )}

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Buscar nuevo compañero</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Nombre o email…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && !selected && (
            <ul className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {results.map((p) => {
                const isCurrentPlayer  = p.id === registration.userId;
                const isCurrentPartner = p.id === registration.partnerId;
                const disabled = isCurrentPlayer || isCurrentPartner;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => { if (!disabled) { setSelected(p); setQuery(p.name); setResults([]); } }}
                      disabled={disabled}
                      className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between transition-colors ${
                        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-50"
                      }`}
                    >
                      <span>
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.email && <span className="text-gray-400 ml-2">{p.email}</span>}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0 ml-2">
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
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
              <UserCheck className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-900">{selected.name}</p>
                <p className="text-xs text-blue-600">{selected.level} · {selected.gender === "M" ? "Masculino" : "Femenino"}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setQuery(""); }}
                className="text-xs text-blue-500 hover:text-blue-700 underline shrink-0"
              >
                Cambiar
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => replaceMut.mutate()}
            disabled={!selected || replaceMut.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {replaceMut.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
            ) : (
              "Confirmar cambio"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
