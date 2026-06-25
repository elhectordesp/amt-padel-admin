/**
 * /mi-club/reservas/activacion — lifecycle del módulo + gestión de testers.
 *
 * 3 acciones:
 *  - Request activation (solo si INACTIVE)
 *  - Publish to public (solo si TESTER_MODE)
 *  - Manage tester users (cualquier estado)
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/admin/header";
import { Button } from "@/components/ui/button";
import { bookingsService, bookingsQK } from "@/lib/services/bookings";
import { useRole, isClub } from "@/lib/use-role";

export default function ActivacionPage() {
  const { role, clubId } = useRole();

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
        <Header title="Activación" />
        <p className="mt-6 text-sm text-muted-foreground">
          Requiere usuario CLUB con club asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <BackLink />
      <Header title="Activación + Testers" />
      <p className="mt-2 text-sm text-muted-foreground">
        Solicita la activación al equipo AMT cuando hayas terminado de configurar
        horarios, pistas, precios y extras. Una vez aprobado, podrás usar el
        módulo en modo prueba con tus testers, y luego abrir al público.
      </p>

      <div className="mt-6 space-y-8">
        <LifecycleSection clubId={clubId} />
        <TestersSection clubId={clubId} />
      </div>
    </div>
  );
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

function LifecycleSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: bookingsQK.activation(clubId),
    queryFn: () => bookingsService.activation.state(clubId),
  });

  const requestMut = useMutation({
    mutationFn: () => bookingsService.activation.request(clubId),
    onSuccess: (data) => {
      toast.success(`Solicitud enviada (${data.notifiedAdminCount} admins notificados)`);
      qc.invalidateQueries({ queryKey: bookingsQK.activation(clubId) });
    },
    onError: showErr,
  });

  const publishMut = useMutation({
    mutationFn: () => bookingsService.activation.publish(clubId),
    onSuccess: () => {
      toast.success("Club publicado");
      qc.invalidateQueries({ queryKey: bookingsQK.activation(clubId) });
    },
    onError: showErr,
  });

  if (query.isLoading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  const state = query.data;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium">Estado del módulo</h2>

      {state?.status === "INACTIVE" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md bg-amber-500/10 p-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">Módulo INACTIVO</p>
              <p className="text-muted-foreground">
                Configura primero horarios, pistas, precios y extras. Cuando
                esté todo listo, solicita la activación al equipo AMT.
              </p>
            </div>
          </div>
          <Button onClick={() => requestMut.mutate()} disabled={requestMut.isPending}>
            {requestMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Solicitar activación
          </Button>
        </div>
      )}

      {state?.status === "TESTER_MODE" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md bg-blue-500/10 p-3">
            <Sparkles className="h-5 w-5 shrink-0 text-blue-500" />
            <div className="text-sm">
              <p className="font-medium">Modo TESTER</p>
              <p className="text-muted-foreground">
                Aprobado por AMT. Solo los {state.activeTesterCount} tester(s)
                activos pueden ver y reservar. Cuando estés listo, abre al
                público.
              </p>
            </div>
          </div>
          <Button onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
            {publishMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Publicar al público
          </Button>
        </div>
      )}

      {state?.status === "PUBLIC" && (
        <div className="flex items-start gap-3 rounded-md bg-green-500/10 p-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
          <div className="text-sm">
            <p className="font-medium">Visible públicamente</p>
            <p className="text-muted-foreground">
              Cualquier usuario AMT en la zona puede ver tu club y reservar
              pistas. Activo desde{" "}
              {state.bookingPublicAt
                ? new Date(state.bookingPublicAt).toLocaleDateString("es-ES")
                : "—"}
              .
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Testers ────────────────────────────────────────────────────────────────

function TestersSection({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ userId: "", validUntil: "" });

  const query = useQuery({
    queryKey: bookingsQK.testers(clubId, false),
    queryFn: () => bookingsService.testers.list(clubId, false),
  });

  const add = useMutation({
    mutationFn: () =>
      bookingsService.testers.add(clubId, {
        userId: form.userId.trim(),
        validUntil: form.validUntil || undefined,
      }),
    onSuccess: () => {
      toast.success("Tester añadido");
      setForm({ userId: "", validUntil: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["bookings", "testers", clubId] });
    },
    onError: showErr,
  });

  const remove = useMutation({
    mutationFn: (testerId: string) =>
      bookingsService.testers.remove(clubId, testerId),
    onSuccess: () => {
      toast.success("Tester eliminado");
      qc.invalidateQueries({ queryKey: ["bookings", "testers", clubId] });
    },
    onError: showErr,
  });

  const testers = query.data ?? [];

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">
          <Users className="mr-1 inline-block h-3.5 w-3.5" />
          Testers
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-3.5 w-3.5" /> Añadir
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Usuarios AMT que pueden ver y reservar mientras el club está en modo
        prueba. Si no especificas fecha, expiran en 7 días.
      </p>

      {showForm && (
        <div className="mb-4 rounded-md border border-border bg-background p-3 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
            <input
              type="text"
              placeholder="userId del jugador"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
            <input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              className="rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            TODO: aquí debería haber un buscador de jugadores AMT en lugar de
            pedir el userId crudo.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => add.mutate()}
              disabled={add.isPending || !form.userId.trim()}
            >
              {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Añadir"}
            </Button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : testers.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin testers activos
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {testers.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{t.user?.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {t.user?.email ?? t.userId} · Hasta{" "}
                  {new Date(t.validUntil).toLocaleString("es-ES", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove.mutate(t.id)}
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function showErr(err: unknown) {
  const msg =
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err as Error)?.message ??
    "Error";
  toast.error(msg);
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
