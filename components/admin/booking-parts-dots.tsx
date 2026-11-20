import { PART_DOT_INFO, partDots, partsDescription } from "@/lib/utils/booking-parts";
import type { BookingPartsSummary } from "@/types/bookings";

/** Un punto de color por parte de la reserva: cobrada, debe, invitada o sin cobrar. */
export function BookingPartsDots({ summary }: { summary: BookingPartsSummary }) {
  const description = partsDescription(summary);
  return (
    <span className="flex items-center gap-0.5" title={description}>
      {partDots(summary).map((key, i) => (
        <span key={i} aria-hidden className={`h-2 w-2 rounded-full ${PART_DOT_INFO[key].className}`} />
      ))}
      <span className="sr-only">{description}</span>
    </span>
  );
}

/** La leyenda de los puntos, para la del calendario. */
export function PartsLegendItems() {
  return (
    <>
      {(Object.keys(PART_DOT_INFO) as (keyof typeof PART_DOT_INFO)[]).map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 rounded-full ${PART_DOT_INFO[key].className}`} /> {PART_DOT_INFO[key].legend}
        </li>
      ))}
    </>
  );
}
