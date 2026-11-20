import type { SchoolStudentMinor } from "@/types/school";

/**
 * Distintivo «Menor» de un alumno de la escuela (con su edad al pasar el ratón).
 * Sin fecha de nacimiento no se sabe y no sale: se trata como adulto.
 */
export function SchoolMinorBadge({ student }: { student: SchoolStudentMinor }) {
  if (!student.isMinor) return null;
  const years = student.age != null ? `${student.age} ${student.age === 1 ? "año" : "años"}` : undefined;
  return (
    <span
      title={years}
      className="ml-2 rounded-full border border-border px-2 py-0.5 text-xs font-normal text-muted-foreground"
    >
      Menor
    </span>
  );
}

/**
 * Nombre y teléfono del tutor de un menor: es a quien avisa el entrenador (que
 * se ausenta, que se retrasa la clase...). El teléfono se puede pulsar para
 * llamar desde el móvil. Un menor sin tutor apuntado lo dice, para que se
 * rellene en su ficha de cliente.
 */
export function SchoolGuardianLine({ student }: { student: SchoolStudentMinor }) {
  const { guardianName, guardianPhone } = student;
  if (!guardianName && !guardianPhone) {
    return student.isMinor ? (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Sin tutor apuntado: añádelo en su ficha de cliente.
      </p>
    ) : null;
  }
  return (
    <p className="text-xs text-muted-foreground">
      Tutor: {guardianName ?? "sin nombre"}
      {guardianPhone && (
        <>
          {" · "}
          <a href={`tel:${guardianPhone.replace(/\s+/g, "")}`} className="underline-offset-2 hover:underline">
            {guardianPhone}
          </a>
        </>
      )}
    </p>
  );
}
