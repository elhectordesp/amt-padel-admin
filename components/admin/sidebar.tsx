"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Trophy, Users, BarChart3, LineChart,
  Building2, Landmark, Calendar, DollarSign, Settings, LogOut,
  ChevronLeft, ChevronRight, Menu, X, Handshake, MessageSquare, CalendarRange,
  History, Contact, CalendarDays, Wallet, UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutModal } from "@/components/admin/logout-modal";
import { useRole, isClub, type Role } from "@/lib/use-role";
import { useMe, ME_QUERY_KEY } from "@/lib/use-me";
import { useClubAccess, type ClubAccess } from "@/lib/use-club-access";
import { activateClub } from "@/lib/auth";
import type { ClubArea } from "@/lib/club-permissions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const NAV = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard"     },
  { href: "/torneos",       icon: Trophy,           label: "Torneos"       },
  { href: "/jugadores",     icon: Users,            label: "Jugadores"     },
  { href: "/rankings",      icon: BarChart3,        label: "Rankings"      },
  { href: "/estadisticas",  icon: LineChart,        label: "Estadísticas"  },
  { href: "/inscripciones", icon: Building2,        label: "Inscripciones" },
  { href: "/resultados",    icon: Calendar,         label: "Resultados"    },
  { href: "/finanzas",        icon: DollarSign,       label: "Finanzas"       },
  { href: "/clubes",           icon: Landmark,         label: "Clubes"         },
  { href: "/patrocinadores",  icon: Handshake,        label: "Patrocinadores" },
  { href: "/soporte",          icon: MessageSquare,    label: "Soporte"        },
  { href: "/historial",        icon: History,          label: "Historial"      },
  { href: "/configuracion",   icon: Settings,         label: "Configuración"  },
];

// Menú del gestor del club, lo diario arriba. El backend ya enforce el
// aislamiento — esto es UX para no enseñar botones que devolverían 403.
// «Inscripciones» y «Resultados» siguen dentro de cada torneo.
const CLUB_NAV: { href: string; icon: typeof Trophy; label: string; area?: ClubArea }[] = [
  { href: "/dashboard",                    icon: LayoutDashboard, label: "Hoy"            },
  { href: "/mi-club/reservas/calendario",  icon: CalendarDays,    label: "Calendario",     area: "bookings"  },
  { href: "/mi-club/reservas/bookings",    icon: CalendarRange,   label: "Reservas",       area: "bookings"  },
  { href: "/caja",                         icon: Wallet,          label: "Caja",           area: "cash"      },
  { href: "/mi-club/clientes",             icon: Contact,         label: "Clientes",       area: "customers" },
  { href: "/torneos",                      icon: Trophy,          label: "Torneos",        area: "tournaments" },
  { href: "/mi-club",                      icon: Landmark,        label: "Mi club",        area: "settings"  },
  { href: "/mi-club/equipo",               icon: UsersRound,      label: "Equipo",         area: "staff"     },
  { href: "/patrocinadores",               icon: Handshake,       label: "Patrocinadores", area: "settings"  },
];

/** El menú que ve cada rol: el del club, el suyo; el resto (AMT), el completo. */
export function navForRole(role: Role, access?: Pick<ClubAccess, "can">) {
  if (!isClub(role)) return NAV;
  // Al equipo del club solo se le enseña lo que su rol puede leer
  return access ? CLUB_NAV.filter((i) => !i.area || access.can(i.area, "read")) : CLUB_NAV;
}

export function Sidebar() {
  const pathname    = usePathname();
  const { role }    = useRole();
  const [showLogout,  setShowLogout]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(false); // desktop collapse
  const [mobileOpen,  setMobileOpen]  = useState(false); // mobile drawer

  const menuButtonRef  = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef     = useRef(false);

  const access     = useClubAccess();
  const visibleNav = navForRole(role, access);

  const activeHref = computeActiveHref(visibleNav.map((i) => i.href), pathname);

  // Cierra el drawer móvil al navegar
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Cierra el drawer móvil con ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  // Foco accesible: al abrir va al botón de cerrar; al cerrar vuelve al de abrir
  useEffect(() => {
    if (mobileOpen) closeButtonRef.current?.focus();
    else if (wasOpenRef.current) menuButtonRef.current?.focus();
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  const sidebarContent = (isMobile = false) => (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-[var(--sidebar-border)] transition-all duration-200",
        isMobile ? "w-[200px]" : collapsed ? "w-[60px]" : "w-[200px]",
      )}
    >
      {/* Logo */}
      <div className={cn(
        "relative flex items-center border-b border-[var(--sidebar-border)] transition-all duration-200",
        collapsed && !isMobile ? "justify-center px-0 py-6" : "flex-col gap-1 px-6 py-6",
      )}>
        {/* Botón cerrar — solo en el drawer móvil, siempre dentro del sidebar */}
        {isMobile && (
          <button
            ref={closeButtonRef}
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="absolute top-2 right-2 flex items-center justify-center size-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={15} />
          </button>
        )}
        {collapsed && !isMobile ? (
          <span className="font-heading text-lg text-[#D4AF37] tracking-[3px]">A</span>
        ) : (
          <>
            <span className="font-heading text-2xl text-[#D4AF37] tracking-[5px]">AMT</span>
            <div className="w-10 h-[1.5px] bg-[#D4AF37]" />
            <span className="text-[9px] tracking-[1.5px] text-muted-foreground">Be The Best</span>
          </>
        )}
      </div>

      {/* Con qué club trabaja (solo quien lleva varios) */}
      {(!collapsed || isMobile) && <ClubSwitcher />}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleNav.map(({ href, icon: Icon, label }) => {
          const active = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed && !isMobile ? label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                collapsed && !isMobile ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2 max-[1024px]:min-h-11",
                active
                  ? "bg-[rgba(212,175,55,0.12)] text-[#D4AF37] font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <Icon size={16} className={active ? "text-[#D4AF37]" : ""} />
              {(!collapsed || isMobile) && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: toggle (desktop only) + logout */}
      <div className="p-2 border-t border-[var(--sidebar-border)] space-y-0.5">
        {/* Botón colapsar — solo en desktop */}
        {!isMobile && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            className={cn(
              "flex items-center rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full",
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
            )}
          >
            {collapsed
              ? <ChevronRight size={16} />
              : <><ChevronLeft size={16} /><span>Colapsar</span></>
            }
          </button>
        )}

        {/* Logout */}
        <button
          onClick={() => setShowLogout(true)}
          title={collapsed && !isMobile ? "Cerrar sesión" : undefined}
          className={cn(
            "flex items-center rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full",
            collapsed && !isMobile ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
          )}
        >
          <LogOut size={16} />
          {(!collapsed || isMobile) && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <div className="hidden min-[1025px]:flex h-screen sticky top-0 shrink-0">
        {sidebarContent(false)}
      </div>

      {/* ── Mobile: botón hamburguesa — solo cuando drawer cerrado ── */}
      {!mobileOpen && (
        <button
          ref={menuButtonRef}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="min-[1025px]:hidden fixed top-3 left-3 z-50 flex items-center justify-center size-11 rounded-md bg-sidebar border border-[var(--sidebar-border)] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu size={18} />
        </button>
      )}

      {/* ── Mobile: backdrop ──────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="min-[1025px]:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Mobile: drawer ───────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        inert={!mobileOpen}
        className={cn(
          "min-[1025px]:hidden fixed inset-y-0 left-0 z-50 h-screen transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="relative h-full">
          {sidebarContent(true)}
        </div>
      </div>

      <LogoutModal open={showLogout} onClose={() => setShowLogout(false)} />
    </>
  );
}

/**
 * Dado el listado de hrefs visibles en el sidebar y el pathname actual,
 * devuelve el href que debe marcarse activo (el match MÁS LARGO).
 *
 * Necesario porque dos hrefs pueden matchear el mismo path por prefijo
 * (p. ej. /mi-club y /mi-club/reservas) — sin esto, ambos se marcarían.
 *
 * Exportado para poder testarse sin montar el componente entero.
 */
export function computeActiveHref(
  hrefs: string[],
  pathname: string,
): string | null {
  return hrefs.reduce<string | null>((best, href) => {
    const matches = pathname === href || pathname.startsWith(href + "/");
    if (!matches) return best;
    if (best === null || href.length > best.length) return href;
    return best;
  }, null);
}

/** Selector de club de quien lleva varias sedes: cambia la sesión y recarga en la portada. */
function ClubSwitcher() {
  const { role } = useRole();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [changing, setChanging] = useState(false);
  const clubs = me?.clubs ?? [];
  if (!isClub(role) || clubs.length < 2) return null;

  const onChange = async (clubId: string) => {
    if (clubId === me?.activeClubId) return;
    setChanging(true);
    try {
      await activateClub(clubId);
      // Nada del club anterior en la caché
      qc.clear();
      window.location.href = "/";
    } catch (err) {
      setChanging(false);
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar de club");
      qc.invalidateQueries({ queryKey: ME_QUERY_KEY });
    }
  };

  return (
    <div className="px-2 pt-3">
      <label htmlFor="club-switcher" className="block px-1 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Club
      </label>
      <select
        id="club-switcher"
        value={me?.activeClubId ?? ""}
        disabled={changing}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 max-[1024px]:h-11 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-60"
      >
        {!me?.activeClubId && <option value="" disabled>Elige un club</option>}
        {clubs.map((c) => (
          <option key={c.clubId} value={c.clubId}>{c.clubName}</option>
        ))}
      </select>
    </div>
  );
}
