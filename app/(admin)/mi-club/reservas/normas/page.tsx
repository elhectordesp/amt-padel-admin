/**
 * /mi-club/reservas/normas — editor del reglamento del club.
 *
 * Editor de markdown simple (textarea + preview básico).
 * Cuando se guarda, el backend calcula un version hash. Cada Booking
 * que se crea después guarda la versión vigente — útil para auditoría.
 */

"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";

const TEMPLATE = `# Normas del club

- Llegada con 10 min de antelación
- Calzado deportivo de pista obligatorio (sin huellas negras)
- Cancelación gratuita con al menos 12h de antelación
- Las pelotas son responsabilidad del jugador
- Prohibido fumar en las pistas
- Respeto a los demás jugadores y al personal del club`;

export default function NormasPage() {
  const { role, clubId } = useRole();

  const query = useQuery({
    queryKey: bookingsQK.rules(clubId ?? ""),
    queryFn: () => bookingsService.rules.get(clubId!),
    enabled: !!clubId && isClub(role),
  });

  const [markdown, setMarkdown] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const qc = useQueryClient();

  useEffect(() => {
    if (query.data && !hydrated) {
      setMarkdown(query.data.rulesMarkdown ?? "");
      setHydrated(true);
    }
  }, [query.data, hydrated]);

  const save = useMutation({
    mutationFn: () =>
      bookingsService.rules.update(clubId!, {
        rulesMarkdown: markdown.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Normas guardadas");
      qc.invalidateQueries({ queryKey: bookingsQK.rules(clubId!) });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Error";
      toast.error(msg);
    },
  });

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isClub(role) || !clubId) {
    return (
      <div className="p-6">
        <BackLink />
        <Header title="Normas" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Normas del club" />

      <div className="mt-4 flex items-center justify-end gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              mode === "edit"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              mode === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm">
          {save.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Los jugadores deberán aceptar estas normas la primera vez que reserven
        en tu club. Si actualizas el texto, el sistema genera una nueva versión
        — los jugadores que ya aceptaron la anterior NO tienen que volver a
        aceptar (el histórico queda guardado).
      </p>

      {query.data?.version && (
        <p className="mt-1 text-xs text-muted-foreground">
          Versión actual:{" "}
          <code className="rounded bg-muted px-1 py-0.5">{query.data.version}</code>
        </p>
      )}

      <div className="mt-6">
        {mode === "edit" ? (
          <div className="space-y-2">
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={20}
              placeholder={TEMPLATE}
              className="w-full rounded-lg border border-border bg-background p-4 font-mono text-sm leading-relaxed"
            />
            {markdown === "" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMarkdown(TEMPLATE)}
              >
                Insertar plantilla de ejemplo
              </Button>
            )}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-card p-6">
            <MarkdownPreview source={markdown} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Preview básico de markdown — soporta # headings, listas, párrafos, **bold**.
 * Para algo más completo, integrar react-markdown en futura iteración.
 */
function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-muted-foreground">Sin normas definidas.</p>;
  }
  const lines = source.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  const flushList = () => {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={out.length}>
        {listBuffer.map((l, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(l) }} />
        ))}
      </ul>,
    );
    listBuffer = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      flushList();
      out.push(<h1 key={out.length}>{trimmed.slice(2)}</h1>);
    } else if (trimmed.startsWith("## ")) {
      flushList();
      out.push(<h2 key={out.length}>{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2));
    } else if (trimmed === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p key={out.length} dangerouslySetInnerHTML={{ __html: renderInline(trimmed) }} />,
      );
    }
  }
  flushList();
  return <>{out}</>;
}

function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function BackLink() {
  return (
    <Link
      href="/mi-club/reservas"
      className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3 w-3" /> Volver a Reservas
    </Link>
  );
}
