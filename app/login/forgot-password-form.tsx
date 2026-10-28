"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { accountErrorMessage, requestPasswordReset } from "@/lib/account";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * «¿Olvidaste tu contraseña?» (como en la app): pide el email con el enlace
 * para elegir una nueva. Dice lo mismo exista o no la cuenta, como el back.
 */
export function ForgotPasswordForm({
  initialEmail = "",
  onBack,
}: {
  initialEmail?: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError("Escribe un email válido.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err: unknown) {
      setError(accountErrorMessage(err, "No se pudo enviar el email. Inténtalo de nuevo."));
    } finally {
      setSending(false);
    }
  };

  const back = (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft size={13} /> Volver a iniciar sesión
    </button>
  );

  if (sent) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 px-3 py-3 rounded-md bg-[rgba(212,175,55,0.08)] border border-[rgba(212,175,55,0.3)]">
          <MailCheck size={18} className="text-[#D4AF37] shrink-0 mt-0.5" />
          <p className="text-sm text-foreground">
            Si <span className="font-semibold">{email.trim()}</span> tiene cuenta, te llegará un email con un
            enlace para elegir una contraseña nueva. Revisa también el correo no deseado.
          </p>
        </div>
        {back}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <h1 className="font-heading text-2xl text-foreground">¿Olvidaste tu contraseña?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escribe el email con el que entras y te enviamos un enlace para elegir otra.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="forgot-email" className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors"
        />
      </div>
      {error && (
        <div role="alert" className="px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={sending}
        className="w-full h-10 rounded-md bg-[#D4AF37] text-[#0C0C0C] text-sm font-semibold tracking-wide hover:bg-[#C49F2A] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {sending && <Loader2 size={15} className="animate-spin" />}
        Enviar enlace
      </button>
      {back}
    </form>
  );
}
