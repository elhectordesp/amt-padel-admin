"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { adminService } from "@/lib/services/admin";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CATEGORY_LABEL_SHORT, GENDER_LABEL } from "@/lib/constants";
import { formatInTimeZone } from "@/lib/utils/time-zone";
import type { CategoryLevel, Gender } from "@/types";
import type {
  PreparationCategory,
  PreparationStepKey,
  PublishAndNotifyResult,
  TournamentPreparation,
} from "@/types/preparation";

/** Clave de la consulta: cuelga de la del torneo, así se refresca con él. */
export const preparationQK = (tournamentId: string) =>
  ["tournament", tournamentId, "preparation"] as const;

const STEP_LABEL: Record<PreparationStepKey, string> = {
  CATEGORIES:          "Categorías creadas",
  REGISTRATION_OPEN:   "Inscripciones abiertas",
  REGISTRATION_CLOSED: "Inscripciones cerradas",
  DRAW:                "Cuadro generado",
  SCHEDULE:            "Horarios sin conflictos",
  PUBLISH:             "Publicar y avisar",
};

/** Solo se prepara un torneo que aún no ha empezado. */
const PREPARING = ["DRAFT", "OPEN", "DRAW", "SCHEDULED"];

type Confirm = "open" | "close" | "publish" | "publish-force" | null;

const catName = (c: { gender: string; level: string }) =>
  `${GENDER_LABEL[c.gender as Gender]?.short ?? c.gender} ${CATEGORY_LABEL_SHORT[c.level as CategoryLevel] ?? c.level}`;

// En la zona del torneo, no en la del navegador
const fmtDeadline = (iso: string, timeZone: string) =>
  formatInTimeZone(iso, timeZone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** El detalle de cada paso, en una línea. */
function stepDetail(key: PreparationStepKey, done: boolean, p: TournamentPreparation, timeZone: string): string {
  const drawable = p.categories.filter((c) => c.hasDraw || c.canDraw);
  const drawn = p.categories.filter((c) => c.hasDraw);
  switch (key) {
    case "CATEGORIES":
      return done
        ? `${p.categories.length} ${p.categories.length === 1 ? "categoría" : "categorías"}`
        : "Añade al menos una categoría en «Categorías».";
    case "REGISTRATION_OPEN":
      return done ? "El torneo se ve en la app." : "Es un borrador: no se ve en la app.";
    case "REGISTRATION_CLOSED": {
      if (done) return "Ya no se admiten inscripciones desde la app.";
      if (!p.registrationDeadline) return "Sin fecha de cierre: ciérralas cuando quieras sortear.";
      return new Date(p.registrationDeadline) <= new Date()
        ? `El plazo terminó el ${fmtDeadline(p.registrationDeadline, timeZone)}: ciérralas para sortear.`
        : `Abiertas hasta el ${fmtDeadline(p.registrationDeadline, timeZone)}.`;
    }
    case "DRAW":
      return `${drawable.filter((c) => c.hasDraw).length} de ${drawable.length} categorías con cuadro.`;
    case "SCHEDULE": {
      const unscheduled = drawn.reduce((s, c) => s + c.unscheduled, 0);
      // Publicada forzando, sus conflictos ya están aceptados
      const conflicts = drawn.filter((c) => !c.published).reduce((s, c) => s + c.conflicts, 0);
      if (done) return "Todos los partidos con hora y pista, sin conflictos.";
      if (!drawn.length) return "Primero genera el cuadro.";
      return `${unscheduled} ${unscheduled === 1 ? "partido" : "partidos"} sin hora o pista · ${conflicts} ${conflicts === 1 ? "conflicto" : "conflictos"}.`;
    }
    case "PUBLISH":
      return done
        ? "Publicado: los inscritos tienen su horario y los grupos están bloqueados."
        : "Publica el cuadro y los horarios y avisa a cada pareja con su primer partido.";
  }
}

/** Anillo con el % de la preparación. */
function ProgressRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-16 h-16 shrink-0" role="img" aria-label={`Preparación al ${percent} %`}>
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-secondary" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          stroke={percent === 100 ? "#4ade80" : "#D4AF37"}
          strokeDasharray={c}
          strokeDashoffset={c - (c * percent) / 100}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
        {percent}%
      </span>
    </div>
  );
}

/**
 * Preparación del torneo: los pasos que faltan, con su %, y la acción de cada
 * uno. El estado del torneo avanza con ellos (abrir: Abierto; cerrar: Sorteo;
 * publicar: Programado), sin tocar el desplegable, que queda en «Avanzado» de
 * la edición del torneo.
 */
export function TournamentPreparationChecklist({
  tournamentId,
  onNavigate,
  timeZone,
}: {
  tournamentId: string;
  /** Zona del torneo: la del cierre de inscripciones. */
  timeZone: string;
  /** Ir a la pestaña donde se hace el paso. */
  onNavigate: (tab: "cuadro" | "horarios") => void;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [blocked, setBlocked] = useState<PublishAndNotifyResult["results"]>([]);

  const { data: prep, isLoading, isError, refetch } = useQuery({
    queryKey: preparationQK(tournamentId),
    queryFn: () => adminService.tournaments.preparation(tournamentId),
    // Al volver a Resumen tras programar o sortear, con los recuentos de ahora
    refetchOnMount: "always",
  });

  // Todo lo del torneo (incluida esta lista), lo que cambia al publicar y el
  // torneo de la edición y del listado: con el de antes en caché, guardar la
  // edición devolvería el estado atrás
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    qc.invalidateQueries({ queryKey: ["admin-tournament", tournamentId] });
    qc.invalidateQueries({ queryKey: ["tournaments"] });
    qc.invalidateQueries({ queryKey: ["bracket", tournamentId] });
    qc.invalidateQueries({ queryKey: ["matches", tournamentId] });
  };
  const onError = (err: Error) => toast.error(err.message);

  const openMut = useMutation({
    mutationFn: () => adminService.tournaments.publish(tournamentId),
    onSuccess: () => {
      toast.success("Inscripciones abiertas: el torneo ya se ve en la app y se ha avisado a los jugadores");
      setConfirm(null);
      refresh();
    },
    onError: (err: Error) => { setConfirm(null); onError(err); },
  });

  const closeMut = useMutation({
    mutationFn: () => adminService.tournaments.update(tournamentId, { status: "DRAW" }),
    onSuccess: () => {
      toast.success("Inscripciones cerradas: ya puedes generar el cuadro");
      setConfirm(null);
      refresh();
    },
    onError: (err: Error) => { setConfirm(null); onError(err); },
  });

  const publishMut = useMutation({
    mutationFn: (force: boolean) => adminService.tournaments.publishAndNotify(tournamentId, force),
    onSuccess: (res) => {
      setConfirm(null);
      const notPublished = res.results.filter((r) => !r.published);
      setBlocked(notPublished);
      if (res.publishedCount > 0)
        toast.success(
          `${res.publishedCount} ${res.publishedCount === 1 ? "categoría publicada" : "categorías publicadas"} y avisadas` +
            (res.status === "SCHEDULED" ? ". El torneo pasa a «Programado»." : "."),
        );
      else if (!notPublished.length) toast.success("Ya estaba todo publicado");
      refresh();
    },
    onError: (err: Error) => { setConfirm(null); onError(err); },
  });

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Cargando la preparación…
      </div>
    );
  }
  if (isError || !prep) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 text-sm text-muted-foreground">
        No se pudo cargar la preparación del torneo.{" "}
        <button onClick={() => refetch()} className="underline">Reintentar</button>
      </div>
    );
  }
  if (!PREPARING.includes(prep.status)) return null;

  // «Publicar igualmente» solo publica las que tienen conflictos que se pueden
  // aceptar: con un partido sin hora o pista el back no la publica nunca
  const blockedWithConflicts = blocked.filter(
    (b) => b.conflicts.length > 0 && b.conflicts.every((c) => c.type !== "MISSING_ASSIGNMENT"),
  );
  const { status, categories } = prep;
  const hasCategories = prep.steps.find((s) => s.key === "CATEGORIES")?.done ?? false;
  // Lo mismo que exige el back para publicar: inscripciones cerradas (el paso,
  // con su criterio) y algún cuadro
  const registrationsClosed = prep.steps.find((s) => s.key === "REGISTRATION_CLOSED")?.done ?? false;
  const canPublish = registrationsClosed && categories.some((c) => c.hasDraw);
  const pendingCats = (pred: (c: PreparationCategory) => boolean) =>
    categories.filter(pred).map(catName).join(", ");

  /** La acción del paso, si se puede hacer desde aquí. */
  function action(key: PreparationStepKey) {
    const btn =
      "inline-flex items-center gap-1.5 text-xs font-semibold rounded-md px-3 py-1.5 transition-colors disabled:opacity-50";
    const primary = `${btn} bg-[#D4AF37] text-[#0C0C0C] hover:bg-[#C49F2A]`;
    const secondary = `${btn} border border-border text-foreground hover:bg-secondary`;
    switch (key) {
      case "REGISTRATION_OPEN":
        return status === "DRAFT" ? (
          <button className={primary} onClick={() => setConfirm("open")} disabled={!hasCategories}>
            Abrir inscripciones
          </button>
        ) : null;
      case "REGISTRATION_CLOSED":
        return status === "OPEN" ? (
          <button className={secondary} onClick={() => setConfirm("close")}>Cerrar inscripciones</button>
        ) : null;
      case "DRAW":
        return <button className={secondary} onClick={() => onNavigate("cuadro")}>Ir al cuadro</button>;
      case "SCHEDULE":
        return <button className={secondary} onClick={() => onNavigate("horarios")}>Ir a horarios</button>;
      case "PUBLISH":
        return (
          <button
            className={primary}
            onClick={() => setConfirm("publish")}
            disabled={publishMut.isPending || !canPublish}
            title={canPublish ? undefined : "Cierra las inscripciones y genera el cuadro antes de publicar"}
          >
            {publishMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Publicar y avisar
          </button>
        );
      default:
        return null;
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
        <ProgressRing percent={prep.percent} />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Preparación del torneo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {prep.nextStep
              ? `Siguiente paso: ${STEP_LABEL[prep.nextStep]}. El estado del torneo avanza solo al completarlos.`
              : "Todo listo: cuadro y horarios publicados."}
          </p>
        </div>
      </div>

      <ol className="divide-y divide-border">
        {prep.steps.map((s, i) => {
          const isNext = s.key === prep.nextStep;
          return (
            <li key={s.key} className={`flex flex-wrap items-start gap-3 px-5 py-3 ${isNext ? "bg-[rgba(212,175,55,0.04)]" : ""}`}>
              <span
                className={`mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${
                  s.done
                    ? "bg-green-400/15 text-green-400 border border-green-400/40"
                    : isNext
                      ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/50"
                      : "bg-secondary text-muted-foreground border border-border"
                }`}
                aria-hidden
              >
                {s.done ? <Check size={11} /> : i + 1}
              </span>
              <div className="flex-1 min-w-[12rem]">
                <p className={`text-sm ${s.done ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                  {STEP_LABEL[s.key]}
                  <span className="sr-only">{s.done ? " (hecho)" : " (pendiente)"}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{stepDetail(s.key, s.done, prep, timeZone)}</p>
                {s.key === "DRAW" && !s.done && pendingCats((c) => c.canDraw && !c.hasDraw) && (
                  <p className="text-[11px] text-amber-400 mt-0.5">Sin cuadro: {pendingCats((c) => c.canDraw && !c.hasDraw)}</p>
                )}
                {s.key === "DRAW" && pendingCats((c) => !c.canDraw && !c.hasDraw) && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Con menos de 3 parejas confirmadas (no entran): {pendingCats((c) => !c.canDraw && !c.hasDraw)}
                  </p>
                )}
              </div>
              {!s.done && <div className="shrink-0 ml-8 sm:ml-0">{action(s.key)}</div>}
            </li>
          );
        })}
      </ol>

      {blocked.length > 0 && (
        <div className="border-t border-amber-400/30 bg-amber-400/5 px-5 py-3 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
            <AlertTriangle size={13} /> Sin publicar
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {blocked.map((b) => {
              const missing = b.conflicts.filter((c) => c.type === "MISSING_ASSIGNMENT").length;
              return (
                <li key={b.categoryId}>
                  <span className="text-foreground">{catName(b)}</span>:{" "}
                  {missing > 0
                    ? `${missing} ${missing === 1 ? "partido" : "partidos"} sin hora o pista (prográmalos antes)`
                    : `${b.conflicts.length} ${b.conflicts.length === 1 ? "conflicto" : "conflictos"} de horario`}
                </li>
              );
            })}
          </ul>
          {blockedWithConflicts.length > 0 && (
            <button
              onClick={() => setConfirm("publish-force")}
              className="text-xs font-semibold text-amber-400 underline hover:text-amber-300"
            >
              Publicar igualmente las que solo tienen conflictos
            </button>
          )}
        </div>
      )}

      <div className="px-5 py-2.5 border-t border-border text-[11px] text-muted-foreground">
        ¿Hace falta corregir el estado a mano?{" "}
        <Link href={`/torneos/${tournamentId}/editar#avanzado`} className="underline hover:text-foreground">
          Editar → Avanzado
        </Link>
      </div>

      <ConfirmModal
        open={confirm === "open"}
        title="Abrir inscripciones"
        description="El torneo se verá en la app y se avisará a los jugadores de sus categorías para que se inscriban."
        confirmLabel="Abrir y avisar"
        loading={openMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => openMut.mutate()}
      />
      <ConfirmModal
        open={confirm === "close"}
        title="Cerrar inscripciones"
        description="Nadie más podrá inscribirse desde la app y el torneo pasa a «Sorteo» para generar el cuadro."
        confirmLabel="Cerrar inscripciones"
        loading={closeMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => closeMut.mutate()}
      />
      <ConfirmModal
        open={confirm === "publish" || confirm === "publish-force"}
        title="Publicar y avisar"
        description={
          confirm === "publish-force"
            ? "Se publicarán también las categorías con conflictos de horario (pista o jugador doblados, fuera de jornada…). Cada pareja recibe su primer partido y los grupos quedan bloqueados."
            : "Se publican el cuadro y los horarios de las categorías sorteadas y cada pareja inscrita recibe un aviso con su primer partido. Después, sus grupos quedan bloqueados."
        }
        confirmLabel={confirm === "publish-force" ? "Publicar igualmente" : "Publicar y avisar"}
        danger={confirm === "publish-force"}
        loading={publishMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => publishMut.mutate(confirm === "publish-force")}
      />
    </div>
  );
}
