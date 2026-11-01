/**
 * Perfil y ranking públicos (leen la API sin sesión):
 * - solo un 404 es «no encontrado»: un 429 (el back limita a 30 por minuto),
 *   un 5xx o un fallo de red se enseñan como error, no como «Jugador no
 *   encontrado» ni «Sin datos disponibles»;
 * - solo pintan nombre, categoría, SPA y puesto (decisión del 28-10), aunque
 *   el back aún mande más.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import PublicPlayerPage, { generateMetadata } from "../../../app/player/[id]/page";
import PublicRankingPage from "../../../app/ranking/page";

const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const params = Promise.resolve({ id: "p-1" });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Perfil público del jugador", () => {
  it("con un 404, «no encontrado» (notFound)", async () => {
    fetchMock.mockResolvedValue(reply({ message: "Jugador no encontrado" }, 404));
    await expect(PublicPlayerPage({ params })).rejects.toThrow("NEXT_NOT_FOUND");
    expect((await generateMetadata({ params })).title).toBe("Jugador no encontrado · AMT Pádel");
  });

  it.each([429, 500, 503])("con un %i, un error de verdad y no «no encontrado»", async (status) => {
    fetchMock.mockResolvedValue(reply({ message: "Too Many Requests" }, status));
    render(await PublicPlayerPage({ params }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido cargar el perfil");
    expect((await generateMetadata({ params })).title).toBe("Jugador · AMT Pádel");
  });

  it("sin red, también un error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    render(await PublicPlayerPage({ params }));
    expect(screen.getByRole("alert")).toHaveTextContent("No se ha podido cargar el perfil");
  });

  it("solo nombre, categoría, SPA y puesto, aunque el back aún mande foto, bio o partidos", async () => {
    fetchMock.mockResolvedValue(
      reply({
        data: {
          player: {
            id: "p-1", name: "Ana López", level: "3a", globalRank: 12, categoryRank: 3,
            spa: { spaPoints: 612.4, spaLevel: "3a" },
            // Lo que manda el back de ahora y ya no se enseña
            photoUrl: "https://img.test/ana.jpg", bio: "Zurda", city: "Valencia", played: 20, wins: 14,
          },
          tournaments: [{ name: "Open Valencia", categoryDisplay: "3a Fem.", result: "Participante" }],
        },
      }),
    );
    const { container } = render(await PublicPlayerPage({ params }));
    expect(screen.getByRole("heading", { name: "Ana López" })).toBeInTheDocument();
    expect(screen.getByText("3ª")).toBeInTheDocument();
    expect(screen.getByText("#3 Circuito")).toBeInTheDocument();
    expect(screen.getByText("· #12 general")).toBeInTheDocument();
    expect(screen.getByText("612")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    for (const hidden of ["Zurda", "Valencia", "Open Valencia", "Partidos", "Victorias"])
      expect(screen.queryByText(hidden)).not.toBeInTheDocument();
  });
});

describe("Ranking público", () => {
  it("con un 429, un error de verdad y no «Sin datos disponibles»", async () => {
    fetchMock.mockResolvedValue(reply({ message: "Too Many Requests" }, 429));
    render(await PublicRankingPage());
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("No se ha podido cargar el ranking");
    expect(screen.queryByText("Sin datos disponibles")).not.toBeInTheDocument();
  });

  it("vacío, «Sin datos disponibles»; con jugadores, solo puesto, nombre, categoría y SPA", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("gender=M")
        ? reply({ data: [{ id: "u-1", name: "Xavi Pons", level: "4a", spaPoints: 501.6, globalRank: 1, partner: "Pau", played: 9, wins: 7 }] })
        : reply({ data: [] }),
    );
    render(await PublicRankingPage());
    expect(screen.getByRole("link", { name: "Xavi Pons" })).toHaveAttribute("href", "/player/u-1");
    expect(screen.getByText("502")).toBeInTheDocument();
    expect(screen.getByText("(1 jugadores)")).toBeInTheDocument();
    expect(screen.getByText("Sin datos disponibles")).toBeInTheDocument();
    expect(screen.queryByText("Pau")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "PJ" })).not.toBeInTheDocument();
  });
});
