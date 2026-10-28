"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/admin/header";
import {
  MessageSquare, HelpCircle, ChevronRight, CheckCircle2,
  Inbox, Eye, CheckCheck, Clock, AlertCircle, RefreshCw, Search,
} from "lucide-react";
import { Pagination, usePagination } from "@/components/admin/pagination";
import { adminService } from "@/lib/services/admin";
import { paginate } from "@/lib/utils/pagination";
import { matchesSearch } from "@/lib/utils/search";
import type { SupportMessage, SupportStatus } from "@/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const SUBJECT_LABEL: Record<string, string> = {
  INSCRIPCIONES: "Inscripciones",
  RESULTADOS:    "Resultados",
  CUENTA:        "Mi cuenta",
  TECNICO:       "Problema técnico",
  OTRO:          "Otro",
};

const STATUS_META: Record<SupportStatus, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  NEW:      { label: "Nuevo",    color: "text-amber-400 bg-amber-400/10 border-amber-400/30", icon: AlertCircle },
  READ:     { label: "Leído",    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",   icon: Eye },
  RESOLVED: { label: "Resuelto", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: CheckCheck },
};

function StatusBadge({ status }: { status: SupportStatus }) {
  const { label, color, icon: Icon } = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/**
 * Quién escribe: nombre y apellidos y, si no los tiene (cuentas antiguas o un
 * back anterior, que solo mandaba `name`), su nombre completo.
 */
function senderName(user: SupportMessage["user"]): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return full || user.name || "Jugador sin nombre";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── MessageRow ────────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  onStatusChange,
}: {
  msg: SupportMessage;
  onStatusChange: (id: string, status: SupportStatus) => void;
}) {
  const [expanded, setExpanded]   = useState(false);
  const [updating, setUpdating]   = useState(false);

  const handleStatus = async (status: SupportStatus) => {
    if (updating || msg.status === status) return;
    setUpdating(true);
    try {
      await adminService.support.updateStatus(msg.id, status);
      onStatusChange(msg.id, status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={`border-b border-zinc-800 last:border-b-0 ${msg.status === "NEW" ? "bg-amber-950/10" : ""}`}>
      {/* Summary row */}
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
        onClick={() => {
          setExpanded((v) => !v);
          if (msg.status === "NEW") handleStatus("READ");
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-200 truncate">
              {senderName(msg.user)}
            </span>
            {msg.user.email && <span className="text-xs text-zinc-500">{msg.user.email}</span>}
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
              {SUBJECT_LABEL[msg.subject] ?? msg.subject}
            </span>
            <StatusBadge status={msg.status} />
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{formatDate(msg.createdAt)}</p>
          {!expanded && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-1">{msg.message}</p>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 text-zinc-500 shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 bg-zinc-900/30">
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
          {/* Actions */}
          <div className="flex items-center gap-2">
            {msg.status !== "READ" && (
              <button
                disabled={updating}
                onClick={() => handleStatus("READ")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 hover:bg-blue-400/20 transition-colors disabled:opacity-50"
              >
                <Eye className="h-3.5 w-3.5" />
                Marcar leído
              </button>
            )}
            {msg.status !== "RESOLVED" && (
              <button
                disabled={updating}
                onClick={() => handleStatus("RESOLVED")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Resolver
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FAQ (admin help) ──────────────────────────────────────────────────────────

const FAQS = [
  { q: "¿Cómo cambio el estado de un torneo?",        a: "El estado avanza solo con la preparación del torneo (en su ficha, pestaña Resumen): abrir las inscripciones lo pasa a Abierto; cerrarlas, a Sorteo; y «Publicar y avisar», a Programado. El flujo es Borrador → Abierto → Sorteo → Programado → En curso → Finalizado. Para corregirlo a mano: Editar → Avanzado." },
  { q: "¿Cómo genero el cuadro de eliminación?",      a: "Con el torneo en Sorteo, ve a la pestaña Cuadro de su ficha, elige la categoría y usa «Generar cuadro». Si el torneo tiene activados los cabezas de serie, se reparten según el ranking SPA; si no, el sorteo es aleatorio." },
  { q: "¿Qué ocurre si cancelo una inscripción?",     a: "La plaza queda libre y el jugador en lista de espera más antiguo pasa automáticamente a pendiente. El jugador cancelado recibe una notificación push." },
  { q: "¿Cómo registro el resultado de un partido?",  a: "En la vista de partidos del torneo, haz clic en el partido → introduce los sets → guarda. El resultado se emite en tiempo real a todos los espectadores conectados." },
  { q: "¿Puedo modificar el cuadro después de generarlo?", a: "Sí. En la pestaña Cuadro puedes mover parejas entre grupos, cambiar las parejas de un partido («Cambiar parejas»), crear o borrar partidos a mano y definir los cruces de la eliminatoria. También puedes rehacerlo entero con «Regenerar cuadro», o solo la fase final con «Regenerar eliminatorias». Si el cuadro está publicado, los grupos quedan bloqueados: ocúltalo antes de cambiarlos o fuerza el cambio." },
];

function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-300 mb-3">Preguntas frecuentes del panel</h2>
      <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
        {FAQS.map((faq, i) => (
          <div key={i}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
            >
              <span className="text-sm text-zinc-200">{faq.q}</span>
              <ChevronRight className={`h-4 w-4 text-zinc-500 shrink-0 transition-transform ${openFaq === i ? "rotate-90" : ""}`} />
            </button>
            {openFaq === i && (
              <div className="px-4 pb-3 text-sm text-zinc-400 leading-relaxed">{faq.a}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "mensajes" | "ayuda";
type Filter = "ALL" | SupportStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL",      label: "Todos" },
  { key: "NEW",      label: "Nuevos" },
  { key: "READ",     label: "Leídos" },
  { key: "RESOLVED", label: "Resueltos" },
];

export default function Page() {
  const [tab, setTab]         = useState<Tab>("mensajes");
  const [filter, setFilter]   = useState<Filter>("ALL");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [search, setSearch]   = useState("");
  const { page, setPage, pageSize, setPageSize } = usePagination();

  const loadMessages = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(false);
    try {
      const status = f === "ALL" ? undefined : f;
      const data   = await adminService.support.list(status);
      setMessages(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "mensajes") loadMessages(filter);
  }, [tab, filter, loadMessages]);

  const handleStatusChange = (id: string, status: SupportStatus) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
  };

  const newCount = messages.filter((m) => m.status === "NEW").length;
  const found = messages.filter((m) =>
    matchesSearch(search, senderName(m.user), m.user.email, SUBJECT_LABEL[m.subject] ?? m.subject, m.message),
  );

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Soporte" />

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex gap-1">
          {([
            { key: "mensajes" as Tab, icon: MessageSquare, label: "Mensajes de jugadores" },
            { key: "ayuda"    as Tab, icon: HelpCircle,    label: "Ayuda del panel" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === "mensajes" && newCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-zinc-900">
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4 max-w-4xl">

        {/* ── Mensajes tab ── */}
        {tab === "mensajes" && (
          <>
            {/* Status indicator */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-300">Sistema operativo</span>
            </div>

            {/* Filter chips + refresh */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                {FILTERS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setFilter(key); setPage(1); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filter === key
                        ? "border-amber-400 bg-amber-400/10 text-amber-400"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadMessages(filter)}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="h-5 w-5 text-zinc-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-16 text-zinc-500">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">Error al cargar los mensajes.</p>
                <button onClick={() => loadMessages(filter)} className="text-amber-400 text-sm hover:underline">Reintentar</button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-zinc-600">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">Sin mensajes</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-800">
                  <Search className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Buscar por nombre, email, asunto o texto..."
                    className="bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none w-full"
                  />
                </div>
                {found.length === 0 ? (
                  <p className="py-12 text-center text-sm text-zinc-500">Ningún mensaje coincide con «{search}».</p>
                ) : (
                  <div className="border border-zinc-800 rounded-lg overflow-hidden">
                    {paginate(found, page, pageSize).map((msg) => (
                      <MessageRow key={msg.id} msg={msg} onStatusChange={handleStatusChange} />
                    ))}
                  </div>
                )}
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={found.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="mensajes"
                />
              </>
            )}
          </>
        )}

        {/* ── Ayuda tab ── */}
        {tab === "ayuda" && (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-sm text-emerald-300">Todos los sistemas operativos</span>
            </div>
            <FaqSection />
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Contacto técnico</h2>
              <div className="border border-zinc-800 rounded-lg overflow-hidden divide-y divide-zinc-800">
                {[
                  { label: "Soporte técnico",    value: "tech@amtpadel.com",     icon: AlertCircle },
                  { label: "Incidencias urgentes", value: "urgente@amtpadel.com", icon: Clock },
                ].map(({ label, value, icon: Icon }) => (
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
          </>
        )}

      </div>
    </div>
  );
}
