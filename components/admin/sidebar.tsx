"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Trophy, Users, BarChart3,
  Building2, Calendar, DollarSign, PieChart,
  HeadphonesIcon, Settings, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";

const NAV = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard"    },
  { href: "/torneos",       icon: Trophy,           label: "Torneos"      },
  { href: "/jugadores",     icon: Users,            label: "Jugadores"    },
  { href: "/rankings",      icon: BarChart3,        label: "Rankings"     },
  { href: "/inscripciones", icon: Building2,        label: "Inscripciones"},
  { href: "/resultados",    icon: Calendar,         label: "Resultados"   },
  { href: "/finanzas",      icon: DollarSign,       label: "Finanzas"     },
  { href: "/estadisticas",  icon: PieChart,         label: "Estadísticas" },
  { href: "/soporte",       icon: HeadphonesIcon,   label: "Soporte"      },
  { href: "/configuracion", icon: Settings,         label: "Configuración"},
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-[200px] shrink-0 bg-sidebar border-r border-[var(--sidebar-border)] h-screen sticky top-0">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1 px-6 py-6 border-b border-[var(--sidebar-border)]">
        <span className="font-heading text-2xl text-[#D4AF37] tracking-[5px]">AMT</span>
        <div className="w-10 h-[1.5px] bg-[#D4AF37]" />
        <span className="text-[9px] tracking-[1.5px] text-muted-foreground">Be The Best</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-[rgba(212,175,55,0.12)] text-[#D4AF37] font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <Icon size={16} className={active ? "text-[#D4AF37]" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[var(--sidebar-border)]">
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
