// TODO (MONOREPO) — CATEGORY_LABEL, LEVEL_COLOR, formatDate y tipos de dominio están duplicados
// entre amt-padel-admin y amt-padel-app. Cuando haya un tercer cliente o el equipo crezca,
// migrar a Turborepo con packages/shared-types y packages/design-tokens.
// Bloqueante conocido: Metro bundler de React Native tiene soporte experimental de monorepos
// — configurar watchFolders + extraNodeModules en metro.config.js antes de migrar.
import type { CategoryLevel, Gender, RegistrationStatus, TournamentStatus, TournamentTier } from "@/types";

export const CATEGORY_LABEL: Record<CategoryLevel, string> = {
  "1a":        "1ª",
  "2a":        "2ª",
  "3a":        "3ª",
  "4a":        "4ª",
  "5a":        "5ª",
  "6a":        "6ª",
  "iniciacion":"Iniciación",
};

export const CATEGORY_LABEL_SHORT: Record<CategoryLevel, string> = {
  "1a":        "1ª",
  "2a":        "2ª",
  "3a":        "3ª",
  "4a":        "4ª",
  "5a":        "5ª",
  "6a":        "6ª",
  "iniciacion":"Inic.",
};

export const GENDER_LABEL: Record<Gender, { full: string; short: string }> = {
  M: { full: "Masculino", short: "Masc." },
  F: { full: "Femenino",  short: "Fem."  },
};

export const LEVELS: CategoryLevel[] = [
  "1a","2a","3a","4a","5a","6a","iniciacion",
];

// Registration status — single source of truth for label + Tailwind class.
// Consumers that need an icon component pick one locally (UI concern,
// kept out of constants to avoid an icon-lib dependency here).
export const REGISTRATION_STATUS_CONFIG: Record<RegistrationStatus, { label: string; cls: string }> = {
  CONFIRMED: { label: "Confirmado", cls: "text-green-400 bg-green-400/10 border-green-400/30"    },
  PENDING:   { label: "Pendiente",  cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  WAITLIST:  { label: "En espera",  cls: "text-blue-400 bg-blue-400/10 border-blue-400/30"       },
  CANCELLED: { label: "Cancelado",  cls: "text-red-400 bg-red-400/10 border-red-400/30"          },
};

// Tournament status — keys match TournamentStatus (uppercase, from DB)
export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT:     "Borrador",
  OPEN:      "Abierto",
  DRAW:      "Sorteo",
  SCHEDULED: "Programado",
  ONGOING:   "En curso",
  FINISHED:  "Finalizado",
  CANCELLED: "Cancelado",
};

export const TOURNAMENT_STATUS_COLOR: Record<TournamentStatus, string> = {
  DRAFT:     "text-blue-400 bg-blue-400/10 border-blue-400/30",
  OPEN:      "text-green-400 bg-green-400/10 border-green-400/30",
  DRAW:      "text-purple-400 bg-purple-400/10 border-purple-400/30",
  SCHEDULED: "text-cyan-400 bg-cyan-400/10 border-cyan-400/30",
  ONGOING:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  FINISHED:  "text-muted-foreground bg-secondary border-border",
  CANCELLED: "text-red-400 bg-red-400/10 border-red-400/30",
};

// Tier display — keys match TournamentTier (uppercase, from DB)
export const TIER_LABEL: Record<TournamentTier, string> = {
  BRONZE:   "Open",
  SILVER:   "Silver",
  GOLD:     "Gold",
  PLATINUM: "Platinum",
};

export const TIER_COLOR: Record<TournamentTier, string> = {
  BRONZE:   "#CD7F32",
  SILVER:   "#C0C0C0",
  GOLD:     "#D4AF37",
  PLATINUM: "#E5E4E2",
};

// spaTier comes lowercase from the mobile API — map to display values
export const SPA_TIER_LABEL: Record<string, string> = {
  open:     "Open",
  silver:   "Silver",
  gold:     "Gold",
  platinum: "Platinum",
};

export const SPA_TIER_COLOR: Record<string, string> = {
  open:     "#CD7F32",
  silver:   "#C0C0C0",
  gold:     "#D4AF37",
  platinum: "#E5E4E2",
};

// Resolves whichever tier field is present and returns { label, color } for display
export const MATCH_PHASE_LABEL: Record<string, string> = {
  GROUPS: "Grupos",
  R32:    "Dieciseisavos",
  R16:    "Octavos",
  QF:     "Cuartos",
  SF:     "Semifinal",
  FINAL:  "Final",
};

export function phaseLabel(phase: string): string {
  return MATCH_PHASE_LABEL[phase?.toUpperCase()] ?? phase ?? "—";
}

export function resolveTier(spaTier?: string, tier?: TournamentTier): { label: string; color: string } | null {
  if (spaTier) {
    const label = SPA_TIER_LABEL[spaTier];
    const color = SPA_TIER_COLOR[spaTier];
    if (label && color) return { label, color };
  }
  if (tier) {
    return { label: TIER_LABEL[tier], color: TIER_COLOR[tier] };
  }
  return null;
}
