"use client";

import { useState } from "react";
import { Bell, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/lib/services/admin";
import { useSearch } from "@/components/admin/search-context";
import { LogoutModal } from "@/components/admin/logout-modal";
import { api } from "@/lib/api";

function useAdminUser() {
  return useQuery({
    queryKey: ["admin-me"],
    queryFn:  () => api.get<{ name: string; email: string }>("/users/me").then((r) => r.data),
    staleTime: Infinity,
  });
}

interface HeaderProps { title: string }

export function Header({ title }: HeaderProps) {
  const { toggle }         = useSearch();
  const [showLogout, setShowLogout] = useState(false);

  const { data: stats } = useQuery({
    queryKey:       ["admin-stats"],
    queryFn:        adminService.stats,
    refetchInterval: 60_000,
    staleTime:       30_000,
  });

  const { data: me } = useAdminUser();

  const initials = me?.name
    ? me.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "A";

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="font-heading text-xl text-foreground">{title}</h1>

        <div className="flex items-center gap-2">
          {/* Cmd+K trigger */}
          <button
            onClick={toggle}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary border border-border text-xs text-muted-foreground hover:text-foreground hover:border-[rgba(212,175,55,0.3)] transition-colors"
          >
            <Search size={12} />
            <span>Buscar...</span>
            <kbd className="ml-1 px-1 py-0.5 rounded border border-border text-[9px]">⌘K</kbd>
          </button>

          {/* Notification bell */}
          <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <Bell size={18} />
            {(stats?.scheduledMatches ?? 0) > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AF37]" />
            )}
          </button>

          {/* Admin profile */}
          <button
            onClick={() => setShowLogout(true)}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
            title="Cerrar sesión"
          >
            <div className="w-7 h-7 rounded-full bg-[rgba(212,175,55,0.2)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center">
              <span className="text-[10px] font-bold text-[#D4AF37]">{initials}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-foreground leading-none truncate max-w-[120px]">
                {me?.name ?? "Admin AMT"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Super Admin</p>
            </div>
          </button>
        </div>
      </header>

      <LogoutModal open={showLogout} onClose={() => setShowLogout(false)} />
    </>
  );
}
