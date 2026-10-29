"use client";

/**
 * Marco de las páginas de reservas del club: la cabecera del panel arriba y
 * a todo el ancho, como en el resto de páginas, y debajo el enlace de volver
 * y el contenido. Antes el enlace iba encima de la cabecera, dentro del
 * relleno: en el móvil lo tapaba el botón del menú (fijo arriba a la
 * izquierda, del que la cabecera ya se aparta), y la cabecera se encogía si
 * compartía fila con otros botones.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/admin/header";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  /** A dónde vuelve el enlace de arriba (por defecto, la portada de Reservas). */
  back?: { href: string; label: string };
  /** Clases del contenido (p. ej. un ancho máximo). */
  className?: string;
  children: React.ReactNode;
}

const RESERVAS_HOME = { href: "/mi-club/reservas", label: "Volver a Reservas" };

export function ReservasPage({ title, back = RESERVAS_HOME, className, children }: Props) {
  return (
    <>
      <Header title={title} />
      <div className={cn("p-4 sm:p-6", className)}>
        {/* En su propia línea: si el contenido empieza con algo en línea
            (Día/Semana del calendario), no se le pega al lado */}
        <div>
          <Link
            href={back.href}
            className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> {back.label}
          </Link>
        </div>
        {children}
      </div>
    </>
  );
}
