import type { CategoryLevel, Gender } from "@/types";

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

export const STATUS_LABEL: Record<string, string> = {
  open:     "Abierto",
  ongoing:  "En curso",
  finished: "Finalizado",
};

export const STATUS_COLOR: Record<string, string> = {
  open:     "text-green-400 bg-green-400/10 border-green-400/30",
  ongoing:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  finished: "text-muted-foreground bg-secondary border-border",
};
