"use client";

/**
 * «Cuentas» → «Ocupación» (F8, C4b): cuánto del tiempo abierto de las pistas
 * está ocupado, en total y por tipo (reservas, contrato de pistas, clases y
 * eventos), por pista, franja, hora y día de la semana; y el efecto de un
 * cambio de precios: las 4 semanas de antes frente a las de después.
 * Las barras son de CSS (con la leyenda y las cifras al lado: el color no es
 * lo único que dice cada tipo).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Loader2 } from "lucide-react";
import { ErrorState } from "@/components/admin/error-state";
import {
  OCCUPANCY_BANDS, OCCUPANCY_TYPES, occupancyQK, occupancyService,
  type OccupancyCell, type PriceChange, type PriceMetrics,
} from "@/lib/services/club-occupancy";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { formatCents } from "@/lib/utils/booking-price";
import {
  OCCUPANCY_BAND_LABEL, OCCUPANCY_PRESETS, OCCUPANCY_TYPE_BAR, OCCUPANCY_TYPE_LABEL, WEEKDAY_LABEL,
  formatMinutes, formatPct, presetRange, rangeError,
  type OccupancyPreset,
} from "@/lib/utils/club-occupancy";
import { formatDayKey, zonedDayKey } from "@/lib/utils/time-zone";

const DAY: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const dateInputCls =
  "h-9 rounded-md border border-border bg-secondary px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-[#D4AF37]";

/** Una barra apilada: lo ocupado por tipo sobre el tiempo abierto. */
function OccupancyBar({ cell, label }: { cell: OccupancyCell; label: string }) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${formatPct(cell.pct)} ocupado`}
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary"
    >
      {cell.openMinutes > 0 &&
        OCCUPANCY_TYPES.map((t) =>
          cell.byType[t] > 0 ? (
            <div
              key={t}
              className={OCCUPANCY_TYPE_BAR[t]}
              style={{ width: `${(cell.byType[t] / cell.openMinutes) * 100}%` }}
            />
          ) : null,
        )}
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {OCCUPANCY_TYPES.map((t) => (
        <li key={t} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${OCCUPANCY_TYPE_BAR[t]}`} />
          {OCCUPANCY_TYPE_LABEL[t]}
        </li>
      ))}
    </ul>
  );
}

/** Un bloque de filas: nombre, barra, porcentaje y horas ocupadas de las abiertas. */
function BreakdownBlock({ title, rows }: { title: string; rows: { key: string; label: string; cell: OccupancyCell }[] }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin tiempo abierto en este rango.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ key, label, cell }) => (
            <li key={key} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_auto]">
              <span className="truncate text-foreground">{label}</span>
              <OccupancyBar cell={cell} label={label} />
              <span className="whitespace-nowrap text-right text-muted-foreground">
                <span className="font-medium text-foreground">{formatPct(cell.pct)}</span>
                {" · "}
                {formatMinutes(cell.occupiedMinutes)} de {formatMinutes(cell.openMinutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const money = (cents: number | null) => (cents === null ? "—" : formatCents(cents));

function PriceChangeBlock({ clubId, today }: { clubId: string; today: string | null }) {
  const [date, setDate] = useState("");
  const query = useQuery({
    queryKey: occupancyQK.priceChange(clubId, date),
    queryFn: () => occupancyService.priceChange(clubId, date),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(date),
  });
  const data: PriceChange | undefined = query.data;

  const rows: { key: string; label: string; before: PriceMetrics; after: PriceMetrics | null }[] = data
    ? [
        { key: "TOTAL", label: "Total", before: data.before.total, after: data.after?.total ?? null },
        ...OCCUPANCY_BANDS.map((b) => ({
          key: b,
          label: OCCUPANCY_BAND_LABEL[b],
          before: data.before.byBand[b],
          after: data.after?.byBand[b] ?? null,
        })),
      ]
    : [];

  return (
    <section aria-label="Efecto de un cambio de precios" className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efecto de un cambio de precios</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Elige el día en que cambiaron los precios: se comparan las 4 semanas de antes con las 4 de después (hasta hoy).
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays size={14} />
        <span>Fecha del cambio</span>
        <input
          type="date"
          aria-label="Fecha del cambio de precios"
          value={date}
          max={today ?? undefined}
          onChange={(e) => setDate(e.target.value)}
          className={dateInputCls}
        />
        {query.isFetching && <Loader2 size={14} className="animate-spin" />}
      </label>

      {query.isError && (
        <ErrorState title="No se pudo calcular el efecto del cambio" onRetry={() => query.refetch()} />
      )}

      {data && (
        <div className="mt-4 flex flex-col gap-3">
          {data.lowData && (
            <p role="status" className="rounded-md border border-gold-border bg-gold-muted px-3 py-2 text-sm text-foreground">
              Pocos datos: menos de 7 días después del cambio.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Antes: {formatDayKey(data.before.from, DAY)} – {formatDayKey(data.before.to, DAY)} ({data.before.days} días).{" "}
            {data.after
              ? `Después: ${formatDayKey(data.after.from, DAY)} – ${formatDayKey(data.after.to, DAY)} (${data.after.days} días).`
              : "Esa fecha todavía no ha llegado: aún no hay datos de después."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1.5 pr-3 font-medium">Franja</th>
                  <th scope="col" className="px-3 font-medium">Ocupación antes</th>
                  <th scope="col" className="px-3 font-medium">Ocupación después</th>
                  <th scope="col" className="px-3 font-medium">Precio medio por hora, antes</th>
                  <th scope="col" className="px-3 font-medium">Precio medio por hora, después</th>
                  <th scope="col" className="px-3 font-medium">Reservado por día abierto, antes</th>
                  <th scope="col" className="pl-3 font-medium">Reservado por día abierto, después</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">{r.label}</th>
                    <td className="px-3 text-muted-foreground">{formatPct(r.before.pct)}</td>
                    <td className="px-3 text-foreground">{r.after ? formatPct(r.after.pct) : "—"}</td>
                    <td className="px-3 text-muted-foreground">{money(r.before.avgPricePerHourCents)}</td>
                    <td className="px-3 text-foreground">{money(r.after?.avgPricePerHourCents ?? null)}</td>
                    <td className="px-3 text-muted-foreground">{money(r.before.bookedPerOpenDayCents)}</td>
                    <td className="pl-3 text-foreground">{money(r.after?.bookedPerOpenDayCents ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export function AccountsOccupancySection({ clubId }: { clubId: string }) {
  const { timeZone } = useClubTimeZone(clubId);
  const today = timeZone ? zonedDayKey(new Date(), timeZone) : null;
  const [preset, setPreset] = useState<OccupancyPreset>("MONTH");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range =
    preset === "CUSTOM"
      ? { from: customFrom, to: customTo }
      : today
        ? presetRange(preset, today)
        : { from: "", to: "" };
  const error = preset === "CUSTOM" ? rangeError(range.from, range.to) : null;
  const ready = !!range.from && !!range.to && !error;

  const query = useQuery({
    queryKey: occupancyQK.range(clubId, range.from, range.to),
    queryFn: () => occupancyService.get(clubId, range.from, range.to),
    enabled: ready,
  });
  const data = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Rango" className="flex gap-1">
          {OCCUPANCY_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              aria-pressed={preset === p.value}
              onClick={() => setPreset(p.value)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                preset === p.value
                  ? "border-gold-border bg-gold-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "CUSTOM" && (
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Desde</span>
              <input type="date" aria-label="Desde" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={dateInputCls} />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Hasta</span>
              <input type="date" aria-label="Hasta" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={dateInputCls} />
            </label>
          </>
        )}
        {query.isFetching && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </div>
      {error && customFrom && customTo && (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      )}

      {query.isError && <ErrorState title="No se pudo cargar la ocupación" onRetry={() => query.refetch()} />}

      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            {formatDayKey(data.from, DAY)} – {formatDayKey(data.to, DAY)}. Solo cuenta el tiempo en que las pistas están abiertas
            (sin las que están en mantenimiento).
          </p>

          <section aria-label="Ocupación total" className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocupación total</p>
                <p className="font-heading text-3xl text-foreground">{formatPct(data.totals.pct)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMinutes(data.totals.occupiedMinutes)} de {formatMinutes(data.totals.openMinutes)} abiertas
                </p>
              </div>
              {OCCUPANCY_TYPES.map((t) => (
                <div key={t}>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-full ${OCCUPANCY_TYPE_BAR[t]}`} />
                    {OCCUPANCY_TYPE_LABEL[t]}
                  </p>
                  <p className="text-lg font-medium text-foreground">
                    {formatPct(data.totals.openMinutes > 0 ? Math.round((data.totals.byType[t] / data.totals.openMinutes) * 1000) / 10 : 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatMinutes(data.totals.byType[t])}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <OccupancyBar cell={data.totals} label="Total" />
              <Legend />
            </div>
          </section>

          <BreakdownBlock
            title="Por pista"
            rows={data.byCourt.map((c) => ({ key: c.courtId, label: c.name, cell: c }))}
          />
          <BreakdownBlock
            title="Por franja"
            rows={OCCUPANCY_BANDS.map((b) => ({ key: b, label: OCCUPANCY_BAND_LABEL[b], cell: data.byBand[b] }))}
          />
          <BreakdownBlock
            title="Por hora"
            rows={data.byHour
              .filter((h) => h.openMinutes > 0)
              .map((h) => ({ key: String(h.hour), label: `${String(h.hour).padStart(2, "0")}:00`, cell: h }))}
          />
          <BreakdownBlock
            title="Por día de la semana"
            rows={data.byWeekday.map((d) => ({ key: String(d.weekday), label: WEEKDAY_LABEL[d.weekday - 1], cell: d }))}
          />
        </>
      )}

      <PriceChangeBlock clubId={clubId} today={today} />
    </div>
  );
}
