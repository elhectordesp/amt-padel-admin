"use client";

import { useState } from "react";
import { Header } from "@/components/admin/header";
import { MessageSquare, Ticket, HelpCircle, AlertCircle, Clock, CheckCircle2, ChevronRight } from "lucide-react";

const FAQS = [
  {
    q: "¿Cómo cambio el estado de un torneo?",
    a: "Ve a Torneos → selecciona el torneo → usa el botón de cambio de estado en la cabecera. Los estados siguen el flujo: Borrador → Inscripciones → Sorteo → Programado → En curso → Finalizado.",
  },
  {
    q: "¿Cómo genero el cuadro de eliminación?",
    a: "Una vez el torneo está en estado 'Sorteo', entra en la categoría y usa el botón 'Generar sorteo'. El sistema asigna cabezas de serie automáticamente según el ranking.",
  },
  {
    q: "¿Qué ocurre si cancelo una inscripción confirmada?",
    a: "La plaza queda libre y el jugador en lista de espera más antiguo pasa automáticamente a pendiente. El jugador cancelado recibe una notificación push.",
  },
  {
    q: "¿Cómo registro el resultado de un partido?",
    a: "En la vista de partidos del torneo, haz clic en el partido → introduce los sets → guarda. El resultado se emite en tiempo real a todos los espectadores conectados.",
  },
  {
    q: "¿Puedo modificar el cuadro después de generarlo?",
    a: "No directamente desde el panel. Contacta con el administrador técnico para ajustes manuales en base de datos.",
  },
];

const CONTACTS = [
  { label: "Soporte técnico", value: "tech@amtpadel.com", icon: AlertCircle },
  { label: "Incidencias urgentes", value: "urgente@amtpadel.com", icon: Clock },
];

export default function Page() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Soporte" />

      <div className="flex-1 p-6 space-y-6 max-w-3xl">

        {/* Estado del sistema */}
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-sm text-emerald-300">Todos los sistemas operativos</span>
        </div>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Ticket,        label: "Abrir ticket",     sub: "Próximamente" },
            { icon: MessageSquare, label: "Chat de soporte",  sub: "Próximamente" },
            { icon: HelpCircle,    label: "Documentación",    sub: "Próximamente" },
          ].map(({ icon: Icon, label, sub }) => (
            <button
              key={label}
              disabled
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-500 cursor-not-allowed opacity-60"
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{label}</span>
              <span className="text-[10px] text-zinc-600">{sub}</span>
            </button>
          ))}
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Preguntas frecuentes</h2>
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
            {FAQS.map((faq, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="text-sm text-zinc-200">{faq.q}</span>
                  <ChevronRight
                    className={`h-4 w-4 text-zinc-500 shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-3 text-sm text-zinc-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contacto */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Contacto</h2>
          <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
            {CONTACTS.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-4 w-4 text-zinc-500 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500">{label}</p>
                  <a href={`mailto:${value}`} className="text-sm text-amber-400 hover:underline">{value}</a>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
