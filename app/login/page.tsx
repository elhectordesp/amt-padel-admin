"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { login } from "@/lib/auth";

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Introduce tu contraseña"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const from         = searchParams.get("from") ?? "/dashboard";

  const [showPass,  setShowPass]  = useState(false);
  const [apiError,  setApiError]  = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    try {
      await login(data.email, data.password);
      router.replace(from);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
      setApiError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] border-r border-[var(--sidebar-border)] p-10 bg-[#111111]">
        <div>
          <div className="flex flex-col gap-1">
            <span className="font-heading text-4xl text-[#D4AF37] tracking-[6px]">AMT</span>
            <div className="w-16 h-[2px] bg-[#D4AF37]" />
            <span className="text-xs tracking-[2px] text-muted-foreground mt-1">Be The Best</span>
          </div>
          <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
            PANEL DE ADMINISTRACIÓN
          </p>
        </div>

        <div className="space-y-4">
          {[
            "Gestión integral de torneos",
            "Ranking por puntos, ELO y SPA",
            "Control de jugadores y categorías",
            "Calendario y horarios en tiempo real",
            "Reportes financieros detallados",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm text-muted-foreground">
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
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <span className="font-heading text-3xl text-[#D4AF37] tracking-[6px]">AMT</span>
          </div>

          <div>
            <h1 className="font-heading text-2xl text-foreground">Bienvenido de vuelta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Inicia sesión para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                Email
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="admin@amptournaments.com"
                autoComplete="email"
                className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
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
                  autoComplete="current-password"
                  className="w-full h-10 px-3 pr-10 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
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
              {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
