/**
 * Menú lateral en tablet (1024 px o menos): arranca plegado, se abre con su
 * botón y se cierra con Escape, pulsando fuera o al navegar; el foco va al
 * botón de cerrar y vuelve al de abrir.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/use-club-access", () => ({ useClubAccess: () => ({ roles: null, can: () => true }) }));
vi.mock("@/lib/use-me", () => ({ useMe: () => ({ data: undefined }), ME_QUERY_KEY: ["admin-me"] }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: vi.fn(), invalidateQueries: vi.fn() }) }));
vi.mock("@/components/admin/logout-modal", () => ({ LogoutModal: () => null }));

import { Sidebar } from "@/components/admin/sidebar";

const drawer = () => screen.getByRole("dialog", { hidden: true });

describe("Sidebar en tablet", () => {
  it("arranca plegado y se abre con su botón, con el foco en cerrar", () => {
    render(<Sidebar />);
    expect(drawer().hasAttribute("inert")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(drawer().hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cerrar menú" }));
  });

  it("se cierra con Escape y el foco vuelve al botón de abrir", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(drawer().hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Abrir menú" }));
  });

  it("se cierra al pulsar fuera", () => {
    const { container } = render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    fireEvent.click(container.querySelector("div[aria-hidden]") as Element);
    expect(drawer().hasAttribute("inert")).toBe(true);
  });

  it("se cierra al navegar", () => {
    const { rerender } = render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    nav.pathname = "/caja";
    rerender(<Sidebar />);
    expect(drawer().hasAttribute("inert")).toBe(true);
  });
});
