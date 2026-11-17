"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Trophy } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clubNoticesQK, clubNoticesService, type ClubNotice } from "@/lib/services/club-notices";
import { noticeHref, timeAgo } from "@/lib/utils/club-notices";

/**
 * La campana del equipo de un club: lo que hacen los jugadores (reservas e
 * inscripciones nuevas y anuladas), sin mirar el calendario. El número son las
 * no leídas; se refresca cada minuto. Al pulsar un aviso, va a la reserva o al
 * torneo y lo marca leído.
 */
export function ClubNoticesBell({ clubId }: { clubId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data, isError, isLoading } = useQuery({
    queryKey: clubNoticesQK.list(clubId),
    queryFn: () => clubNoticesService.list(clubId),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => clubNoticesService.markRead(clubId, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: clubNoticesQK.list(clubId) }),
  });

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  const items = data?.items ?? [];

  const openNotice = (n: ClubNotice) => {
    if (!n.read) markRead.mutate([n.id]);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Avisos del club: ${unread} sin leer` : "Avisos del club"}
        className="relative p-2 max-[1024px]:min-h-11 max-[1024px]:min-w-11 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full bg-[#D4AF37] text-[10px] font-bold leading-4 text-black text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Avisos del club"
          className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md bg-card border border-border shadow-lg overflow-hidden z-20"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold text-foreground">Avisos</p>
            <button
              type="button"
              onClick={() => markRead.mutate(undefined)}
              disabled={unread === 0 || markRead.isPending}
              className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground max-[1024px]:min-h-11 px-1"
            >
              Marcar todas como leídas
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Cargando…</p>
            ) : isError ? (
              <p className="px-3 py-4 text-xs text-destructive">No se han podido cargar los avisos.</p>
            ) : items.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground italic">
                Aún no hay avisos. Aquí verás las reservas y las inscripciones que hagan los jugadores.
              </p>
            ) : (
              items.map((n) => <NoticeRow key={n.id} notice={n} onOpen={openNotice} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NoticeRow({ notice, onOpen }: { notice: ClubNotice; onOpen: (n: ClubNotice) => void }) {
  const href = noticeHref(notice);
  const Icon = notice.type.startsWith("club_registration") ? Trophy : CalendarDays;
  const content = (
    <>
      <Icon size={14} className="mt-0.5 shrink-0 text-[#D4AF37]" />
      <span className="flex-1 min-w-0">
        <span className={`block text-xs text-foreground ${notice.read ? "" : "font-semibold"}`}>{notice.title}</span>
        <span className="block text-xs text-muted-foreground break-words">{notice.body}</span>
        <span className="block mt-0.5 text-[10px] text-muted-foreground">{timeAgo(notice.createdAt)}</span>
      </span>
      {!notice.read && <span aria-label="Sin leer" className="mt-1 w-2 h-2 shrink-0 rounded-full bg-[#D4AF37]" />}
    </>
  );
  const cls =
    "flex w-full items-start gap-2.5 px-3 py-2.5 text-left border-b border-border last:border-b-0 hover:bg-[rgba(212,175,55,0.08)] transition-colors max-[1024px]:min-h-11";
  return href ? (
    <Link href={href} onClick={() => onOpen(notice)} className={cls}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={() => onOpen(notice)} className={cls}>
      {content}
    </button>
  );
}
