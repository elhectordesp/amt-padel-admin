/**
 * Soporte dice quién escribe y se puede buscar por su nombre (P2-13): el
 * panel pintaba firstName/lastName y el back solo mandaba `name`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/admin/header", () => ({ Header: () => null }));
const supportMock = vi.hoisted(() => ({ list: vi.fn(), updateStatus: vi.fn() }));
vi.mock("@/lib/services/admin", () => ({ adminService: { support: supportMock } }));

import SoportePage from "../../../app/(admin)/soporte/page";

const message = (id: string, user: Record<string, unknown>, text: string) => ({
  id,
  subject: "OTRO",
  message: text,
  status: "READ",
  createdAt: "2026-10-20T10:00:00.000Z",
  user: { id: `u-${id}`, email: null, ...user },
});

describe("Soporte — quién escribe", () => {
  beforeEach(() => {
    supportMock.list.mockResolvedValue([
      message("1", { firstName: "Íñigo", lastName: "Núñez", name: "Íñigo Núñez", email: "inigo@x.com" }, "No me deja inscribirme"),
      // Un back anterior: solo `name`
      message("2", { name: "Bea Ruiz" }, "Cambio de pareja"),
    ]);
  });

  it("pinta nombre y apellidos, o `name` si no los trae", async () => {
    render(<SoportePage />);
    expect(await screen.findByText("Íñigo Núñez")).toBeInTheDocument();
    expect(screen.getByText("Bea Ruiz")).toBeInTheDocument();
  });

  it("busca por el nombre, sin mirar tildes", async () => {
    render(<SoportePage />);
    await screen.findByText("Íñigo Núñez");
    fireEvent.change(screen.getByPlaceholderText("Buscar por nombre, email, asunto o texto..."), {
      target: { value: "inigo nunez" },
    });
    expect(screen.getByText("Íñigo Núñez")).toBeInTheDocument();
    expect(screen.queryByText("Bea Ruiz")).not.toBeInTheDocument();
  });
});
