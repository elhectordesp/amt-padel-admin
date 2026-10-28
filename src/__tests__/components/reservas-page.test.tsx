/**
 * Marco de las páginas de reservas: la cabecera del panel va primero y fuera
 * del contenido, como en el resto de páginas. Con «Volver a Reservas» encima,
 * en el móvil lo tapaba el botón del menú, y la cabecera se encogía al
 * compartir fila con otros botones.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <header data-testid="header">{title}</header>,
}));

import { ReservasPage } from "@/components/admin/reservas-page";

describe("ReservasPage", () => {
  it("cabecera arriba y aparte; debajo, volver y el contenido", () => {
    render(
      <ReservasPage title="Calendario de reservas">
        <button type="button">Día</button>
      </ReservasPage>,
    );
    const header = screen.getByTestId("header");
    const back = screen.getByRole("link", { name: "Volver a Reservas" });
    const content = back.parentElement!;

    expect(header).toHaveTextContent("Calendario de reservas");
    expect(back).toHaveAttribute("href", "/mi-club/reservas");
    // La cabecera va antes que el enlace y no dentro del contenido
    expect(header.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(content).not.toContainElement(header);
    // Ni comparte fila con los botones de la página
    expect(content).toContainElement(screen.getByRole("button", { name: "Día" }));
    expect(header.parentElement).not.toBe(screen.getByRole("button", { name: "Día" }).parentElement);
  });

  it("el enlace de volver puede ir a otro sitio (el detalle vuelve al listado)", () => {
    render(
      <ReservasPage title="Reserva" back={{ href: "/mi-club/reservas/bookings", label: "Volver al listado" }} className="max-w-4xl">
        <p>Detalle</p>
      </ReservasPage>,
    );
    const back = screen.getByRole("link", { name: "Volver al listado" });
    expect(back).toHaveAttribute("href", "/mi-club/reservas/bookings");
    expect(back.parentElement).toHaveClass("max-w-4xl");
  });
});
