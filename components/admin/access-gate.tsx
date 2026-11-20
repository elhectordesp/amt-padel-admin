"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Header } from "@/components/admin/header";
import { areaForPath, NO_SECTION_ACCESS_MESSAGE } from "@/lib/club-permissions";
import { useClubAccess } from "@/lib/use-club-access";

/**
 * Si el rol del equipo no puede ni leer la sección de la página, enseña un
 * aviso en lugar de la página (que solo traería errores 403).
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can } = useClubAccess();
  const area = areaForPath(pathname);

  if (area && !can(area, "read")) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Sin acceso" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-3">
            <Lock size={28} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-foreground">{NO_SECTION_ACCESS_MESSAGE}</p>
            <p className="text-xs text-muted-foreground">
              Si lo necesitas, pídele al propietario del club que amplíe tus roles.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
