"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { TournamentTier } from "@/types";

// ── Field ─────────────────────────────────────────────────────────────────
export function Field({
  label, error, children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 rounded-md bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-colors ${props.className ?? ""}`}
    />
  );
}

// ── CustomSelect ──────────────────────────────────────────────────────────
export interface SelectOption { value: string; label: string }

export function CustomSelect({
  options, value, onChange, compact = false,
}: {
  options:  SelectOption[];
  value:    string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) ?? options[0] ?? { value: "", label: "—" };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const h = compact ? "h-8" : "h-9";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full ${h} px-3 pr-8 rounded-md bg-input border text-sm text-foreground text-left flex items-center transition-all duration-150 cursor-pointer ${
          open
            ? "border-[#D4AF37] ring-1 ring-[#D4AF37]"
            : "border-border hover:border-[rgba(212,175,55,0.4)]"
        }`}
      >
        <span className="truncate">{selected.label}</span>
        <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <ChevronDown size={13} />
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[140px] rounded-md border border-[rgba(212,175,55,0.2)] bg-[#1A1A1A] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden"
          style={{ backdropFilter: "blur(12px)" }}
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                  isActive
                    ? "text-[#D4AF37] bg-[rgba(212,175,55,0.08)]"
                    : "text-foreground hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                {isActive && <Check size={12} className="shrink-0 text-[#D4AF37]" />}
                {!isActive && <span className="w-3 shrink-0" />}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── TierPicker ────────────────────────────────────────────────────────────
export const TIER_OPTIONS: { value: TournamentTier; label: string; sub: string; color: string }[] = [
  { value: "BRONZE",   label: "Open",     sub: "Torneo abierto · categoría Bronze",  color: "#CD7F32" },
  { value: "SILVER",   label: "Silver",   sub: "Nivel intermedio · puntos SPA x1.5", color: "#C0C0C0" },
  { value: "GOLD",     label: "Gold",     sub: "Nivel alto · puntos SPA x2",         color: "#D4AF37" },
  { value: "PLATINUM", label: "Platinum", sub: "Élite · máxima dotación de puntos",  color: "#E5E4E2" },
];

export function TierPicker({
  value, onChange,
}: {
  value:    string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TIER_OPTIONS.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`relative flex flex-col gap-0.5 rounded-md border p-3 text-left transition-all duration-150 ${
              active
                ? "border-[#D4AF37] bg-[rgba(212,175,55,0.07)] shadow-[0_0_0_1px_#D4AF37]"
                : "border-border bg-input hover:border-[rgba(212,175,55,0.35)] hover:bg-[rgba(255,255,255,0.03)]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: t.color, boxShadow: active ? `0 0 6px ${t.color}` : "none" }}
              />
              <span className={`text-sm font-semibold ${active ? "text-[#D4AF37]" : "text-foreground"}`}>
                {t.label}
              </span>
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight pl-4">{t.sub}</span>
            {active && (
              <span className="absolute top-2 right-2 text-[#D4AF37]">
                <Check size={12} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
