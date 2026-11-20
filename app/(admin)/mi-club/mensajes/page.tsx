/**
 * /mi-club/mensajes — el club escribe a un grupo de sus clientes («cerramos el
 * sábado por el torneo»): a todos, a los socios, a los de una etiqueta, a un
 * nivel o a quien lleva N días sin reservar. Antes de enviar se ve a cuántos
 * llega y por qué canal (notificación en la app y/o email); abajo, el
 * historial de lo enviado. Quien se da de baja desde el email no recibe más.
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { CATEGORY_LABEL } from "@/lib/constants";
import { clubCustomersQK, clubCustomersService } from "@/lib/services/club-customers";
import {
  CLUB_MESSAGE_BODY_MAX,
  CLUB_MESSAGE_TITLE_MAX,
  clubMessagesQK,
  clubMessagesService,
  type ClubMessage,
  type ClubMessagePreview,
  type ClubMessageSegment,
} from "@/lib/services/club-messages";
import { useClubAccess } from "@/lib/use-club-access";
import { useRole, isClub } from "@/lib/use-role";
import { charCount } from "@/lib/utils/char-count";
import type { CategoryLevel } from "@/types";

const LEVELS = Object.keys(CATEGORY_LABEL) as CategoryLevel[];

const INPUT =
  "w-full h-10 max-[1024px]:h-11 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:border-[#D4AF37]";
const CHIP =
  "flex items-center gap-1.5 px-2.5 h-9 max-[1024px]:h-11 rounded-md border text-xs cursor-pointer transition-colors";
const BUTTON =
  "flex items-center justify-center gap-1.5 h-10 max-[1024px]:h-11 px-4 rounded-md text-sm font-semibold transition-colors disabled:opacity-50";

/** Fecha y hora del envío en hora de España. */
function sentAt(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function Counter({ value, max }: { value: string; max: number }) {
  const n = charCount(value.trim());
  return (
    <span className={`text-[11px] tabular-nums ${n > max ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
      {n}/{max}
    </span>
  );
}

/** Los filtros del formulario, en la forma que pide el back (solo los que filtran). */
function buildSegment(f: { members: boolean; tags: string[]; levels: string[]; inactiveDays: number | null }): ClubMessageSegment {
  const segment: ClubMessageSegment = {};
  if (f.members) segment.members = true;
  if (f.tags.length) segment.tags = f.tags;
  if (f.levels.length) segment.levels = f.levels;
  if (f.inactiveDays) segment.inactiveDays = f.inactiveDays;
  return segment;
}

/** Los filtros de un envío del historial, en una línea. */
function describeSegment(s: ClubMessageSegment): string {
  const parts: string[] = [];
  if (s.members) parts.push("socios");
  if (s.tags?.length) parts.push(`etiqueta ${s.tags.join(" o ")}`);
  if (s.levels?.length) parts.push(`nivel ${s.levels.map((l) => CATEGORY_LABEL[l as CategoryLevel] ?? l).join(" o ")}`);
  if (s.inactiveDays) parts.push(`sin reservar en ${s.inactiveDays} días`);
  return parts.length ? parts.join(" · ") : "todos los clientes";
}

export default function MensajesPage() {
  const { role, clubId } = useRole();
  // Escribir a los clientes es de quien escribe el área; quien solo lee ve lo enviado
  const canWrite = useClubAccess().can("customers", "write");
  const qc = useQueryClient();
  const enabled = !!clubId && isClub(role);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sendPush, setSendPush] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [members, setMembers] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [inactiveOn, setInactiveOn] = useState(false);
  const [inactiveText, setInactiveText] = useState("30");
  const [preview, setPreview] = useState<{ key: string; data: ClubMessagePreview } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [page, setPage] = useState(1);

  const inactiveNumber = Number(inactiveText);
  const inactiveValid = Number.isInteger(inactiveNumber) && inactiveNumber >= 1 && inactiveNumber <= 3650;
  const segment = buildSegment({ members, tags, levels, inactiveDays: inactiveOn && inactiveValid ? inactiveNumber : null });
  const segmentKey = JSON.stringify(segment);
  // El recuento solo vale para los filtros con que se pidió
  const currentPreview = preview && preview.key === segmentKey ? preview.data : null;

  const tagsQuery = useQuery({
    queryKey: clubCustomersQK.tags(clubId ?? ""),
    queryFn: () => clubCustomersService.tags(clubId!),
    enabled,
  });
  const history = useQuery({
    queryKey: clubMessagesQK.list(clubId ?? "", page),
    queryFn: () => clubMessagesService.list(clubId!, page),
    enabled,
    placeholderData: (prev) => prev,
  });

  const previewMutation = useMutation({
    mutationFn: () => clubMessagesService.preview(clubId!, segment),
    onSuccess: (data) => setPreview({ key: segmentKey, data }),
    onError: (e: Error) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () =>
      clubMessagesService.send(clubId!, {
        title: title.trim(),
        body: body.trim(),
        sendPush,
        sendEmail,
        segment,
      }),
    onSuccess: (sent) => {
      toast.success(`Mensaje enviado a ${plural(sent.recipientCount, "cliente", "clientes")}`);
      setTitle("");
      setBody("");
      setPreview(null);
      setConfirming(false);
      setPage(1);
      void qc.invalidateQueries({ queryKey: clubMessagesQK.all(clubId!) });
    },
    onError: (e: Error) => {
      setConfirming(false);
      toast.error(e.message);
    },
  });

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
        <Header title="Mensajes" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const titleOk = title.trim() !== "" && charCount(title.trim()) <= CLUB_MESSAGE_TITLE_MAX;
  const bodyOk = body.trim() !== "" && charCount(body.trim()) <= CLUB_MESSAGE_BODY_MAX;
  const channelOk = sendPush || sendEmail;
  const filtersOk = !inactiveOn || inactiveValid;
  // Con el recuento a la vista, alguien tiene que poder recibirlo por el canal elegido
  const reachable = currentPreview
    ? (sendPush ? currentPreview.withPush : 0) + (sendEmail ? currentPreview.withEmail : 0)
    : 0;
  const canPreview = filtersOk && !previewMutation.isPending;
  const canSend = titleOk && bodyOk && channelOk && filtersOk && !!currentPreview && reachable > 0 && !send.isPending;

  const items = history.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((history.data?.total ?? 0) / (history.data?.pageSize ?? 20)));

  return (
    <>
      <Header title="Mensajes" />
      <div className={`p-4 sm:p-6 grid grid-cols-1 gap-5 ${canWrite ? "xl:grid-cols-2" : ""}`}>
        {/* ── Formulario: solo para quien puede escribir a los clientes ── */}
        {canWrite && (
          <section className="bg-card border border-border rounded-xl p-5 space-y-4 self-start" aria-labelledby="msg-form-title">
            <div>
              <h2 id="msg-form-title" className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Megaphone size={14} className="text-[#D4AF37]" /> Nuevo mensaje a tus clientes
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Avisa de un cierre, un torneo o una liga. Llega como notificación en la app a quien la tiene y como email;
                cada email lleva un enlace para darse de baja.
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="msg-title" className="text-xs font-medium text-foreground">Título</label>
                <Counter value={title} max={CLUB_MESSAGE_TITLE_MAX} />
              </div>
              <input
                id="msg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej.: Cerramos el sábado por el torneo"
                className={INPUT}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="msg-body" className="text-xs font-medium text-foreground">Texto</label>
                <Counter value={body} max={CLUB_MESSAGE_BODY_MAX} />
              </div>
              <textarea
                id="msg-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Ej.: El sábado las pistas estarán ocupadas por el torneo. Volvemos a abrir el domingo a las 9:00."
                className="w-full px-3 py-2 rounded-md bg-background border border-border text-sm text-foreground resize-y focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-foreground">Por dónde se manda</legend>
              <div className="flex flex-wrap gap-2">
                <label className={`${CHIP} ${sendPush ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>
                  <input type="checkbox" checked={sendPush} onChange={(e) => setSendPush(e.target.checked)} className="accent-[#D4AF37]" />
                  Notificación en la app
                </label>
                <label className={`${CHIP} ${sendEmail ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="accent-[#D4AF37]" />
                  Email
                </label>
              </div>
              {!channelOk && <p className="text-xs text-destructive">Elige al menos un canal.</p>}
            </fieldset>

            <fieldset className="space-y-3 border-t border-border pt-4">
              <legend className="text-xs font-medium text-foreground">A quién (todos los filtros a la vez; sin filtros, a todos)</legend>

              <label className={`${CHIP} w-fit ${members ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>
                <input type="checkbox" checked={members} onChange={(e) => setMembers(e.target.checked)} className="accent-[#D4AF37]" />
                Solo socios
              </label>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Etiquetas (los que tengan alguna)</p>
                {tagsQuery.isLoading ? (
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                ) : (tagsQuery.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aún no has puesto etiquetas a tus clientes.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(tagsQuery.data ?? []).map((t) => (
                      <label key={t} className={`${CHIP} ${tags.includes(t) ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>
                        <input type="checkbox" checked={tags.includes(t)} onChange={() => toggle(tags, setTags, t)} className="accent-[#D4AF37]" />
                        {t}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Nivel del jugador (solo los que tienen la app)</p>
                <div className="flex flex-wrap gap-2">
                  {LEVELS.map((l) => (
                    <label key={l} className={`${CHIP} ${levels.includes(l) ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>
                      <input type="checkbox" checked={levels.includes(l)} onChange={() => toggle(levels, setLevels, l)} className="accent-[#D4AF37]" />
                      {CATEGORY_LABEL[l]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className={`${CHIP} ${inactiveOn ? "border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10" : "border-border text-muted-foreground"}`}>
                  <input type="checkbox" checked={inactiveOn} onChange={(e) => setInactiveOn(e.target.checked)} className="accent-[#D4AF37]" />
                  Sin reservar en los últimos
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  aria-label="Días sin reservar"
                  value={inactiveText}
                  disabled={!inactiveOn}
                  onChange={(e) => setInactiveText(e.target.value)}
                  className={`${INPUT} !w-24 disabled:opacity-50`}
                />
                <span className="text-xs text-muted-foreground">días</span>
                {inactiveOn && !inactiveValid && <span className="text-xs text-destructive">Entre 1 y 3650 días.</span>}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground flex items-start gap-1.5" aria-live="polite">
                <Users size={12} className="mt-0.5 shrink-0" />
                {previewMutation.isPending ? (
                  "Contando clientes…"
                ) : currentPreview ? (
                  currentPreview.recipients === 0 ? (
                    "Ningún cliente cumple esos filtros."
                  ) : (
                    <span>
                      Llegará a <strong className="text-foreground">{plural(currentPreview.recipients, "cliente", "clientes")}</strong>:{" "}
                      {plural(currentPreview.withPush, "con la app", "con la app")} y{" "}
                      {plural(currentPreview.withEmail, "con email", "con email")}.
                      {channelOk && reachable === 0 && " Por los canales elegidos no llega a nadie."}
                    
                      {(currentPreview.withoutContact ?? 0) > 0 && (
                        <span className="block text-amber-500">
                          {plural(currentPreview.withoutContact!, "cliente", "clientes")} sin app ni email: no recibirán nada.
                        </span>
                      )}
                      {(currentPreview.viaGuardian ?? 0) > 0 && (
                        <span className="block">
                          {plural(currentPreview.viaGuardian!, "menor de 14", "menores de 14")}: el mensaje va por email a su tutor.
                        </span>
                      )}
                      {(currentPreview.excluded ?? 0) > 0 && (
                        <span className="block">
                          {plural(currentPreview.excluded!, "cliente queda", "clientes quedan")} fuera: de baja o menor de 14 sin consentimiento del tutor.
                        </span>
                      )}
                    </span>
                  )
                ) : (
                  "Pulsa «Ver a cuántos llega» antes de enviar."
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => previewMutation.mutate()}
                  disabled={!canPreview}
                  className={`${BUTTON} border border-border text-foreground hover:bg-secondary`}
                >
                  {previewMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                  Ver a cuántos llega
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={!canSend}
                  className={`${BUTTON} bg-[#D4AF37] text-[#0C0C0C] hover:bg-[#C49F2A]`}
                >
                  {send.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Enviar
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ── Historial ── */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-3" aria-labelledby="msg-history-title">
          <h2 id="msg-history-title" className="text-sm font-semibold text-foreground">Mensajes enviados</h2>
          {history.isError ? (
            <ErrorState message="No se pudo cargar el historial." onRetry={() => void history.refetch()} />
          ) : history.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {canWrite ? "Aún no has enviado ningún mensaje." : "El club aún no ha enviado ningún mensaje."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-semibold">Fecha</th>
                    <th className="px-2 py-2 font-semibold">Mensaje</th>
                    <th className="px-2 py-2 font-semibold text-right">Clientes</th>
                    <th className="px-2 py-2 font-semibold text-right">Push</th>
                    <th className="px-2 py-2 font-semibold text-right">Emails</th>
                    <th className="px-2 py-2 font-semibold text-right">Fallidos</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m: ClubMessage) => (
                    <tr key={m.id} className="border-b border-border last:border-0 align-top">
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-muted-foreground">{sentAt(m.createdAt)}</td>
                      <td className="px-2 py-2">
                        <p className="font-medium text-foreground break-words">{m.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {m.sentBy.name} · {describeSegment(m.segment)}
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{m.recipientCount}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{m.sendPush ? m.pushCount : "—"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{m.sendEmail ? m.emailCount : "—"}{m.sendEmail && m.emailPendingCount > 0 ? <span className="ml-1 text-xs text-muted-foreground">(+{m.emailPendingCount} pendientes)</span> : null}</td>
                      <td className={`px-2 py-2 text-right tabular-nums ${m.emailFailedCount > 0 ? "text-destructive" : ""}`}>
                        {m.sendEmail ? m.emailFailedCount : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-9 max-[1024px]:h-11 px-3 rounded-md border border-border hover:bg-secondary disabled:opacity-50"
              >
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-9 max-[1024px]:h-11 px-3 rounded-md border border-border hover:bg-secondary disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            «Fallidos» son emails que no se pudieron mandar. Los emails salen poco a poco: las cifras pueden tardar unos
            minutos en completarse.
          </p>
        </section>
      </div>

      {canWrite && (
        <ConfirmModal
          open={confirming}
          title={`Enviar a ${plural(currentPreview?.recipients ?? 0, "cliente", "clientes")}`}
          description={`«${title.trim()}» se mandará ${[sendPush && "como notificación en la app", sendEmail && "por email"].filter(Boolean).join(" y ")}. No se puede retirar.`}
          confirmLabel="Enviar"
          loading={send.isPending}
          onClose={() => { if (!send.isPending) setConfirming(false); }}
          onConfirm={() => send.mutate()}
        />
      )}
    </>
  );
}
