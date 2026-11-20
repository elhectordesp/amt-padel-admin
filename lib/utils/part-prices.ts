/**
 * Precios especiales con nombre del módulo Cuentas: las franjas que escribe el
 * club (días, desde, hasta y precio) y las mismas comprobaciones que hace el
 * back, para avisar antes de guardar. Los importes se escriben en euros.
 */
import type { PartPrice, PartPriceKind, PartPriceSlot } from "@/lib/services/accounts";
import { formatCents } from "@/lib/utils/booking-price";
import { eurosToCents } from "@/lib/utils/payment-methods";

/** Lo más que admite el back por franja. */
export const PART_PRICE_MAX_CENTS = 100000;

export const PART_PRICE_KIND_LABEL: Record<PartPriceKind, string> = {
  STUDENT: "Alumno",
  SPECIAL: "Especial",
};

/** Lunes (1) a domingo (7): la inicial para el botón y el nombre para leer. */
export const WEEK_DAYS: { value: number; letter: string; name: string }[] = [
  { value: 1, letter: "L", name: "Lun" },
  { value: 2, letter: "M", name: "Mar" },
  { value: 3, letter: "X", name: "Mié" },
  { value: 4, letter: "J", name: "Jue" },
  { value: 5, letter: "V", name: "Vie" },
  { value: 6, letter: "S", name: "Sáb" },
  { value: 7, letter: "D", name: "Dom" },
];

/** Una franja como se escribe en el formulario. */
export interface SlotDraft {
  days:  number[];
  start: string;
  end:   string;
  /** Euros escritos («5», «5,50»). */
  price: string;
}

export const emptySlotDraft = (): SlotDraft => ({ days: [], start: "", end: "", price: "" });

export function draftsFromPrice(price: Pick<PartPrice, "slots">): SlotDraft[] {
  return price.slots.map((s) => ({
    days:  [...s.daysOfWeek].sort((a, b) => a - b),
    start: s.startTime,
    end:   s.endTime,
    price: (s.priceCents / 100).toFixed(2).replace(".", ","),
  }));
}

/**
 * La primera falta de las franjas escritas, dicha en llano; null si valen.
 * Mismas reglas que el back: al menos una franja, con día, inicio menor que
 * fin, importe de 0 a 1.000 € y sin pisarse dos franjas el mismo día.
 */
export function validateSlotDrafts(drafts: SlotDraft[]): string | null {
  if (drafts.length === 0) return "Añade al menos una franja con su precio.";
  for (const [i, d] of drafts.entries()) {
    const n = i + 1;
    if (d.days.length === 0) return `Franja ${n}: elige al menos un día.`;
    if (!d.start || !d.end) return `Franja ${n}: pon la hora de inicio y la de fin.`;
    if (d.start >= d.end) return `Franja ${n}: la hora de inicio tiene que ser anterior a la de fin.`;
    const cents = eurosToCents(d.price);
    if (cents === null) return `Franja ${n}: escribe un precio válido, por ejemplo 5,50.`;
    if (cents > PART_PRICE_MAX_CENTS) return `Franja ${n}: el precio no puede pasar de ${formatCents(PART_PRICE_MAX_CENTS)}.`;
  }
  for (let i = 0; i < drafts.length; i++) {
    for (let j = i + 1; j < drafts.length; j++) {
      const a = drafts[i];
      const b = drafts[j];
      const sameDay = a.days.some((day) => b.days.includes(day));
      if (sameDay && a.start < b.end && b.start < a.end) {
        return `Las franjas ${i + 1} y ${j + 1} se pisan en un mismo día. Ajusta las horas.`;
      }
    }
  }
  return null;
}

/** Las franjas escritas, en la forma que pide el back (solo si `validateSlotDrafts` da null). */
export function draftsToSlots(drafts: SlotDraft[]): PartPriceSlot[] {
  return drafts.map((d) => ({
    daysOfWeek: [...d.days].sort((a, b) => a - b),
    startTime:  d.start,
    endTime:    d.end,
    priceCents: eurosToCents(d.price) as number,
  }));
}

/** «Lun–Vie», «Sáb, Dom» o «Todos los días». */
export function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 7) return "Todos los días";
  const name = (d: number) => WEEK_DAYS[d - 1].name;
  const contiguous = sorted.length >= 3 && sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  return contiguous ? `${name(sorted[0])}–${name(sorted[sorted.length - 1])}` : sorted.map(name).join(", ");
}

/** Una franja en una línea: «Lun–Vie · 09:00–14:00 · 5,00 €». */
export function describeSlot(slot: PartPriceSlot): string {
  return `${daysLabel(slot.daysOfWeek)} · ${slot.startTime}–${slot.endTime} · ${formatCents(slot.priceCents)}`;
}
