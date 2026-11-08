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

  it("cada categoría con su género: la mixta, la general y la junior (antes salían «Femenino»)", () => {
    render(
      <TournamentViewer
        tournamentId="t-1"
        tournament={{ id: "t-1", name: "Open de otoño", tier: "BRONZE", status: "open", club: { name: "Club Madrid" }, timezone: "Europe/Madrid" }}
        initialCats={[
          { cat: { id: "c-1", gender: "MX", level: "3a" }, groups: [], bracket: null },
          { cat: { id: "c-2", gender: "G",  level: "4a" }, groups: [], bracket: null },
          { cat: { id: "c-3", gender: "J",  level: "iniciacion" }, groups: [], bracket: null },
        ]}
        initialMatches={[]}
      />,
    );
    expect(screen.getByRole("button", { name: "Mixta · 3ª" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "General · 4ª" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Junior · Iniciación" })).toBeInTheDocument();
    expect(screen.queryByText(/Femenin/)).not.toBeInTheDocument();
  });

  it("descripción y normas en texto plano, con sus saltos de línea y sin interpretar HTML ni markdown (B5-1)", () => {
    const description = "Open de otoño\nCon <b>cena</b> y **trofeo**";
    const rules = "1. Puntualidad\n2. Bolas nuevas";
    render(
      <TournamentViewer
        tournamentId="t-1"
        tournament={{ id: "t-1", name: "Open de otoño", tier: "BRONZE", status: "open", club: { name: "Club Madrid" }, timezone: "Europe/Madrid", description, rules }}
        initialCats={[{ cat: { id: "c-1", gender: "M", level: "4a" }, groups: [], bracket: null }]}
        initialMatches={[]}
      />,
    );
    const desc = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === description);
    expect(desc).toHaveClass("whitespace-pre-line");
    expect(desc.querySelector("b")).toBeNull();
    expect(screen.getByText("Normas del torneo")).toBeInTheDocument();
    const rulesText = screen.getByText((_, el) => el?.tagName === "P" && el.textContent === rules);
    expect(rulesText).toHaveClass("whitespace-pre-line");
  });

  it("sin descripción ni normas, no sale nada de ellas", () => {
    renderViewer("open");
    expect(screen.queryByText("Normas del torneo")).not.toBeInTheDocument();
  });
});
