"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, X } from "lucide-react";
import { CustomerNoContactNotice } from "@/components/admin/customer-no-contact-notice";
import { Button } from "@/components/ui/button";
import { clubCustomersQK, clubCustomersService, type ClubCustomer } from "@/lib/services/club-customers";

const PHONE_LIKE = /^[\d\s+()-]+$/;

/**
 * Cliente del club de una reserva: se busca por nombre o teléfono (clientes
 * del club) y, si no está, se da de alta ahí mismo con nombre y teléfono, sin
 * salir del diálogo de la reserva.
 */
export function BookingCustomerPicker({
  clubId,
  value,
  onChange,
}: {
  clubId: string;
  value: ClubCustomer | null;
  onChange: (c: ClubCustomer | null) => void;
}) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const params = { q: debounced, archived: "false", pageSize: 6 } as const;
  const search = useQuery({
    queryKey: clubCustomersQK.list(clubId, params),
    queryFn: () => clubCustomersService.list(clubId, params),
    enabled: !value && !adding && debounced.length >= 2,
    staleTime: 30_000,
  });

  const create = useMutation({
    // Solo el nombre es obligatorio: sin teléfono se da de alta igual (el aviso va en el formulario)
    mutationFn: () => clubCustomersService.create(clubId, { name: name.trim(), ...(phone.trim() ? { phone: phone.trim() } : {}) }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: clubCustomersQK.all(clubId) });
      pick(c);
    },
    onError: (e: Error) => setError(e.message),
  });

  function pick(c: ClubCustomer | null) {
    onChange(c);
    setQ("");
    setDebounced("");
    setAdding(false);
    setName("");
    setPhone("");
    setError(null);
  }

  if (value) {
    return (
      <div>
        <span className="text-xs text-muted-foreground">Cliente</span>
        <div className="mt-1 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm">
          <span>
            <span className="font-medium">{value.name ?? "Sin nombre"}</span>
            {value.phone && <span className="ml-2 text-xs text-muted-foreground">{value.phone}</span>}
          </span>
          <button
            type="button"
            onClick={() => pick(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Quitar cliente"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const startAdding = () => {
    // Lo escrito en la búsqueda va al campo que le toca: un teléfono o un nombre
    if (PHONE_LIKE.test(q.trim())) setPhone(q.trim());
    else setName(q.trim());
    setAdding(true);
  };

  const submitNew = () => {
    setError(null);
    if (!name.trim()) return setError("Escribe el nombre del cliente");
    create.mutate();
  };

  if (adding) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-background p-3">
        <span className="text-xs text-muted-foreground">Nuevo cliente</span>
        <input
          type="text"
          aria-label="Nombre del cliente"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoFocus
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        <input
          type="tel"
          aria-label="Teléfono del cliente"
          placeholder="Teléfono (opcional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
        />
        {name.trim() && !phone.trim() && <CustomerNoContactNotice />}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAdding(false)} disabled={create.isPending}>
            Volver a buscar
          </Button>
          <Button size="sm" onClick={submitNew} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Añadir cliente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">Cliente (opcional)</span>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          aria-label="Buscar cliente"
          placeholder="Buscar cliente por nombre o teléfono…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm text-foreground"
        />
      </div>
      {debounced.length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
          {search.isLoading ? (
            <div className="flex items-center justify-center p-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : search.isError ? (
            <p role="alert" className="p-3 text-xs text-destructive">
              No se han podido buscar los clientes.
            </p>
          ) : (
            <ul>
              {(search.data?.items ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{c.name ?? "Sin nombre"}</span>
                    {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                  </button>
                </li>
              ))}
              {(search.data?.items ?? []).length === 0 && (
                <li className="px-3 pt-2 text-xs text-muted-foreground">Ningún cliente coincide.</li>
              )}
              <li>
                <button
                  type="button"
                  onClick={startAdding}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-primary hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" /> Dar de alta un cliente nuevo
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
