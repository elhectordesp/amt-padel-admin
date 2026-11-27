/**
 * Reservas fijas, lógica pura:
 * - «Hasta» se propone el 30 de junio siguiente a la fecha de inicio, sin pasar
 *   de inicio + 364 días (un año);
 * - cada fecha de la vista previa se lee con su estado y su precio («Libre ·
 *   22,00 €», «En Pista 4 · 22,00 €», «No se puede: el club cierra»);
 * - el resumen y el aviso de crear cuentan las libres, las de otra pista y las
 *   que no tienen hueco;
 * - ampliar y terminar validan sus fechas; los errores se dicen en llano.
 */
import { describe, it, expect } from "vitest";
import {
  SERIES_MAX_DAYS,
  bookingDayLabel,
  buildSeriesPlan,
  canEndSeries,
  canExtendSeries,
  countOccurrences,
  createButtonLabel,
  createdMessage,
  defaultExtendEndDate,
  defaultSeriesEndDate,
  endFromDateError,
  endSummary,
  everyWeekdayText,
  extendEndDateError,
  extendMaxEndDate,
  extendedMessage,
  isFixedBooking,
  isoWeekday,
  occurrenceDayLabel,
  occurrenceStatusText,
  previewSummary,
  seriesBookingState,
  seriesEndDateError,
  seriesErrorText,
  seriesMaxEndDate,
  seriesNoticeText,
  seriesRangeLabel,
  seriesSlotLabel,
  seriesState,
  upcomingText,
  weekdayName,
} from "@/lib/utils/booking-series";
import type { SeriesOccurrence } from "@/lib/services/booking-series";

const occ = (status: SeriesOccurrence["status"], extra: Partial<SeriesOccurrence> = {}) =>
  ({
    date: "2026-12-02", startsAt: "", endsAt: "", status, courtId: "p1", courtName: "Pista 1", priceCents: 2200, reason: null,
    ...extra,
  }) as SeriesOccurrence;

describe("«Hasta» por defecto y sus límites", () => {
  it("el 30 de junio siguiente a la fecha de inicio", () => {
    expect(defaultSeriesEndDate("2026-12-02")).toBe("2027-06-30");
    expect(defaultSeriesEndDate("2027-03-15")).toBe("2027-06-30");
    expect(defaultSeriesEndDate("2026-01-01")).toBe("2026-06-30");
  });

  it("si la fecha de inicio es el 30 de junio o más tarde, el del año siguiente", () => {
    expect(defaultSeriesEndDate("2026-06-29")).toBe("2026-06-30");
    expect(defaultSeriesEndDate("2026-06-30")).toBe("2027-06-29");
    expect(defaultSeriesEndDate("2026-07-01")).toBe("2027-06-30");
  });

  it("nunca pasa de inicio + 364 días", () => {
    // 30/6/2028 está a 366 días del 30/6/2027: se queda en el máximo
    expect(seriesMaxEndDate("2026-06-30")).toBe("2027-06-29");
    expect(seriesMaxEndDate("2027-06-30")).toBe("2028-06-28");
    expect(defaultSeriesEndDate("2027-06-30")).toBe("2028-06-28");
    expect(SERIES_MAX_DAYS).toBe(364);
  });

  it("sin una fecha de inicio válida, vacío", () => {
    expect(defaultSeriesEndDate("")).toBe("");
    expect(seriesMaxEndDate("hoy")).toBe("");
  });

  it("valida «Hasta»: vacía, anterior al inicio o a más de un año", () => {
    expect(seriesEndDateError("2026-12-02", "")).toBe("Elige hasta qué fecha se repite.");
    expect(seriesEndDateError("2026-12-02", "2026-12-01")).toBe("La fecha de fin no puede ser anterior a la de inicio.");
    expect(seriesEndDateError("2026-12-02", "2027-12-02")).toBe("Una reserva fija dura como mucho un año: hasta el 1/12 como máximo.");
    expect(seriesEndDateError("2026-12-02", "2027-12-01")).toBeNull();
    expect(seriesEndDateError("2026-12-02", "2026-12-02")).toBeNull();
    expect(seriesEndDateError("2026-12-02", "2027-06-30")).toBeNull();
  });
});

describe("el plan que se manda al back", () => {
  const ok = {
    courtId: "p3", clubCustomerId: "k1", startDate: "2026-12-01", endDate: "2027-06-30", startTime: "19:30", durationMinutes: 90,
  };

  it("lleva la pista, el cliente, las fechas, la hora y la duración", () => {
    expect(buildSeriesPlan(ok)).toEqual(ok);
  });

  it("sin cliente, pista, fechas o hora no hay plan", () => {
    expect(buildSeriesPlan({ ...ok, clubCustomerId: null })).toBeNull();
    expect(buildSeriesPlan({ ...ok, courtId: "" })).toBeNull();
    expect(buildSeriesPlan({ ...ok, endDate: "" })).toBeNull();
    expect(buildSeriesPlan({ ...ok, startTime: "" })).toBeNull();
    expect(buildSeriesPlan({ ...ok, durationMinutes: 0 })).toBeNull();
  });
});

describe("los días de la semana", () => {
  it("1 es lunes y 7, domingo", () => {
    expect(isoWeekday("2026-12-01")).toBe(2); // martes
    expect(isoWeekday("2026-11-30")).toBe(1);
    expect(isoWeekday("2026-12-06")).toBe(7);
    expect(isoWeekday("no")).toBe(0);
  });

  it("«los martes», «los sábados»", () => {
    expect(everyWeekdayText(2)).toBe("los martes");
    expect(everyWeekdayText(1)).toBe("los lunes");
    expect(everyWeekdayText(6)).toBe("los sábados");
    expect(everyWeekdayText(7)).toBe("los domingos");
    expect(everyWeekdayText(0)).toBe("");
  });

  it("«Martes 19:30 · 90 min» y «Desde el 2/12 hasta el 30/6»", () => {
    expect(weekdayName(2)).toBe("Martes");
    expect(seriesSlotLabel({ weekday: 2, startTime: "19:30", durationMinutes: 90 })).toBe("Martes 19:30 · 90 min");
    expect(seriesRangeLabel({ startDate: "2026-12-02", endDate: "2027-06-30" })).toBe("Desde el 2/12 hasta el 30/6");
  });

  it("«mar 1 dic» sin comas ni puntos, de una fecha y de un instante en la zona del club", () => {
    expect(occurrenceDayLabel("2026-12-01")).toBe("mar 1 dic");
    // 23:30 UTC del 1/12 ya es el 2/12 en Madrid
    expect(bookingDayLabel("2026-12-01T23:30:00.000Z", "Europe/Madrid")).toBe("mié 2 dic");
    expect(bookingDayLabel("2026-12-01T23:30:00.000Z", "Atlantic/Canary")).toBe("mar 1 dic");
  });
});

describe("el estado de cada fecha de la vista previa", () => {
  it("libre, en otra pista y sin hueco, con su motivo", () => {
    expect(occurrenceStatusText(occ("FREE"))).toBe("Libre · 22,00 €");
    expect(occurrenceStatusText(occ("OTHER_COURT", { courtName: "Pista 4" }))).toBe("En Pista 4 · 22,00 €");
    const none = { courtId: null, courtName: null, priceCents: null };
    expect(occurrenceStatusText(occ("UNAVAILABLE", { ...none, reason: "CLUB_CLOSED" }))).toBe("No se puede: el club cierra");
    expect(occurrenceStatusText(occ("UNAVAILABLE", { ...none, reason: "OUTSIDE_HOURS" }))).toBe("No se puede: fuera de horario");
    expect(occurrenceStatusText(occ("UNAVAILABLE", { ...none, reason: "TAKEN" }))).toBe("No se puede: todas las pistas ocupadas");
    expect(occurrenceStatusText(occ("UNAVAILABLE", { ...none, reason: null }))).toBe("No se puede: sin hueco");
  });

  it("cuenta cada tipo; se crean las libres y las de otra pista", () => {
    const list = [occ("FREE"), occ("FREE"), occ("OTHER_COURT"), occ("UNAVAILABLE")];
    expect(countOccurrences(list)).toEqual({ free: 2, otherCourt: 1, unavailable: 1 });
  });
});

describe("los textos del resumen", () => {
  it("el botón dice cuántas reservas crea", () => {
    expect(createButtonLabel(30)).toBe("Crear 30 reservas");
    expect(createButtonLabel(1)).toBe("Crear 1 reserva");
  });

  it("el resumen de la vista previa: total, otra pista y sin hueco", () => {
    expect(previewSummary({ free: 28, otherCourt: 0, unavailable: 0, priceCents: 61600 })).toBe("28 reservas · 616,00 €");
    expect(previewSummary({ free: 26, otherCourt: 2, unavailable: 1, priceCents: 61600 })).toBe(
      "28 reservas · 616,00 €, 2 en otra pista, 1 fecha sin hueco",
    );
    expect(previewSummary({ free: 1, otherCourt: 0, unavailable: 3, priceCents: 2200 })).toBe("1 reserva · 22,00 €, 3 fechas sin hueco");
  });

  it("al crear: «Reserva fija creada: N reservas», más las de otra pista y las sin hueco si las hay", () => {
    const list = [occ("FREE"), occ("FREE"), occ("OTHER_COURT"), occ("UNAVAILABLE"), occ("UNAVAILABLE")];
    expect(createdMessage(list)).toBe("Reserva fija creada: 3 reservas, 1 en otra pista, 2 fechas sin hueco");
    expect(createdMessage([occ("FREE")])).toBe("Reserva fija creada: 1 reserva");
  });

  it("al ampliar: «Reserva fija ampliada: N reservas más»", () => {
    expect(extendedMessage([occ("FREE"), occ("OTHER_COURT")])).toBe("Reserva fija ampliada: 2 reservas más, 1 en otra pista");
    expect(extendedMessage([occ("FREE")])).toBe("Reserva fija ampliada: 1 reserva más");
  });

  it("la línea de la ficha: «Reserva fija de Hugo · martes 19:30 · hasta el 30/6»", () => {
    expect(seriesNoticeText({ customerName: "Hugo", weekday: 2, startTime: "19:30", endDate: "2027-06-30" })).toBe(
      "Reserva fija de Hugo · martes 19:30 · hasta el 30/6",
    );
    expect(seriesNoticeText({ customerName: null, weekday: 7, startTime: "10:00", endDate: "2027-01-31" })).toBe(
      "Reserva fija de un cliente · domingo 10:00 · hasta el 31/1",
    );
  });
});

describe("la marca «Fija» y el estado de una reserva fija", () => {
  it("una reserva es fija si cuelga de una reserva fija", () => {
    expect(isFixedBooking({ recurringGroupId: "s1" })).toBe(true);
    expect(isFixedBooking({ recurringGroupId: null })).toBe(false);
  });

  it("activa, terminada a mano o acabada por su fecha de fin", () => {
    expect(seriesState({ endedAt: null, endDate: "2026-12-01" }, "2026-12-01")).toBe("active");
    expect(seriesState({ endedAt: null, endDate: "2026-11-30" }, "2026-12-01")).toBe("finished");
    expect(seriesState({ endedAt: "2026-11-01T10:00:00.000Z", endDate: "2027-01-01" }, "2026-12-01")).toBe("ended");
  });

  it("se amplía mientras no se haya terminado a mano; se termina con alguna fecha por delante", () => {
    expect(canExtendSeries({ endedAt: null })).toBe(true);
    expect(canExtendSeries({ endedAt: "2026-11-01T10:00:00.000Z" })).toBe(false);
    expect(canEndSeries({ endedAt: null, endDate: "2026-12-01" }, "2026-12-01")).toBe(true);
    expect(canEndSeries({ endedAt: null, endDate: "2026-11-30" }, "2026-12-01")).toBe(false);
    expect(canEndSeries({ endedAt: "2026-11-01T10:00:00.000Z", endDate: "2027-01-01" }, "2026-12-01")).toBe(false);
  });

  it("las próximas, en plural y sin ninguna", () => {
    expect(upcomingText(0)).toBe("Sin próximas");
    expect(upcomingText(1)).toBe("1 próxima");
    expect(upcomingText(12)).toBe("12 próximas");
  });

  it("cómo va cada reserva de la serie: cancelada, cobrada, con cobros o deuda, sin cobrar", () => {
    const base = { status: "CONFIRMED", paymentMethod: "PENDING", priceCents: 2200, paidAmountCents: null, hasMoney: false } as const;
    expect(seriesBookingState({ ...base, status: "CANCELLED" })).toEqual({ text: "Cancelada", tone: "muted" });
    expect(seriesBookingState({ ...base, paymentMethod: "CASH", paidAmountCents: 2200, hasMoney: true })).toEqual({ text: "Cobrada", tone: "paid" });
    expect(seriesBookingState({ ...base, hasMoney: true })).toEqual({ text: "Con cobros o deuda", tone: "money" });
    expect(seriesBookingState(base)).toEqual({ text: "Sin cobrar", tone: "unpaid" });
    expect(seriesBookingState({ ...base, priceCents: 0 })).toEqual({ text: "Sin importe", tone: "muted" });
  });
});

describe("ampliar y terminar", () => {
  it("se puede ampliar hasta un año desde hoy", () => {
    expect(extendMaxEndDate("2026-11-27")).toBe("2027-11-26");
  });

  it("se propone el 30 de junio siguiente al fin actual, sin pasar del máximo", () => {
    expect(defaultExtendEndDate("2027-06-30", "2026-12-01")).toBe("2027-11-30");
    expect(defaultExtendEndDate("2027-03-31", "2026-12-01")).toBe("2027-06-30");
  });

  it("valida la nueva fecha de fin: vacía, no posterior al fin actual o pasada del máximo", () => {
    expect(extendEndDateError("2027-03-31", "", "2026-12-01")).toBe("Elige la nueva fecha de fin.");
    expect(extendEndDateError("2027-03-31", "2027-03-31", "2026-12-01")).toBe("La nueva fecha tiene que ser posterior al 31/3.");
    expect(extendEndDateError("2027-03-31", "2027-12-01", "2026-12-01")).toBe(
      "Se puede ampliar hasta el 30/11 como máximo (un año desde hoy).",
    );
    expect(extendEndDateError("2027-03-31", "2027-04-01", "2026-12-01")).toBeNull();
    expect(extendEndDateError("2027-03-31", "2027-11-30", "2026-12-01")).toBeNull();
  });

  it("terminar: desde hoy en adelante y dentro de la reserva fija", () => {
    expect(endFromDateError("", "2026-12-01", "2027-06-30")).toBe("Elige desde qué día termina.");
    expect(endFromDateError("2026-11-30", "2026-12-01", "2027-06-30")).toBe("Solo se puede terminar desde hoy en adelante.");
    expect(endFromDateError("2027-07-01", "2026-12-01", "2027-06-30")).toBe(
      "No hay reservas desde ese día: la reserva fija acaba el 30/6.",
    );
    expect(endFromDateError("2026-12-01", "2026-12-01", "2027-06-30")).toBeNull();
    expect(endFromDateError("2027-06-30", "2026-12-01", "2027-06-30")).toBeNull();
  });

  it("dice cuántas se cancelaron", () => {
    expect(endSummary(0)).toBe("No se ha cancelado ninguna reserva.");
    expect(endSummary(1)).toBe("Se ha cancelado 1 reserva.");
    expect(endSummary(12)).toBe("Se han cancelado 12 reservas.");
  });
});

describe("los errores de reservas fijas", () => {
  const err = (code: string, message: string) => Object.assign(new Error(message), { code });

  it("cada código con su texto en llano, que dice qué hacer", () => {
    expect(seriesErrorText(err("BOOKING_SERIES_NOT_FOUND", "Reserva fija no encontrada"))).toBe(
      "Esa reserva fija ya no existe. Recarga la pantalla.",
    );
    expect(seriesErrorText(err("BOOKING_SERIES_ENDED", "Esta reserva fija ya está terminada"))).toBe(
      "Esta reserva fija ya está terminada. Para seguir, crea otra desde el calendario.",
    );
    expect(seriesErrorText(err("BOOKING_SERIES_EMPTY", "Ninguna de las fechas está libre"))).toMatch(/otra hora, otra pista o más semanas/);
  });

  it("en «no valen los datos» manda el mensaje del back, que dice cuál falla", () => {
    expect(seriesErrorText(err("BOOKING_SERIES_INVALID", "Esa pista no admite esa duración"))).toBe("Esa pista no admite esa duración");
    expect(seriesErrorText(err("BOOKING_SERIES_INVALID", ""))).toMatch(/Revisa la pista, la hora y las fechas/);
  });

  it("un error de otro tipo sale con su mensaje, y sin él, con un texto de reserva", () => {
    expect(seriesErrorText(err("OTRO", "Sin conexión"))).toBe("Sin conexión");
    expect(seriesErrorText(new Error(""))).toBe("No se pudo completar la operación. Inténtalo de nuevo.");
  });
});
