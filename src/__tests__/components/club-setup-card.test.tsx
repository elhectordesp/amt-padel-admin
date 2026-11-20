import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClubSetupSteps } from "@/components/admin/club-setup-card";
import type { ClubSetupProgress } from "@/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const progress = (done: boolean[]): ClubSetupProgress => ({
  steps: (["COURTS", "SCHEDULE", "PRICES", "RULES"] as const).map((code, i) => ({ code, done: done[i] })),
  complete: done.every(Boolean),
});

describe("ClubSetupSteps", () => {
  it("cada paso sale hecho o pendiente y enlaza a su pantalla", () => {
    render(<ClubSetupSteps progress={progress([true, false, false, true])} />);
    expect(screen.getByText("Puesta en marcha")).toBeTruthy();
    expect(screen.getByText("2 de 4 hechos")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Pistas/ }).getAttribute("href")).toBe("/mi-club/reservas/pistas");
    expect(screen.getByRole("link", { name: /Horario semanal/ }).textContent).toContain("Pendiente");
    expect(screen.getByRole("link", { name: /Precios/ }).getAttribute("href")).toBe("/mi-club/reservas/precios");
    expect(screen.getByRole("link", { name: /Normas/ }).textContent).toContain("Hecho");
  });

  it("desaparece cuando todo está hecho", () => {
    const { container } = render(<ClubSetupSteps progress={progress([true, true, true, true])} />);
    expect(container.innerHTML).toBe("");
  });
});
