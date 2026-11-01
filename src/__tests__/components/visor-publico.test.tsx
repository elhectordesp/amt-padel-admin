/**
 * Visor público: «En directo» solo con el torneo en curso, el estado por su
 * nombre (salía «FINISHED») y una categoría sin cuadro ni partidos lo dice en
 * vez de salir en blanco.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import TournamentViewer from "../../../app/torneo/[id]/viewer";

const renderViewer = (status: string) =>
  render(
    <TournamentViewer
      tournamentId="t-1"
      tournament={{ id: "t-1", name: "Open de otoño", tier: "BRONZE", status, club: { name: "Club Madrid" }, timezone: "Europe/Madrid" }}
      initialCats={[{ cat: { id: "c-1", gender: "M", level: "4a" }, groups: [], bracket: null }]}
      initialMatches={[]}
    />,
  );

describe("Visor público", () => {
  it("finalizado: sin «En directo» y con el estado por su nombre", () => {
    renderViewer("finished");
    expect(screen.queryByText("En directo")).not.toBeInTheDocument();
    expect(screen.getAllByText("Finalizado").length).toBeGreaterThan(0);
    expect(screen.queryByText(/finished/i)).not.toBeInTheDocument();
  });

  it("en curso: «En directo»", () => {
    renderViewer("ongoing");
    expect(screen.getByText("En directo")).toBeInTheDocument();
  });

  it("una categoría sin cuadro ni partidos lo dice", () => {
    renderViewer("open");
    expect(screen.getByText("Esta categoría aún no tiene cuadro ni partidos publicados.")).toBeInTheDocument();
  });
});
