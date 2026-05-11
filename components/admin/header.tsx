"use client";

import { Bell, ChevronDown } from "lucide-react";
import { logout } from "@/lib/auth";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="font-heading text-xl text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D4AF37]" />
        </button>

        {/* Admin info */}
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md hover:bg-secondary transition-colors"
        >
          <div className="w-7 h-7 rounded-full bg-[rgba(212,175,55,0.2)] border border-[rgba(212,175,55,0.3)] flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#D4AF37]">A</span>
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-foreground leading-none">Admin AMT</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Super Admin</p>
          </div>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
