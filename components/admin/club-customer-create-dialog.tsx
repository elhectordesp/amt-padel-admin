"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Field, Input } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { adminService } from "@/lib/services/admin";
import {
  clubCustomersQK,
  clubCustomersService,
  type ClubCustomer,
  type CreateClubCustomerPayload,
} from "@/lib/services/club-customers";
import { ADULT_AGE, GUARDIAN_CONSENT_AGE, ageOn } from "@/lib/utils/customer-age";
import { localDayKey } from "@/lib/utils/date-keys";
import type { Player } from "@/types";

interface Props {
  open:    boolean;
  clubId:  string;
  onClose: () => void;
  onDone:  (customer: ClubCustomer) => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * «Nuevo cliente»: quien no tiene la app (nombre y teléfono o email) o, si ya
 * juega en AMT, se busca su cuenta y el contacto se lee de ella. Con una fecha
 * de nacimiento de menor aparecen los datos de su padre, madre o tutor y, si
 * ya ha consentido, se deja constancia al darlo de alta.
 */
export function ClubCustomerCreateDialog({ open, clubId, onClose, onDone }: Props) {
  const qc = useQueryClient();
  const [withAccount, setWithAccount] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [picked, setPicked] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  // El back no enlaza una cuenta sin trato previo con el club (409): se propone el alta sin cuenta
  const [noRelation, setNoRelation] = useState(false);

  // Solo un aviso para el formulario: el servidor cuenta la edad con la zona del club
  const age = birthDate ? ageOn(birthDate, localDayKey(new Date())) : null;
  const isMinor = age !== null && age >= 0 && age < ADULT_AGE;

  const create = useMutation({
    mutationFn: async () => {
      const payload: CreateClubCustomerPayload = withAccount
        ? { userId: picked!.id }
        : { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined };
      if (birthDate) payload.birthDate = birthDate;
      if (isMinor) {
        if (guardianName.trim()) payload.guardianName = guardianName.trim();
        if (guardianPhone.trim()) payload.guardianPhone = guardianPhone.trim();
        if (guardianEmail.trim()) payload.guardianEmail = guardianEmail.trim();
      }
      const customer = await clubCustomersService.create(clubId, payload);
      if (!(isMinor && consent)) return customer;
      try {
        return await clubCustomersService.markGuardianConsent(clubId, customer.id);
      } catch (e) {
        // El cliente ya está creado: se avisa y se sigue; el consentimiento se apunta desde su ficha
        toast.error(`Cliente añadido, pero no se pudo apuntar el consentimiento (${(e as Error).message}). Hazlo desde su ficha.`);
        return customer;
      }
    },
    onSuccess: (customer) => {
      void qc.invalidateQueries({ queryKey: clubCustomersQK.all(clubId) });
      toast.success("Cliente añadido");
      onDone(customer);
    },
    onError: (e: Error) => {
      setNoRelation(e instanceof ApiError && e.code === "CLUB_CUSTOMER_NO_RELATION");
      setError(e.message);
    },
  });

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNoRelation(false);
    const hasGuardianContact = isMinor && (!!guardianPhone.trim() || !!guardianEmail.trim());
    if (withAccount) {
      if (!picked) return setError("Elige a la persona de la lista");
    } else {
      if (!name.trim()) return setError("Escribe el nombre");
      if (!phone.trim() && !email.trim() && !hasGuardianContact)
        return setError(
          isMinor
            ? "Escribe un teléfono o un email, el suyo o el de su tutor, para poder localizarlo"
            : "Escribe un teléfono o un email para poder localizarlo",
        );
      if (email.trim() && !EMAIL.test(email.trim())) return setError("El email no es válido");
    }
    if (birthDate && age !== null && age < 0) return setError("La fecha de nacimiento no puede ser futura");
    if (isMinor) {
      if (guardianEmail.trim() && !EMAIL.test(guardianEmail.trim())) return setError("El email del tutor no es válido");
      if (consent && !guardianName.trim()) return setError("Escribe el nombre del tutor que ha dado su consentimiento");
    }
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div role="dialog" aria-label="Nuevo cliente" className="bg-card border border-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading text-lg">Nuevo cliente</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="flex gap-2">
            <ModeButton active={!withAccount} onClick={() => setWithAccount(false)}>No tiene la app</ModeButton>
            <ModeButton active={withAccount} onClick={() => setWithAccount(true)}>Ya juega en AMT</ModeButton>
          </div>

          {withAccount ? (
            <AccountPicker picked={picked} onPick={setPicked} />
          ) : (
            <>
              <Field label="Nombre">
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
              </Field>
              <Field label="Teléfono">
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
              </Field>
              <Field label="Email (opcional)">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />
              </Field>
            </>
          )}

          <Field label="Fecha de nacimiento (opcional)">
            <Input
              type="date"
              aria-label="Fecha de nacimiento"
              value={birthDate}
              max={localDayKey(new Date())}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </Field>

          {isMinor && (
            <fieldset className="space-y-3 rounded-lg border border-border p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tutor · tiene {age} {age === 1 ? "año" : "años"}
              </legend>
              <Field label="Nombre del padre, madre o tutor">
                <Input aria-label="Nombre del tutor" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} maxLength={120} />
              </Field>
              <Field label="Teléfono del tutor">
                <Input aria-label="Teléfono del tutor" type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} maxLength={30} />
              </Field>
              <Field label="Email del tutor">
                <Input aria-label="Email del tutor" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} maxLength={254} />
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  El tutor ha dado su consentimiento
                  {age !== null && age < GUARDIAN_CONSENT_AGE && (
                    <span className="block text-xs text-muted-foreground">
                      Es obligatorio por debajo de {GUARDIAN_CONSENT_AGE} años: sin él, el club no le enviará mensajes.
                    </span>
                  )}
                </span>
              </label>
            </fieldset>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {noRelation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setWithAccount(false);
                setPicked(null);
                setError(null);
                setNoRelation(false);
              }}
            >
              Darlo de alta sin cuenta
            </Button>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Añadir cliente
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/** Busca una cuenta de jugador por nombre o email. */
function AccountPicker({ picked, onPick }: { picked: Player | null; onPick: (p: Player | null) => void }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const query = useQuery({
    queryKey: ["players-search", debounced],
    queryFn: () => adminService.players.search(debounced),
    enabled: debounced.length >= 2 && !picked,
    staleTime: 30_000,
  });

  if (picked) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
        <span className="font-medium">{picked.name}</span>
        <button type="button" onClick={() => onPick(null)} className="text-xs text-muted-foreground hover:text-foreground">Cambiar</button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          aria-label="Buscar jugador"
          placeholder="Buscar por nombre o email…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm text-foreground"
        />
      </div>
      {debounced.length >= 2 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background">
          {query.isLoading ? (
            <div className="flex items-center justify-center p-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : (query.data ?? []).length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Sin resultados.</p>
          ) : (
            <ul>
              {(query.data ?? []).slice(0, 8).map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onPick(p)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-medium">{p.name}</span>
                    {p.email && <span className="text-xs text-muted-foreground">{p.email}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
