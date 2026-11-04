/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Inscribir una pareja desde el panel (D2): los buscadores de los dos
 * jugadores solo ofrecen a quien puede jugar la categoría elegida (masculina,
 * jugadores; femenina, jugadoras; mixta, del otro género que su pareja;
 * general y junior, cualquiera), con una pista para quien no sale por no
 * tener el género en su ficha. Si aun así el back lo rechaza, se enseña su
 * aviso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    players:       { list: vi.fn(), create: vi.fn() },
    registrations: { enroll: vi.fn() },
  },
  invalidateRegistrations: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { EnrollTeamModal } from "../../../components/admin/enroll-team-modal";
import { adminService } from "@/lib/services/admin";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

const LUIS  = { id: "u-luis",  name: "Luis Mora", gender: "M", level: "3a", points: 40 };
const CARLA = { id: "u-carla", name: "Carla Gil", gender: "F", level: "3a", points: 30 };

const category = (id: string, gender: string) =>
  ({ id, gender, level: "3a", totalSpots: 8, occupiedCount: 0, confirmedCount: 0, waitlistCount: 0 });
const TOURNAMENT: any = {
  id: "t1",
  name: "Open de otoño",
  status: "OPEN",
  categories: [category("c-f", "F"), category("c-mx", "MX"), category("c-g", "G")],
};

const list = vi.mocked(adminService.players.list);
const searchBoxes = () => screen.getAllByPlaceholderText("Buscar por nombre o email…");
const pickCategory = (id: string) => fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: id } });

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <EnrollTeamModal tournament={TOURNAMENT} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("EnrollTeamModal — quién sale en los buscadores por su género", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockImplementation(async (params) =>
      ({ data: params?.gender === "M" ? [LUIS] : params?.gender === "F" ? [CARLA] : [LUIS, CARLA] }) as any,
    );
  });

  it("femenina: los dos buscadores piden jugadoras y dicen qué hacer si falta alguien", async () => {
    renderModal();

    expect(screen.getAllByText(
      "Femenina: solo salen jugadoras con el género en su ficha. Si falta alguien, ponle el género en su ficha.",
    )).toHaveLength(2);
    fireEvent.change(searchBoxes()[0], { target: { value: "Car" } });
    await screen.findByRole("button", { name: /Carla Gil/ });
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ q: "Car", gender: "F", pageSize: 8 });
  });

  it("mixta: sin pareja elegida, jugadores y jugadoras; con un jugador, su pareja se busca entre jugadoras", async () => {
    renderModal();
    pickCategory("c-mx");

    fireEvent.change(searchBoxes()[0], { target: { value: "Lu" } });
    fireEvent.click(await screen.findByRole("button", { name: /Luis Mora/ }));
    expect(list).toHaveBeenCalledWith({ q: "Lu", gender: "M", pageSize: 8 });
    expect(list).toHaveBeenCalledWith({ q: "Lu", gender: "F", pageSize: 8 });

    list.mockClear();
    expect(screen.getByText(/^Mixta, un jugador y una jugadora: solo salen jugadoras con el género/)).toBeInTheDocument();
    fireEvent.change(searchBoxes()[1], { target: { value: "Car" } });
    await screen.findByRole("button", { name: /Carla Gil/ });
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ q: "Car", gender: "F", pageSize: 8 });
  });

  it("mixta: si el otro se eligió en una general y no tiene género, su pareja se busca entre los dos, no entre jugadoras", async () => {
    // El back lo manda con gender 'M' y hasGender false
    const LEO = { id: "u-leo", name: "Leo Martín", gender: "M", hasGender: false, level: "3a", points: 10 };
    list.mockImplementation(async (params) =>
      ({ data: params?.gender === "M" ? [LUIS] : params?.gender === "F" ? [CARLA] : [LEO, LUIS, CARLA] }) as any,
    );
    renderModal();
    pickCategory("c-g");
    fireEvent.change(searchBoxes()[0], { target: { value: "Leo" } });
    fireEvent.click(await screen.findByRole("button", { name: /Leo Martín/ }));
    pickCategory("c-mx");

    list.mockClear();
    expect(screen.getByText(/^Mixta, un jugador y una jugadora: solo salen jugadores y jugadoras con el género/)).toBeInTheDocument();
    fireEvent.change(searchBoxes()[1], { target: { value: "Gil" } });
    await screen.findByRole("button", { name: /Carla Gil/ });
    expect(list).toHaveBeenCalledWith({ q: "Gil", gender: "M", pageSize: 8 });
    expect(list).toHaveBeenCalledWith({ q: "Gil", gender: "F", pageSize: 8 });
  });

  it("general: cualquiera, también sin género, y sin pista", async () => {
    renderModal();
    pickCategory("c-g");

    expect(screen.queryByText(/con el género en su ficha/)).not.toBeInTheDocument();
    fireEvent.change(searchBoxes()[0], { target: { value: "Lu" } });
    await screen.findByRole("button", { name: /Luis Mora/ });
    expect(list).toHaveBeenCalledWith({ q: "Lu", pageSize: 8 });
  });

  it("si el back dice que al jugador le falta el género (GENDER_REQUIRED), enseña su aviso y no cierra", async () => {
    const message = "\"Carla Gil\" no tiene el género en su ficha: pónselo para inscribirlo en una categoría femenina.";
    vi.mocked(adminService.registrations.enroll).mockRejectedValue(new ApiError(message, 400, "GENDER_REQUIRED"));
    const { onClose } = renderModal();

    fireEvent.change(searchBoxes()[0], { target: { value: "Car" } });
    fireEvent.click(await screen.findByRole("button", { name: /Carla Gil/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Sin pareja/ }));
    fireEvent.click(screen.getByRole("button", { name: /Inscribir pareja/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(onClose).not.toHaveBeenCalled();
  });
});
