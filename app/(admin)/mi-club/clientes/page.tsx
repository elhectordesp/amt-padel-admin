/**
 * /mi-club/clientes — los clientes del club: quien reserva o juega en el club
 * (con o sin la app). Búsqueda por nombre, teléfono o email (en el servidor),
 * filtros de socio, etiqueta y archivados, y alta de quien no tiene la app.
 */

"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, Upload, Users } from "lucide-react";
import { ClubCustomerCreateDialog } from "@/components/admin/club-customer-create-dialog";
import { ClubCustomerImportDialog } from "@/components/admin/club-customer-import-dialog";
import { ErrorState } from "@/components/admin/error-state";
import { CustomSelect } from "@/components/admin/form";
import { Header } from "@/components/admin/header";
import { Pagination, useKeepPageInRange, usePagination } from "@/components/admin/pagination";
import { Button } from "@/components/ui/button";
import {
  clubCustomersQK,
  clubCustomersService,
  type ClubCustomersQuery,
} from "@/lib/services/club-customers";
import { useRole, isClub } from "@/lib/use-role";

const MEMBER_OPTIONS = [
  { value: "",      label: "Todos" },
  { value: "true",  label: "Socios" },
  { value: "false", label: "No socios" },
];

export default function ClientesPage() {
  const { role, clubId } = useRole();
  const router = useRouter();
  const enabled = !!clubId && isClub(role);
  const { page, setPage, pageSize, setPageSize } = usePagination();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [member, setMember] = useState("");
  const [tag, setTag] = useState("");
  const [archived, setArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // La búsqueda espera 300 ms sin teclear y vuelve a la primera página
  useEffect(() => {
    const next = searchInput.trim();
    if (next === search) return;
    const t = setTimeout(() => {
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search, setPage]);

  const params: ClubCustomersQuery = {
    q: search || undefined,
    member: member === "true" || member === "false" ? member : undefined,
    tag: tag || undefined,
    archived: archived ? "true" : undefined,
    page,
    pageSize,
  };

  const tagsQuery = useQuery({
    queryKey: clubCustomersQK.tags(clubId ?? ""),
    queryFn: () => clubCustomersService.tags(clubId!),
    enabled,
  });
  const query = useQuery({
    queryKey: clubCustomersQK.list(clubId ?? "", params),
    queryFn: () => clubCustomersService.list(clubId!, params),
    enabled,
    placeholderData: (prev) => prev,
  });
  useKeepPageInRange(page, setPage, pageSize, query.isPlaceholderData ? undefined : query.data?.total);

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!enabled) {
    return (
      <>
        <Header title="Clientes" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const tagOptions = [{ value: "", label: "Todas las etiquetas" }, ...(tagsQuery.data ?? []).map((t) => ({ value: t, label: t }))];
  const filtered = !!search || !!member || !!tag || archived;

  return (
    <>
      <Header title="Clientes" />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
            Las personas que reservan o juegan en tu club, tengan o no la app. Aquí apuntas sus notas y etiquetas
            (solo las ve tu club) y quién es socio.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="h-3.5 w-3.5" /> Importar
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo cliente
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-full items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 sm:max-w-xs">
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <input
              type="search"
              aria-label="Buscar clientes"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email…"
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query.isFetching && <Loader2 size={12} className="shrink-0 animate-spin text-muted-foreground" />}
          </div>
          <div className="w-36">
            <CustomSelect options={MEMBER_OPTIONS} value={member} onChange={(v) => { setMember(v); setPage(1); }} compact />
          </div>
          <div className="w-44">
            <CustomSelect options={tagOptions} value={tag} onChange={(v) => { setTag(v); setPage(1); }} compact />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => { setArchived(e.target.checked); setPage(1); }}
            />
            Ver archivados
          </label>
        </div>

        {query.isError ? (
          <ErrorState message="No se pudieron cargar los clientes." onRetry={() => void query.refetch()} />
        ) : items.length === 0 && !query.isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {filtered
              ? "Ningún cliente coincide con la búsqueda."
              : "Todavía no hay clientes. Aparecen solos cuando alguien reserva o se inscribe en tus torneos, o los añades tú."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Teléfono</th>
                  <th className="hidden px-3 py-2 font-semibold md:table-cell">Email</th>
                  <th className="px-3 py-2 font-semibold">Socio</th>
                  <th className="hidden px-3 py-2 font-semibold lg:table-cell">Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/mi-club/clientes/${c.id}`)}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <Link href={`/mi-club/clientes/${c.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.name ?? "Sin nombre"}
                      </Link>
                      {!c.hasAccount && <span className="ml-2 text-xs text-muted-foreground">sin app</span>}
                      {c.archivedAt && <span className="ml-2 text-xs text-muted-foreground">archivado</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{c.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.isMember ? (
                        <span className="rounded bg-[rgba(212,175,55,0.12)] px-1.5 py-0.5 text-xs text-[#D4AF37]">
                          Socio{c.memberNumber ? ` ${c.memberNumber}` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!query.isLoading && !query.isError && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="clientes"
            busy={query.isFetching}
          />
        )}
      </div>

      <ClubCustomerImportDialog open={showImport} clubId={clubId!} onClose={() => setShowImport(false)} />
      <ClubCustomerCreateDialog
        open={showCreate}
        clubId={clubId!}
        onClose={() => setShowCreate(false)}
        onDone={(c) => {
          setShowCreate(false);
          router.push(`/mi-club/clientes/${c.id}`);
        }}
      />
    </>
  );
}
