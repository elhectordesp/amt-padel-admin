"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ME_QUERY_KEY, roleLabel, useMe } from "@/lib/use-me";
import {
  MY_PROFILE_QUERY_KEY, PASSWORD_RULES,
  accountErrorMessage, changePassword, initialProfileForm, passwordProblem,
  profileProblems, updateMyProfile,
  type MyProfile, type ProfileField,
} from "@/lib/account";

const inputCls =
  "w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-60";

function FieldError({ text }: { text?: string | null }) {
  return text ? <p className="text-[11px] text-destructive">{text}</p> : null;
}

// ── Datos de la cuenta ──────────────────────────────────────────────────────

/** Nombre, apellidos y teléfono de la cuenta (el email y el rol, solo a la vista). */
export function ProfileForm({ profile }: { profile: MyProfile }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const initial = initialProfileForm(profile);
  const [form, setForm] = useState(initial);
  const [touched, setTouched] = useState(false);
  const problems = profileProblems(form);
  const dirty = (Object.keys(initial) as ProfileField[]).some((k) => form[k].trim() !== initial[k].trim());

  const save = useMutation({
    mutationFn: () => updateMyProfile({
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      // Vaciarlo lo borra
      phone:     form.phone.trim() || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_PROFILE_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY }); // el nombre de la cabecera
      setTouched(false);
      toast.success("Datos guardados");
    },
    onError: (e: unknown) => toast.error(accountErrorMessage(e, "No se pudieron guardar los datos.")),
  });

  const set = (k: ProfileField, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(problems).length === 0) save.mutate();
  };

  return (
    <form onSubmit={onSubmit} className="bg-card border border-border rounded-lg p-5 space-y-4" noValidate>
      <div className="flex items-center gap-2">
        <UserRound size={16} className="text-[#D4AF37]" />
        <h2 className="text-sm font-semibold text-foreground">Datos de la cuenta</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="perfil-nombre" className="text-xs font-medium text-muted-foreground">Nombre</label>
          <input id="perfil-nombre" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} autoComplete="given-name" />
          <FieldError text={touched ? problems.firstName : null} />
        </div>
        <div className="space-y-1">
          <label htmlFor="perfil-apellidos" className="text-xs font-medium text-muted-foreground">Apellidos</label>
          <input id="perfil-apellidos" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Opcional" className={inputCls} autoComplete="family-name" />
          <FieldError text={touched ? problems.lastName : null} />
        </div>
        <div className="space-y-1">
          <label htmlFor="perfil-telefono" className="text-xs font-medium text-muted-foreground">Teléfono</label>
          <input id="perfil-telefono" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+34 600 000 000" className={inputCls} autoComplete="tel" />
          <FieldError text={touched ? problems.phone : null} />
        </div>
        <div className="space-y-1">
          <label htmlFor="perfil-email" className="text-xs font-medium text-muted-foreground">Email</label>
          <input id="perfil-email" value={profile.email ?? ""} disabled className={inputCls} />
          <p className="text-[11px] text-muted-foreground">Es con el que entras; no se cambia desde aquí.</p>
        </div>
      </div>

      {me?.role && (
        <p className="text-xs text-muted-foreground">
          Rol: <span className="font-semibold text-[#D4AF37]">{roleLabel(me.role)}</span>
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!dirty || save.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-[#D4AF37] text-black hover:bg-[#C9A227] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Guardar
        </button>
      </div>
    </form>
  );
}

// ── Contraseña ──────────────────────────────────────────────────────────────

const EMPTY_PASSWORDS = { current: "", next: "", repeat: "" };

/** Cambiar la contraseña sabiendo la actual. */
export function ChangePasswordForm() {
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nextProblem = passwordProblem(form.next)
    ?? (form.next === form.current ? "Tiene que ser distinta de la actual." : null);
  const repeatProblem = form.repeat !== form.next ? "No coincide con la nueva contraseña." : null;
  const valid = !!form.current && !nextProblem && !repeatProblem;

  const save = useMutation({
    mutationFn: () => changePassword(form.current, form.next),
    onSuccess: () => {
      setForm(EMPTY_PASSWORDS);
      setTouched(false);
      setError(null);
      toast.success("Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.");
    },
    onError: (e: unknown) => setError(accountErrorMessage(e, "No se pudo cambiar la contraseña.")),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (valid && !save.isPending) save.mutate();
  };
  const type = show ? "text" : "password";

  return (
    <form onSubmit={onSubmit} className="bg-card border border-border rounded-lg p-5 space-y-4" noValidate>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-[#D4AF37]" />
          <h2 className="text-sm font-semibold text-foreground">Cambiar contraseña</h2>
        </div>
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
          {show ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Al cambiarla se cierran tus sesiones en otros navegadores y en la app; en este sigues dentro.
      </p>

      <div className="space-y-3 max-w-sm">
        <div className="space-y-1">
          <label htmlFor="pass-actual" className="text-xs font-medium text-muted-foreground">Contraseña actual</label>
          <input id="pass-actual" type={type} value={form.current} autoComplete="current-password"
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} className={inputCls} />
          <FieldError text={touched && !form.current ? "Escribe tu contraseña actual." : null} />
        </div>
        <div className="space-y-1">
          <label htmlFor="pass-nueva" className="text-xs font-medium text-muted-foreground">Contraseña nueva</label>
          <input id="pass-nueva" type={type} value={form.next} autoComplete="new-password"
            onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} className={inputCls} />
          {touched && nextProblem
            ? <FieldError text={nextProblem} />
            : <p className="text-[11px] text-muted-foreground">{PASSWORD_RULES}</p>}
        </div>
        <div className="space-y-1">
          <label htmlFor="pass-repetir" className="text-xs font-medium text-muted-foreground">Repite la contraseña nueva</label>
          <input id="pass-repetir" type={type} value={form.repeat} autoComplete="new-password"
            onChange={(e) => setForm((f) => ({ ...f, repeat: e.target.value }))} className={inputCls} />
          <FieldError text={touched ? repeatProblem : null} />
        </div>
      </div>

      {error && (
        <div role="alert" className="px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-[#D4AF37] text-black hover:bg-[#C9A227] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {save.isPending ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
          Cambiar contraseña
        </button>
      </div>
    </form>
  );
}
