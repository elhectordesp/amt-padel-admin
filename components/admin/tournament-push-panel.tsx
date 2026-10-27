"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CATEGORY_LABEL_SHORT, GENDER_LABEL } from "@/lib/constants";
import { charCount } from "@/lib/utils/char-count";
import {
  MESSAGE_BODY_MAX,
  MESSAGE_TITLE_MAX,
  tournamentMessagesQK,
  tournamentMessagesService,
  type TournamentMessage,
} from "@/lib/services/tournament-messages";
import type { CategoryLevel, Gender } from "@/types";

interface Category {
  id:     string;
  gender: string;
  level:  string;
}

interface Props {
  tournamentId: string;
  categories:   Category[];
  /** En borrador no se puede mandar (el back lo rechaza): solo se explica. */
  isDraft?:     boolean;
}

/** Por qué no se puede mandar en un borrador (también en la pestaña desactivada). */
export const DRAFT_MESSAGES_HINT =
  "El torneo está en borrador y los jugadores aún no lo ven. Publícalo para poder mandarles mensajes.";

/** "Masc. 3ª" (o el valor tal cual si es uno que el panel aún no conoce). */
function categoryLabel(c: { gender: string; level: string }): string {
  const gender = GENDER_LABEL[c.gender as Gender]?.short ?? c.gender;
  const level = CATEGORY_LABEL_SHORT[c.level as CategoryLevel] ?? c.level;
  return `${gender} ${level}`;
}

/** Fecha y hora del envío en hora de España. */
function sentAt(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

/** Lo que cuenta el back: sin los espacios de los extremos, que se quitan al enviar. */
const sentLength = (value: string) => charCount(value.trim());

function Counter({ value, max }: { value: string; max: number }) {
  const n = sentLength(value);
  return (
    <span className={`text-[11px] tabular-nums ${n > max ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
      {n}/{max}
    </span>
  );
}

/**
 * Mensaje a mano a los inscritos de un torneo: llega como notificación al
 * móvil y queda en su centro de avisos. A los jugadores de las parejas
 * pendientes y confirmadas de las categorías marcadas (y, si se marca, la
 * lista de espera), cada uno una vez. Con límite de envíos al día y el
 * historial de lo enviado.
 */
export function TournamentPushPanel({ tournamentId, categories, isDraft = false }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [includeWaitlist, setIncludeWaitlist] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const history = useQuery({
    queryKey: tournamentMessagesQK.list(tournamentId),
    queryFn:  () => tournamentMessagesService.list(tournamentId),
    enabled:  !isDraft,
  });

  const recipients = useQuery({
    queryKey: tournamentMessagesQK.recipients(tournamentId, selected, includeWaitlist),
    queryFn:  () => tournamentMessagesService.recipients(tournamentId, selected, includeWaitlist),
    enabled:  !isDraft && selected.length > 0,
  });

  const send = useMutation({
    mutationFn: () =>
      tournamentMessagesService.send(tournamentId, {
        title: title.trim(),
        body: body.trim(),
        categoryIds: selected,
        includeWaitlist,
      }),
    onSuccess: (sent) => {
      toast.success(`Mensaje enviado a ${sent.recipientCount} ${sent.recipientCount === 1 ? "jugador" : "jugadores"}`);
      setTitle("");
      setBody("");
      setConfirming(false);
      qc.invalidateQueries({ queryKey: tournamentMessagesQK.list(tournamentId) });
    },
    onError: (e: Error) => {
      setConfirming(false);
      toast.error(e.message);
      // El límite del día pudo cambiar (otro envío a la vez)
      qc.invalidateQueries({ queryKey: tournamentMessagesQK.list(tournamentId) });
    },
  });

  const remaining = history.data?.remainingToday;
  const dailyLimit = history.data?.dailyLimit;
  const titleOk = title.trim() !== "" && sentLength(title) <= MESSAGE_TITLE_MAX;
  const bodyOk = body.trim() !== "" && sentLength(body) <= MESSAGE_BODY_MAX;
  const recipientCount = recipients.data?.recipients;
  const canSend =
    titleOk && bodyOk && selected.length > 0 && remaining !== undefined && remaining > 0 &&
    recipientCount !== undefined && recipientCount > 0 && !send.isPending;

  const allSelected = categories.length > 0 && selected.length === categories.length;
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (isDraft)
    return (
      <section className="bg-card border border-border rounded-xl p-5 my-2 flex items-start gap-3">
        <Bell size={16} className="text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Mensajes a los inscritos</h3>
          <p className="text-xs text-muted-foreground mt-1">{DRAFT_MESSAGES_HINT}</p>
        </div>
      </section>
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 py-2">
      {/* ── Formulario ── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4" aria-labelledby="push-form-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="push-form-title" className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell size={14} className="text-[#D4AF37]" /> Mensaje a los inscritos
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Llega como notificación al móvil y queda en su centro de avisos. Útil para lluvia, retrasos o cambios de pista.
            </p>
          </div>
          {remaining !== undefined && dailyLimit !== undefined && (
            <span className={`shrink-0 text-[11px] px-2 py-1 rounded-md border ${
              remaining > 0 ? "border-border text-muted-foreground" : "border-destructive/40 text-destructive"
            }`}>
              Hoy quedan {remaining} de {dailyLimit}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="push-title" className="text-xs font-medium text-foreground">Título</label>
            <Counter value={title} max={MESSAGE_TITLE_MAX} />
          </div>
          <input
            id="push-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej.: Retraso por lluvia"
            className="w-full h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="push-body" className="text-xs font-medium text-foreground">Texto</label>
            <Counter value={body} max={MESSAGE_BODY_MAX} />
          </div>
          <textarea
            id="push-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Ej.: Los partidos de la tarde empiezan una hora más tarde."
            className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground resize-none focus:outline-none focus:border-[#D4AF37]"
          />
          <p className="text-[11px] text-muted-foreground">
            Con {MESSAGE_TITLE_MAX} caracteres de título y {MESSAGE_BODY_MAX} de texto se lee entero en iPhone y Android.
          </p>
        </div>

        <fieldset className="space-y-2">
          <div className="flex items-center justify-between">
            <legend className="text-xs font-medium text-foreground">Categorías</legend>
            {categories.length > 1 && (
              <button
                type="button"
                onClick={() => setSelected(allSelected ? [] : categories.map((c) => c.id))}
                className="text-[11px] text-[#D4AF37] hover:underline"
              >
                {allSelected ? "Ninguna" : "Todas"}
              </button>
            )}
          </div>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">Este torneo aún no tiene categorías.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <label
                  key={c.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    selected.includes(c.id)
                      ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    className="accent-[#D4AF37]"
                  />
                  {categoryLabel(c)}
                </label>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={includeWaitlist}
              onChange={(e) => setIncludeWaitlist(e.target.checked)}
              className="accent-[#D4AF37]"
            />
            Incluir la lista de espera
          </label>
        </fieldset>

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5" aria-live="polite">
            <Users size={12} />
            {selected.length === 0
              ? "Marca al menos una categoría"
              : recipients.isLoading
                ? "Contando jugadores…"
                : recipientCount === undefined
                  ? "No se pudo contar a los jugadores"
                  : recipientCount === 0
                    ? "No hay jugadores inscritos en esas categorías"
                    : `Llegará a ${recipientCount} ${recipientCount === 1 ? "jugador" : "jugadores"}`}
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-xs font-semibold hover:bg-[#C49F2A] disabled:opacity-50 transition-colors"
          >
            {send.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Enviar
          </button>
        </div>
      </section>

      {/* ── Historial ── */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-3" aria-labelledby="push-history-title">
        <h3 id="push-history-title" className="text-sm font-semibold text-foreground">Mensajes enviados</h3>
        {history.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-muted-foreground" />
          </div>
        ) : history.isError ? (
          <p className="text-xs text-destructive py-6 text-center">No se pudo cargar el historial.</p>
        ) : (history.data?.messages.length ?? 0) === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Aún no se ha enviado ningún mensaje en este torneo.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.data!.messages.map((m: TournamentMessage) => (
              <li key={m.id} className="py-3 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-foreground break-words">{m.title}</p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{sentAt(m.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground break-words">{m.body}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.sentBy.name} · {m.recipientCount} {m.recipientCount === 1 ? "jugador" : "jugadores"} ·{" "}
                  {m.categories.map(categoryLabel).join(", ") || "categorías borradas"}
                  {m.includeWaitlist && " · con lista de espera"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={confirming}
        title="¿Enviar el mensaje?"
        description={`Llegará al móvil de ${recipientCount ?? 0} ${recipientCount === 1 ? "jugador" : "jugadores"} y no se puede retirar.`}
        confirmLabel="Enviar"
        loading={send.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() => send.mutate()}
      />
    </div>
  );
}
