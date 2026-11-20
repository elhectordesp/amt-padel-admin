/**
 * /mi-club/escuela — la escuela del club: los grupos con su entrenador y su
 * horario semanal, las clases privadas, las cuotas mensuales de los grupos
 * (todo se cobra en el mostrador) y los entrenadores. El gestor da de alta el grupo, mete a
 * los alumnos y el sistema reserva las pistas de todas las clases de la
 * temporada. Un entrenador ve primero «Mis grupos» y solo puede pasar lista.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2, Plus } from "lucide-react";
import { ErrorState } from "@/components/admin/error-state";
import { Header } from "@/components/admin/header";
import { SchoolCoachesSection } from "@/components/admin/school-coaches-section";
import { SchoolFeesSection } from "@/components/admin/school-fees-section";
import { SchoolGroupDialog } from "@/components/admin/school-group-dialog";
import { SchoolPrivateClassesSection } from "@/components/admin/school-private-classes-section";
import { SchoolInboxSection } from "@/components/admin/school-inbox-section";
import { SchoolRecoveriesSection } from "@/components/admin/school-recoveries-section";
import { Button } from "@/components/ui/button";
import { schoolQK, schoolService } from "@/lib/services/school";
import { schoolRecoveryQK, schoolRecoveryService } from "@/lib/services/school-recovery";
import { useClubAccess } from "@/lib/use-club-access";
import { useClubTimeZone } from "@/lib/use-club-time-zone";
import { useMe } from "@/lib/use-me";
import { useRole, isClub } from "@/lib/use-role";
import { monthlyFeeText, slotsSummary } from "@/lib/utils/school";
import { formatDayKey } from "@/lib/utils/time-zone";
import type { SchoolGroupListItem } from "@/types/school";

type Tab = "groups" | "inbox" | "privateClasses" | "fees" | "recoveries" | "coaches";

const SEASON_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

function GroupCard({ group }: { group: SchoolGroupListItem }) {
  return (
    <li>
      <Link
        href={`/mi-club/escuela/grupos/${group.id}`}
        className="block space-y-1 rounded-lg border border-border p-3 text-sm transition-colors hover:border-[rgba(212,175,55,0.4)] hover:bg-secondary/40"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">
            {group.name}
            {group.level && <span className="ml-2 text-xs font-normal text-muted-foreground">{group.level}</span>}
            {group.archivedAt && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Archivado</span>}
          </span>
          <span className="text-xs text-muted-foreground">
            {group.activeStudents} de {group.maxStudents} alumnos
          </span>
        </div>
        <div className="text-xs text-muted-foreground">{slotsSummary(group.slots)}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{group.coach ? `Entrenador: ${group.coach.name}` : "Sin entrenador"}</span>
          <span>{monthlyFeeText(group.monthlyFeeCents)}</span>
          <span>
            {formatDayKey(group.startDate, SEASON_FMT)} – {formatDayKey(group.endDate, SEASON_FMT)}
          </span>
          {!group.archivedAt && (
            <span>
              {group.upcomingSessions} {group.upcomingSessions === 1 ? "clase próxima" : "clases próximas"}
            </span>
          )}
          {group.upcomingWithoutCourt > 0 && (
            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-500">
              {group.upcomingWithoutCourt} sin pista
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

export default function EscuelaPage() {
  const { role, clubId } = useRole();
  const router = useRouter();
  const enabled = !!clubId && isClub(role);
  const { can } = useClubAccess();
  const canWrite = can("school", "write");
  const canPickCustomer = can("customers", "read");
  // «Mis grupos» depende de quién es: sin saberlo no se reparten (así no saltan de sitio)
  const { data: me, isLoading: meLoading } = useMe();
  const [tab, setTab] = useState<Tab>("groups");
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { timeZone, isError: timeZoneError, refetch: refetchTimeZone } = useClubTimeZone(clubId, enabled);

  const groups = useQuery({
    queryKey: schoolQK.groups(clubId ?? "", showArchived),
    queryFn: () => schoolService.groups.list(clubId!, showArchived),
    enabled,
  });
  // Las solicitudes pendientes, para el contador de la pestaña (la bandeja usa la misma consulta)
  const pendingRequests = useQuery({
    queryKey: schoolRecoveryQK.requests(clubId ?? "", "PENDING"),
    queryFn: () => schoolRecoveryService.requests.list(clubId!, "PENDING"),
    enabled,
  });
  const pendingCount = pendingRequests.data?.length ?? 0;

  if (role === null) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!enabled) {
    return (
      <>
        <Header title="Escuela" />
        <p className="p-4 sm:p-6 text-sm text-muted-foreground">Requiere usuario CLUB con club asignado.</p>
      </>
    );
  }

  const list = groups.data ?? [];
  const mine = me ? list.filter((g) => g.coach?.userId === me.id) : [];
  const others = list.filter((g) => !mine.includes(g));

  return (
    <>
      <Header title="Escuela" />
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
            {canWrite
              ? "Los grupos de tu escuela con su entrenador y su horario semanal. Al generar las clases, el sistema reserva la pista de cada una."
              : "Tus grupos de la escuela. Desde cada clase puedes pasar lista."}
          </p>
          {canWrite && tab === "groups" && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> Nuevo grupo
            </Button>
          )}
        </div>

        <div role="tablist" aria-label="Escuela" className="flex flex-wrap gap-1 text-sm">
          {(
            [
              ["groups", "Grupos"],
              ["inbox", pendingCount > 0 ? `Bandeja (${pendingCount})` : "Bandeja"],
              ["privateClasses", "Clases privadas"],
              ...(canWrite
                ? ([
                    ["fees", "Cuotas"],
                    ["recoveries", "Recuperaciones"],
                    ["coaches", "Entrenadores"],
                  ] as const)
                : []),
            ] as readonly (readonly [Tab, string])[]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                tab === value
                  ? "bg-[rgba(212,175,55,0.12)] font-semibold text-[#D4AF37]"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "privateClasses" ? (
          <SchoolPrivateClassesSection clubId={clubId!} canWrite={canWrite} />
        ) : tab === "fees" && canWrite ? (
          <SchoolFeesSection clubId={clubId!} canWrite={canWrite} />
        ) : tab === "coaches" && canWrite ? (
          <SchoolCoachesSection clubId={clubId!} canWrite={canWrite} />
        ) : (tab === "inbox" || (tab === "recoveries" && canWrite)) && !timeZone ? (
          timeZoneError ? (
            <ErrorState
              title="No se ha podido cargar la zona horaria del club"
              message="Sin ella no se pueden enseñar las horas de las clases."
              onRetry={() => void refetchTimeZone()}
            />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )
        ) : tab === "inbox" && timeZone ? (
          <SchoolInboxSection
            clubId={clubId!}
            timeZone={timeZone}
            canWrite={canWrite}
            canPickCustomer={canPickCustomer}
          />
        ) : tab === "recoveries" && canWrite && timeZone ? (
          <SchoolRecoveriesSection clubId={clubId!} timeZone={timeZone} />
        ) : groups.isLoading || meLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : groups.isError ? (
          <ErrorState onRetry={() => void groups.refetch()} />
        ) : (
          <div className="space-y-5">
            {mine.length > 0 && (
              <section aria-label="Mis grupos" className="space-y-2">
                <h2 className="text-base font-medium">Mis grupos</h2>
                <ul className="space-y-2">
                  {mine.map((g) => (
                    <GroupCard key={g.id} group={g} />
                  ))}
                </ul>
              </section>
            )}

            {(others.length > 0 || mine.length === 0) && (
              <section aria-label={mine.length > 0 ? "Resto de grupos" : "Grupos"} className="space-y-2">
                {mine.length > 0 && <h2 className="text-base font-medium">Resto de grupos</h2>}
                {others.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
                    <GraduationCap className="h-7 w-7 opacity-50" />
                    {canWrite
                      ? showArchived
                        ? "No hay grupos archivados."
                        : "Aún no hay grupos. Crea el primero con su horario semanal."
                      : "Todavía no llevas ningún grupo."}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {others.map((g) => (
                      <GroupCard key={g.id} group={g} />
                    ))}
                  </ul>
                )}
              </section>
            )}

            {canWrite && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                Ver solo los archivados
              </label>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <SchoolGroupDialog
          clubId={clubId!}
          onClose={() => setShowCreate(false)}
          onSaved={(groupId) => {
            setShowCreate(false);
            router.push(`/mi-club/escuela/grupos/${groupId}`);
          }}
        />
      )}
    </>
  );
}
