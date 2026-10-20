import type { GivenAvailabilityDay, RegistrationAvailability, ScheduleDay } from "@/types";

/** Una jornada en el modal de disponibilidad. */
export interface AvailabilityDayState extends ScheduleDay {
  fullAvailability: boolean;
  unavailableSlots: Set<string>;
  /** Si la pareja (o el panel) ya la ha dado; si no, cuenta como disponible todo el día. */
  given: boolean;
}

function fromGiven(day: GivenAvailabilityDay): AvailabilityDayState {
  return {
    dayId:            day.dayId,
    label:            day.label,
    date:             day.date,
    allSlots:         day.allSlots,
    fullAvailability: day.fullAvailability,
    unavailableSlots: new Set(day.unavailableSlots ?? []),
    given:            true,
  };
}

/**
 * La disponibilidad por jornada: todas las del torneo, con lo que la pareja ya
 * dio, y las que no dio, disponibles todo el día y marcadas como no dadas.
 * Con solo las dadas, una pareja inscrita desde el panel no tenía jornadas que
 * rellenar («Este torneo no tiene días de horario configurados»). Sin
 * `tournamentDays` (un back anterior), solo las dadas. La misma lista sirve
 * para leer, para editar y para saber si hay cambios.
 */
export function availabilityDays(data: Pick<RegistrationAvailability, "days" | "tournamentDays">): AvailabilityDayState[] {
  const given = data.days ?? [];
  if (!data.tournamentDays) return given.map(fromGiven);
  const byId = new Map(given.map((d) => [d.dayId, d]));
  return data.tournamentDays.map((day) => {
    const saved = byId.get(day.dayId);
    return saved
      ? fromGiven(saved)
      : { ...day, fullAvailability: true, unavailableSlots: new Set<string>(), given: false };
  });
}

/**
 * Si lo editado difiere de lo guardado, jornada a jornada por `dayId` (no por
 * posición: el orden de las dos listas puede no coincidir). Guardar una
 * jornada que la pareja no había dado cuenta como cambio: es lo que hace el
 * panel al meterla.
 */
export function availabilityChanged(edited: AvailabilityDayState[], baseline: AvailabilityDayState[]): boolean {
  const byId = new Map(baseline.map((d) => [d.dayId, d]));
  if (edited.length !== baseline.length) return true;
  return edited.some((d) => {
    const o = byId.get(d.dayId);
    if (!o || !o.given) return true;
    if (o.fullAvailability !== d.fullAvailability) return true;
    if (d.fullAvailability) return false;
    if (o.unavailableSlots.size !== d.unavailableSlots.size) return true;
    for (const s of d.unavailableSlots) if (!o.unavailableSlots.has(s)) return true;
    return false;
  });
}
