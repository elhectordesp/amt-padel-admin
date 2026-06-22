"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptClubInvite } from "@/lib/auth";

const schema = z
  .object({
    name: z
      .string()
      .min(2, "Introduce tu nombre")
      .max(100, "Máximo 100 caracteres"),
    password: z
      .string()
      .regex(
        /^(?=.*[A-Z])(?=.*\d).{8,}$/,
        "Mínimo 8 caracteres, una mayúscula y un número",
      ),
    confirm: z.string().min(1, "Confirma la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
type FormData = z.infer<typeof schema>;

export function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [showPass, setShowPass] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      await acceptClubInvite(token, data.name, data.password);
      toast.success("¡Cuenta activada! Redirigiendo al panel…");
      router.replace("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al aceptar la invitación";
      setApiError(msg);
      toast.error(msg);
    }
  };

  // Sin token en la URL: invitación rota o accedida directamente.
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-heading text-2xl text-foreground">
            Enlace inválido
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta página solo se abre desde el enlace de invitación que recibes
            por email. Si el enlace ya no funciona, pide al equipo de AMT que
            te reenvíe la invitación.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding (mismo estilo que /login) */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] border-r border-[var(--sidebar-border)] p-10 bg-[#111111]">
        <div>
          <div className="flex flex-col gap-1">
            <span className="font-heading text-4xl text-[#D4AF37] tracking-[6px]">
              AMT
            </span>
            <div className="w-16 h-[2px] bg-[#D4AF37]" />
            <span className="text-xs tracking-[2px] text-muted-foreground mt-1">
              Be The Best
            </span>
          </div>
          <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
            PANEL DE ADMINISTRACIÓN DEL CLUB
          </p>
        </div>

        <div className="space-y-4">
          {[
            "Gestiona los torneos de tu club",
            "Controla inscripciones y pagos",
            "Introduce resultados en tiempo real",
            "Estadísticas de tus competiciones",
            "Auditoría completa de cambios",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 text-sm text-muted-foreground"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              {item}
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">© AMT Be The Best 2026</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[380px] space-y-8">
          <div className="lg:hidden text-center">
            <span className="font-heading text-3xl text-[#D4AF37] tracking-[6px]">
              AMT
            </span>
          </div>

          <div>
            <h1 className="font-heading text-2xl text-foreground">
              Activa tu cuenta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Completa tu nombre y elige una contraseña para entrar al panel de
              tu club.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                Tu nombre
              </label>
              <input
                {...register("name")}
                type="text"
                placeholder="Nombre y apellidos"
                autoComplete="name"
                className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                Contraseña
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••••"
                  autoComplete="new-password"
                  className="w-full h-10 px-3 pr-10 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    showPass ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirmar password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                Confirmar contraseña
              </label>
              <input
                {...register("confirm")}
                type={showPass ? "text" : "password"}
                placeholder="••••••••••"
                autoComplete="new-password"
                className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
              />
              {errors.confirm && (
                <p className="text-xs text-destructive">
                  {errors.confirm.message}
                </p>
              )}
            </div>

            {apiError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/30">
                <span className="text-xs text-destructive">{apiError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold tracking-wide hover:bg-[#C49F2A] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={15} className="animate-spin" />}
              {isSubmitting ? "Activando..." : "Activar mi cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
