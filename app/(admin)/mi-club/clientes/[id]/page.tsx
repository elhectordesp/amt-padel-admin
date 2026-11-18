/**
 * /mi-club/clientes/[id] — ficha de un cliente del club: contacto, fecha de
 * nacimiento, si es socio (número y fecha de alta), etiquetas, notas privadas
 * del club, sus bonos de reservas (vender, cobrar, cancelar; solo con acceso
 * a la caja) y sus reservas y torneos en el club. Con cuenta AMT, el contacto
 * es el de su cuenta y no se edita aquí; sin cuenta, sí.
 *
 * Si es menor de edad aparece su tutor (padre, madre o tutor legal) y, por
 * debajo de 14 años, el aviso de que falta su consentimiento, que el club
 * apunta aquí (quién y cuándo quedan en el historial).
 */

"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AlertTriangle, Archive, ArchiveRestore, Loader2, Save, UserX } from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CustomerVouchersSection } from "@/components/admin/customer-vouchers-section";
import { ErrorState } from "@/components/admin/error-state";
import { Field, Input } from "@/components/admin/form";
import { ReservasPage } from "@/components/admin/reservas-page";
import { TagInput } from "@/components/admin/tag-input";
import { Button } from "@/components/ui/button";
import { categoryLabel } from "@/lib/category-gender";
import {
  clubCustomersQK,
  clubCustomersService,
  type ClubCustomerDetail,
  type UpdateClubCustomerPayload,
} from "@/lib/services/club-customers";
import { isOwnerOrManager } from "@/lib/club-permissions";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useRole, isClub } from "@/lib/use-role";
import { formatCents } from "@/lib/utils/booking-price";
import { GUARDIAN_CONSENT_AGE } from "@/lib/utils/customer-age";
import { localDayKey } from "@/lib/utils/date-keys";
import { formatDayKey, formatInTimeZone } from "@/lib/utils/time-zone";

const BACK = { href: "/mi-club/clientes", label: "Volver a Clientes" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Lo que se teclea para confirmar que se anonimiza al cliente (no se deshace). */
const ANONYMIZE_WORD = "ANONIMIZAR";

const BOOKING_STATUS: Record<string, string> = {
  PENDING_INVITES: "Esperando invitaciones",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  WITHOUT_RESULT: "Sin resultado",
};

const REGISTRATION_STATUS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  WAITLIST: "En lista de espera",
  CANCELLED: "Cancelada",
};

type Tab = "bookings" | "tournaments";

export default function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { role, clubId } = useRole();
  const enabled = !!clubId && isClub(role);
  const clubTimeZone = useClubTimeZone(clubId, enabled);

  const query = useQuery({
    queryKey: clubCustomersQK.detail(clubId ?? "", id),
    queryFn: () => clubCustomersService.detail(clubId!, id),
    enabled,
  });

  if (role === null || (enabled && query.isLoading)) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!enabled) {
    return (
      <ReservasPage title="Cliente" back={BACK}>
        <p className="mt-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </ReservasPage>
    );
  }
  if (query.isError || !query.data) {
    return (
      <ReservasPage title="Cliente" back={BACK}>
        <ErrorState message="No se pudo cargar el cliente." onRetry={() => void query.refetch()} />
      </ReservasPage>
    );
  }

  // `key`: si llega otra versión (tras guardar), los formularios se rehacen con ella
  return (
    <CustomerView
      key={`${query.data.id}:${query.dataUpdatedAt}`}
      clubId={clubId!}
      customer={query.data}
      timeZone={clubTimeZone.timeZone}
    />
  );
}

function CustomerView({
  clubId, customer: c, timeZone,
}: { clubId: string; customer: ClubCustomerDetail; timeZone: string | null }) {
  const qc = useQueryClient();
  const { can, roles } = useClubAccess();
  // Los bonos son dinero: solo los ve quien puede leer la caja
  const canSeeVouchers = can("cash", "read");
  // Un cliente anonimizado ya no se edita (el back responde 409)
  const anonymized = !!c.anonymized;
  // Quien solo lee los clientes ve la ficha, sin formularios ni botones
  const canWrite = can("customers", "write") && !anonymized;
  // Anonimizar no tiene área propia: solo propietario y gestor
  const canAnonymize = isOwnerOrManager(roles) && !anonymized;
  const [anonymizeOpen, setAnonymizeOpen] = useState(false);
  const [anonymizeWord, setAnonymizeWord] = useState("");
  const [tab, setTab] = useState<Tab>("bookings");
  const [notes, setNotes] = useState(c.notes ?? "");
  const [isMember, setIsMember] = useState(c.isMember);
  const [memberNumber, setMemberNumber] = useState(c.memberNumber ?? "");
  const [memberSince, setMemberSince] = useState(c.memberSince ?? "");
  const [name, setName] = useState(c.name ?? "");
  const [phone, setPhone] = useState(c.phone ?? "");
  const [email, setEmail] = useState(c.email ?? "");
  const [birthDate, setBirthDate] = useState(c.birthDate ?? "");
  const [guardianName, setGuardianName] = useState(c.guardianName ?? "");
  const [guardianPhone, setGuardianPhone] = useState(c.guardianPhone ?? "");
  const [guardianEmail, setGuardianEmail] = useState(c.guardianEmail ?? "");

  const tagsQuery = useQuery({
    queryKey: clubCustomersQK.tags(clubId),
    queryFn: () => clubCustomersService.tags(clubId),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: clubCustomersQK.all(clubId) });
  };
  const save = useMutation({
    mutationFn: (data: UpdateClubCustomerPayload) => clubCustomersService.update(clubId, c.id, data),
    onSuccess: () => { toast.success("Guardado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: () => (c.archivedAt ? clubCustomersService.unarchive(clubId, c.id) : clubCustomersService.archive(clubId, c.id)),
    onSuccess: () => { toast.success(c.archivedAt ? "Cliente recuperado" : "Cliente archivado"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeAnonymize = () => {
    setAnonymizeOpen(false);
    setAnonymizeWord("");
  };
  const anonymize = useMutation({
    mutationFn: () => clubCustomersService.anonymize(clubId, c.id),
    onSuccess: () => {
      toast.success("Cliente anonimizado");
      closeAnonymize();
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Apuntar o quitar el consentimiento del tutor (el servidor guarda quién y cuándo en el historial)
  const consent = useMutation({
    mutationFn: (give: boolean) =>
      give ? clubCustomersService.markGuardianConsent(clubId, c.id) : clubCustomersService.clearGuardianConsent(clubId, c.id),
    onSuccess: (_data, give) => {
      toast.success(give ? "Consentimiento del tutor apuntado" : "Consentimiento del tutor quitado");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBirth = () => {
    if (birthDate && birthDate > localDayKey(new Date())) return toast.error("La fecha de nacimiento no puede ser futura");
    save.mutate({ birthDate: birthDate || null });
  };
  const saveGuardian = () => {
    if (guardianEmail.trim() && !EMAIL.test(guardianEmail.trim())) return toast.error("El email del tutor no es válido");
    save.mutate({
      guardianName: guardianName.trim() || null,
      guardianPhone: guardianPhone.trim() || null,
      guardianEmail: guardianEmail.trim() || null,
    });
  };
  const consentDate =
    c.guardianConsentAt && timeZone
      ? formatInTimeZone(c.guardianConsentAt, timeZone, { day: "numeric", month: "numeric", year: "numeric" })
      : null;

  const saveContact = () => {
    if (!name.trim()) return toast.error("El nombre no puede quedar vacío");
    if (!phone.trim() && !email.trim()) return toast.error("Deja un teléfono o un email para poder localizarlo");
    save.mutate({ name: name.trim(), phone: phone.trim() || null, email: email.trim() || null });
  };
  const saveMember = () => {
    if (isMember && memberSince && !/^\d{4}-\d{2}-\d{2}$/.test(memberSince)) return toast.error("La fecha de alta no es válida");
    save.mutate(
      isMember
        ? { isMember: true, memberNumber: memberNumber.trim() || null, memberSince: memberSince || null }
        : { isMember: false },
    );
  };

  return (
    <ReservasPage title={c.name ?? "Cliente"} back={BACK} className="max-w-4xl">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {c.hasAccount ? "Tiene cuenta en la app de AMT" : "No tiene la app"}
          {c.archivedAt && " · Archivado"}
          {c.messagesOptOutAt && " · No recibe mensajes del club"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => archive.mutate()} disabled={archive.isPending}>
              {c.archivedAt ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              {c.archivedAt ? "Recuperar cliente" : "Archivar cliente"}
            </Button>
          )}
          {canAnonymize && (
            <Button variant="outline" size="sm" onClick={() => setAnonymizeOpen(true)}>
              <UserX className="h-3.5 w-3.5" /> Anonimizar cliente
            </Button>
          )}
        </div>
      </div>

      {anonymized && (
        <div role="status" className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">
          <p className="font-medium">Cliente anonimizado</p>
          <p className="text-xs text-muted-foreground">
            Se borraron sus datos personales y ya no se puede editar. Se conservan sus reservas, cobros, bonos, cuotas y asistencia.
          </p>
        </div>
      )}

      {c.guardianConsentMissing && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3"
        >
          <div className="flex min-w-0 flex-1 basis-64 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium">Falta el consentimiento del tutor</p>
              <p className="text-xs text-muted-foreground">
                Es menor de {GUARDIAN_CONSENT_AGE} años: hasta que lo apuntes, el club no le enviará mensajes.
                {canWrite && !c.guardianName && " Apunta antes el nombre del tutor, abajo."}
              </p>
            </div>
          </div>
          {canWrite && (
            <Button size="sm" onClick={() => consent.mutate(true)} disabled={consent.isPending || !c.guardianName}>
              {consent.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Marcar consentimiento
            </Button>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Contacto">
          {c.hasAccount || !canWrite ? (
            <>
              <Row label="Nombre" value={c.name} />
              <Row label="Teléfono" value={c.phone} />
              <Row label="Email" value={c.email} />
              {c.hasAccount && (
                <p className="text-xs text-muted-foreground">
                  Es el contacto de su cuenta de AMT. Si lo cambia en su perfil, aquí se actualiza solo.
                </p>
              )}
            </>
          ) : (
            <>
              <Field label="Nombre"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
              <Field label="Teléfono"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} /></Field>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} /></Field>
              <Button size="sm" onClick={saveContact} disabled={save.isPending}><Save className="h-3.5 w-3.5" /> Guardar contacto</Button>
            </>
          )}
        </Card>

        <Card title="Socio del club">
          {canWrite ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isMember} onChange={(e) => setIsMember(e.target.checked)} />
                Es socio
              </label>
              {isMember && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Número de socio"><Input value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} maxLength={30} /></Field>
                  <Field label="Fecha de alta"><Input type="date" value={memberSince} onChange={(e) => setMemberSince(e.target.value)} /></Field>
                </div>
              )}
              {isMember && !c.isMember && (
                <p className="text-xs text-muted-foreground">Si no pones fecha de alta, se apunta la de hoy.</p>
              )}
              <Button size="sm" onClick={saveMember} disabled={save.isPending}><Save className="h-3.5 w-3.5" /> Guardar socio</Button>
            </>
          ) : (
            <>
              <Row label="Socio" value={c.isMember ? "Sí" : "No"} />
              {c.isMember && <Row label="Número de socio" value={c.memberNumber} />}
              {c.isMember && (
                <Row
                  label="Fecha de alta"
                  value={c.memberSince ? formatDayKey(c.memberSince, { day: "numeric", month: "numeric", year: "numeric" }) : null}
                />
              )}
            </>
          )}
        </Card>

        <Card title="Nacimiento">
          {canWrite ? (
            <>
              <Field label="Fecha de nacimiento">
                <Input
                  type="date"
                  aria-label="Fecha de nacimiento"
                  value={birthDate}
                  max={localDayKey(new Date())}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </Field>
              <Button size="sm" onClick={saveBirth} disabled={save.isPending}><Save className="h-3.5 w-3.5" /> Guardar nacimiento</Button>
            </>
          ) : (
            <Row
              label="Fecha de nacimiento"
              value={c.birthDate ? formatDayKey(c.birthDate, { day: "numeric", month: "numeric", year: "numeric" }) : null}
            />
          )}
          {c.isMinor && typeof c.age === "number" && (
            <p className="text-xs text-muted-foreground">Menor de edad: tiene {c.age} {c.age === 1 ? "año" : "años"}.</p>
          )}
        </Card>

        {c.isMinor && (
          <Card title="Tutor">
            {canWrite ? (
              <>
                <Field label="Nombre del padre, madre o tutor">
                  <Input aria-label="Nombre del tutor" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} maxLength={120} />
                </Field>
                <Field label="Teléfono">
                  <Input aria-label="Teléfono del tutor" type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} maxLength={30} />
                </Field>
                <Field label="Email">
                  <Input aria-label="Email del tutor" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} maxLength={254} />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Si es menor de {GUARDIAN_CONSENT_AGE} años, los mensajes del club le llegan a este email. Si quitas el nombre del tutor, se quita también su consentimiento.
                </p>
                <Button size="sm" onClick={saveGuardian} disabled={save.isPending}><Save className="h-3.5 w-3.5" /> Guardar tutor</Button>
              </>
            ) : (
              <>
                <Row label="Nombre" value={c.guardianName ?? null} />
                <Row label="Teléfono" value={c.guardianPhone ?? null} />
                <Row label="Email" value={c.guardianEmail ?? null} />
              </>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
              {c.guardianConsentAt ? (
                <span>Consentimiento del tutor: dado{consentDate ? ` el ${consentDate}` : ""}</span>
              ) : (
                <span className="text-muted-foreground">
                  Consentimiento del tutor: sin apuntar
                  {!c.guardianConsentRequired && ` (no es obligatorio desde los ${GUARDIAN_CONSENT_AGE} años)`}
                </span>
              )}
              {canWrite && c.guardianConsentAt && (
                <Button size="sm" variant="outline" onClick={() => consent.mutate(false)} disabled={consent.isPending}>
                  Quitar consentimiento
                </Button>
              )}
              {canWrite && !c.guardianConsentAt && !c.guardianConsentRequired && (
                <Button size="sm" variant="outline" onClick={() => consent.mutate(true)} disabled={consent.isPending || !c.guardianName}>
                  Marcar consentimiento
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card title="Etiquetas">
          <TagInput
            tags={c.tags}
            suggestions={tagsQuery.data ?? []}
            disabled={save.isPending}
            readOnly={!canWrite}
            onChange={(tags) => save.mutate({ tags })}
          />
        </Card>

        <Card title="Notas privadas del club">
          {canWrite ? (
            <>
              <textarea
                aria-label="Notas privadas del club"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Lo que quieras recordar de esta persona. Solo lo ve tu club."
                className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37]"
              />
              <Button size="sm" onClick={() => save.mutate({ notes: notes.trim() || null })} disabled={save.isPending}>
                <Save className="h-3.5 w-3.5" /> Guardar notas
              </Button>
            </>
          ) : c.notes ? (
            <p className="whitespace-pre-wrap text-sm">{c.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin notas.</p>
          )}
        </Card>
      </div>

      {canSeeVouchers && timeZone && (
        <div className="mt-4">
          <CustomerVouchersSection clubId={clubId} customerId={c.id} timeZone={timeZone} />
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <TabButton active={tab === "bookings"} onClick={() => setTab("bookings")}>Reservas</TabButton>
        <TabButton active={tab === "tournaments"} onClick={() => setTab("tournaments")}>Torneos</TabButton>
      </div>

      <div className="mt-3 space-y-2">
        {tab === "bookings" ? (
          c.bookings.length === 0 ? (
            <Empty>Todavía no tiene reservas en tu club.</Empty>
          ) : (
            <>
              {c.bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/mi-club/reservas/bookings/${b.id}`}
                  className="block rounded-lg border border-border bg-card p-3 text-sm hover:bg-card/70"
                >
                  <div className="font-medium">
                    {b.court?.name ?? "Pista"} ·{" "}
                    {timeZone
                      ? formatInTimeZone(b.startsAt, timeZone, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {BOOKING_STATUS[b.status] ?? b.status} · {formatCents(b.priceCents)}
                    {b.paidAt && " · pagada"}
                  </div>
                </Link>
              ))}
              {c.bookings.length === 20 && (
                <p className="text-xs text-muted-foreground">Se enseñan las 20 últimas reservas.</p>
              )}
            </>
          )
        ) : c.registrations.length === 0 ? (
          <Empty>{c.hasAccount ? "Todavía no se ha inscrito en torneos de tu club." : "Sin cuenta no puede inscribirse en torneos desde la app."}</Empty>
        ) : (
          c.registrations.map((r) => (
            <Link
              key={r.id}
              href={`/torneos/${r.tournament.id}`}
              className="block rounded-lg border border-border bg-card p-3 text-sm hover:bg-card/70"
            >
              <div className="font-medium">{r.tournament.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {categoryLabel(r.category)} · {REGISTRATION_STATUS[r.status] ?? r.status}
              </div>
            </Link>
          ))
        )}
      </div>

      <ConfirmModal
        open={anonymizeOpen}
        title="Anonimizar cliente"
        description="Se borran para siempre su nombre, contacto, fecha de nacimiento, tutor, notas y etiquetas, y se suelta su cuenta de la app (la cuenta no se toca). No se puede deshacer. Se conservan sus reservas, cobros, bonos, cuotas y asistencia."
        confirmLabel="Anonimizar"
        danger
        loading={anonymize.isPending}
        confirmDisabled={anonymizeWord.trim() !== ANONYMIZE_WORD}
        onClose={() => {
          if (!anonymize.isPending) closeAnonymize();
        }}
        onConfirm={() => anonymize.mutate()}
      >
        <Field label={`Para confirmar, escribe ${ANONYMIZE_WORD}`}>
          <Input
            aria-label="Palabra de confirmación"
            value={anonymizeWord}
            onChange={(e) => setAnonymizeWord(e.target.value)}
            autoComplete="off"
          />
        </Field>
      </ConfirmModal>
    </ReservasPage>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="font-heading text-base">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
