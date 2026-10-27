"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Circle, Eye, EyeOff, Loader2, Smartphone } from "lucide-react";
import { resetPassword } from "@/lib/auth";
import { appResetUrl, isMobileDevice, readAccountLink, type AccountLink } from "@/lib/account-link";
import { PASSWORD_REGEX, PASSWORD_RULES, PASSWORD_RULES_MESSAGE } from "@/lib/password-rules";

const schema = z
  .object({
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_RULES_MESSAGE),
    confirm: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
type FormData = z.infer<typeof schema>;

// El enlace se lee una vez por carga: luego se quita de la barra de
// direcciones (ver abajo) y una segunda lectura ya no lo encontraría.
let linkFromUrl: AccountLink | null | undefined;
function readLinkOnce(): AccountLink | null {
  if (linkFromUrl === undefined) {
    linkFromUrl = readAccountLink(window.location.hash, window.location.search);
  }
  return linkFromUrl;
}

const noSubscription = () => () => {};
const isMobileNow = () => isMobileDevice(navigator.userAgent, navigator.maxTouchPoints);

const inputClass =
  "w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-[380px] space-y-8">
        <div className="text-center">
          <span className="font-heading text-3xl text-[#D4AF37] tracking-[6px]">AMT</span>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Página del enlace de los emails de restablecer la contraseña y de activar
 * la cuenta. En el móvil intenta abrir la app con el mismo enlace; si no se
 * abre (no está instalada, o el correo no deja abrirla), la contraseña se
 * cambia aquí con el mismo endpoint que usa la app.
 */
export function ResetPasswordForm() {
  // undefined: aún sin leer (en el servidor y al hidratar)
  const link = useSyncExternalStore(noSubscription, readLinkOnce, () => undefined);
  const isMobile = useSyncExternalStore(noSubscription, isMobileNow, () => false);

  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const triedApp = useRef(false);

  // El token fuera de la barra de direcciones y del historial: así no se
  // comparte al copiar la URL ni acaba en los avisos de errores
  useEffect(() => {
    if (link) window.history.replaceState(null, "", window.location.pathname);
  }, [link]);

  // En el móvil, primero la app (una vez). Si no se abre, sigue la web
  useEffect(() => {
    if (!link || !isMobile || triedApp.current) return;
    triedApp.current = true;
    window.location.href = appResetUrl(link);
  }, [link, isMobile]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const password = useWatch({ control, name: "password" }) ?? "";

  if (link === undefined) return <Shell>{null}</Shell>;

  if (link === null) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <h1 className="font-heading text-2xl text-foreground">Enlace no válido</h1>
          <p className="text-sm text-muted-foreground">
            Esta página se abre desde el enlace del email. Si no funciona, pide uno nuevo desde la app con
            «¿Olvidaste tu contraseña?».
          </p>
        </div>
      </Shell>
    );
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-[rgba(212,175,55,0.15)] flex items-center justify-center">
            <Check size={24} className="text-[#D4AF37]" />
          </div>
          <h1 className="font-heading text-2xl text-foreground">
            {link.activate ? "Cuenta activada" : "Contraseña cambiada"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Ya puedes entrar en la app AMT Pádel con tu email y tu nueva contraseña.
          </p>
          {isMobile && (
            <a
              href="amtpadel://"
              className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold"
            >
              <Smartphone size={15} /> Abrir la app
            </a>
          )}
          <p className="text-xs text-muted-foreground">
            ¿Gestionas un club o el circuito?{" "}
            <Link href="/login" className="text-[#D4AF37] hover:underline">
              Entra en el panel
            </Link>
          </p>
        </div>
      </Shell>
    );
  }

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      await resetPassword(link.token, data.password);
      setDone(true);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    }
  };

  return (
    <Shell>
      <div>
        <h1 className="font-heading text-2xl text-foreground">
          {link.activate ? "Activa tu cuenta" : "Nueva contraseña"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {link.activate
            ? "Elige una contraseña para entrar en AMT Pádel."
            : "Elige una contraseña nueva para tu cuenta de AMT Pádel."}
        </p>
      </div>

      {isMobile && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground">¿Tienes la app en este móvil? Hazlo desde ella:</p>
          <a
            href={appResetUrl(link)}
            className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-md border border-[rgba(212,175,55,0.4)] text-sm text-[#D4AF37] font-semibold"
          >
            <Smartphone size={15} /> Abrir en la app
          </a>
          <p className="text-xs text-muted-foreground">Si no se abre, cámbiala aquí.</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Contraseña nueva
          </label>
          <div className="relative">
            <input
              id="password"
              {...register("password")}
              type={showPass ? "text" : "password"}
              autoComplete="new-password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Las reglas, a la vista desde el principio y marcadas al cumplirse */}
          <ul className="space-y-1 pt-1" aria-label="Requisitos de la contraseña">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={`flex items-center gap-2 text-xs ${ok ? "text-[#D4AF37]" : "text-muted-foreground"}`}
                >
                  {ok ? <Check size={12} aria-hidden /> : <Circle size={12} aria-hidden />}
                  <span>
                    {rule.label}
                    <span className="sr-only">{ok ? " (cumplido)" : " (pendiente)"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            Repite la contraseña
          </label>
          <input
            id="confirm"
            {...register("confirm")}
            type={showPass ? "text" : "password"}
            autoComplete="new-password"
            className={inputClass}
          />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>

        {apiError && (
          <div role="alert" className="px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/30">
            <span className="text-xs text-destructive">{apiError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-10 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold tracking-wide hover:bg-[#C49F2A] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={15} className="animate-spin" />}
          {isSubmitting ? "Guardando…" : link.activate ? "Activar mi cuenta" : "Cambiar contraseña"}
        </button>
      </form>
    </Shell>
  );
}
