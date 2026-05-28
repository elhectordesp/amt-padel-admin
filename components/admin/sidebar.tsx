"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Trophy, Users, BarChart3,
  Building2, Calendar, DollarSign, Settings, LogOut,
  ChevronLeft, ChevronRight, Menu, X, Handshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutModal } from "@/components/admin/logout-modal";

// TODO (ROL CLUB — futuro):
// Cuando exista el rol CLUB, filtrar NAV según el rol del usuario logueado.
// Un usuario CLUB solo debe ver y acceder a:
//   ✅ Torneos, Inscripciones, Resultados
// Un usuario CLUB NO debe ver:
//   ❌ Dashboard global (o mostrar un dashboard acotado solo con sus torneos)
//   ❌ Jugadores (no puede cambiar categorías ni ver datos privados)
//   ❌ Rankings (no puede recalcular el SPA global)
//   ❌ Finanzas (estadísticas globales del circuito)
//   ❌ Configuración (ajustes del sistema SPA)
//
// Implementación sugerida:
//   const { user } = useAuth();
//   const isClub = user?.role === 'club';
//   const visibleNav = NAV.filter(item => !isClub || CLUB_ALLOWED.includes(item.href));
//   const CLUB_ALLOWED = ['/torneos', '/inscripciones', '/resultados'];
const NAV = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard"     },
  { href: "/torneos",       icon: Trophy,           label: "Torneos"       },
  { href: "/jugadores",     icon: Users,            label: "Jugadores"     },  // ❌ ocultar para CLUB
  { href: "/rankings",      icon: BarChart3,        label: "Rankings"      },  // ❌ ocultar para CLUB
  { href: "/inscripciones", icon: Building2,        label: "Inscripciones" },
  { href: "/resultados",    icon: Calendar,         label: "Resultados"    },
  { href: "/finanzas",        icon: DollarSign,       label: "Finanzas"       },  // ❌ ocultar para CLUB
  { href: "/patrocinadores",  icon: Handshake,        label: "Patrocinadores" },  // ❌ ocultar para CLUB
  { href: "/configuracion",   icon: Settings,         label: "Configuración"  },  // ❌ ocultar para CLUB
];

export function Sidebar() {
  const pathname    = usePathname();
  const [showLogout,  setShowLogout]  = useState(false);
  const [collapsed,   setCollapsed]   = useState(false); // desktop collapse
  const [mobileOpen,  setMobileOpen]  = useState(false); // mobile drawer

  // Cierra el drawer móvil al navegar
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Cierra el drawer móvil con ESC
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed && !isMobile ? label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm transition-colors",
                collapsed && !isMobile ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
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
      <div className="hidden lg:flex h-screen sticky top-0 shrink-0">
        {sidebarContent(false)}
      </div>

      {/* ── Mobile: botón hamburguesa — solo cuando drawer cerrado ── */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="lg:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-9 h-9 rounded-md bg-sidebar border border-[var(--sidebar-border)] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu size={18} />
        </button>
      )}

      {/* ── Mobile: backdrop ──────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Mobile: drawer ───────────────────────────────────────── */}
      <div
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 h-screen transition-transform duration-200",
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
