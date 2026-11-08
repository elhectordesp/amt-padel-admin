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
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
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
  categories: [category("c-f", "F"), category("c-mx", "MX"), category("c-g", "G"), category("c-m", "M")],
};

const list = vi.mocked(adminService.players.list);
const searchBoxes = () => screen.getAllByPlaceholderText("Buscar por nombre o email…");
const pickCategory = (id: string) => fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: id } });
// La sección de un jugador («Jugador 1» o «Jugador 2»): su buscador, sus resultados y su aviso
const slot = (label: string) => within(screen.getByText(label).parentElement!);
const SEARCH = "Buscar por nombre o email…";

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
    expect(await screen.findByRole("button", { name: /Carla Gil/ })).toHaveTextContent("Fem. · 3ª");
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

  it("mixta: si el otro se eligió en una general y no tiene género, avisa de que así no puede jugarla y su pareja se busca entre los dos", async () => {
    // El back lo manda con gender 'M' y hasGender false
    const LEO = { id: "u-leo", name: "Leo Martín", gender: "M", hasGender: false, level: "3a", points: 10 };
    list.mockImplementation(async (params) =>
      ({ data: params?.gender === "M" ? [LUIS] : params?.gender === "F" ? [CARLA] : [LEO, LUIS, CARLA] }) as any,
    );
    renderModal();
    pickCategory("c-g");
    fireEvent.change(searchBoxes()[0], { target: { value: "Leo" } });
    const leo = await screen.findByRole("button", { name: /Leo Martín/ });
    // «Sin género», no la «M» de relleno
    expect(leo).toHaveTextContent("Sin género · 3ª");
    fireEvent.click(leo);
    expect(slot("Jugador 1").getByText(/^Sin género · 3ª/)).toBeInTheDocument();
    // En la general puede jugar
    expect(screen.queryByText(/no tiene el género en su ficha:/)).not.toBeInTheDocument();

    pickCategory("c-mx");
    expect(slot("Jugador 1").getByText(
      "\"Leo Martín\" no tiene el género en su ficha: pónselo para que pueda jugar una categoría mixta.",
    )).toBeInTheDocument();

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
    // El texto de categoryGenderError del back para un jugador desde el panel
    const message = "\"Carla Gil\" no tiene el género en su perfil: sin él no puede jugar una categoría femenina. Lo puede poner desde la app, o AMT desde su ficha.";
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

describe("EnrollTeamModal — cuando cambian los géneros que admite", () => {
  const PABLO = { id: "u-pablo", name: "Pablo Ruiz", gender: "M", level: "3a", points: 20 };

  beforeEach(() => {
    vi.clearAllMocks();
    list.mockImplementation(async (params) =>
      ({ data: params?.gender === "M" ? [LUIS, PABLO] : params?.gender === "F" ? [CARLA] : [LUIS, PABLO, CARLA] }) as any,
    );
  });

  it("mixta: si se elige a un jugador después de buscar en el otro, sus resultados se rehacen con jugadoras (no siguen los de antes)", async () => {
    renderModal();
    pickCategory("c-mx");
    // El jugador 2 busca primero: jugadores y jugadoras
    fireEvent.change(slot("Jugador 2").getByPlaceholderText(SEARCH), { target: { value: "Ru" } });
    expect(await slot("Jugador 2").findByRole("button", { name: /Pablo Ruiz/ })).toBeInTheDocument();

    fireEvent.change(slot("Jugador 1").getByPlaceholderText(SEARCH), { target: { value: "Lu" } });
    fireEvent.click(await slot("Jugador 1").findByRole("button", { name: /Luis Mora/ }));

    expect(await slot("Jugador 2").findByRole("button", { name: /Carla Gil/ })).toBeInTheDocument();
    expect(slot("Jugador 2").queryByRole("button", { name: /Pablo Ruiz/ })).not.toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith({ q: "Ru", gender: "F", pageSize: 8 });
  });

  it("al cambiar la categoría, los resultados se rehacen con su regla: de la general a la femenina, fuera los jugadores", async () => {
    renderModal();
    pickCategory("c-g");
    fireEvent.change(searchBoxes()[0], { target: { value: "Lu" } });
    expect(await screen.findByRole("button", { name: /Luis Mora/ })).toBeInTheDocument();

    pickCategory("c-f");
    // Los de antes se van al momento, sin esperar a la búsqueda nueva
    expect(screen.queryByRole("button", { name: /Luis Mora/ })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Carla Gil/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Luis Mora/ })).not.toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith({ q: "Lu", gender: "F", pageSize: 8 });
  });

  it("una respuesta que llega tarde, de antes de cambiar la categoría, no pisa los resultados nuevos", async () => {
    const BEA = { id: "u-bea", name: "Bea Ruiz", gender: "F", level: "3a", points: 5 };
    let answerOld!: (page: unknown) => void;
    list.mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }) as any);
    renderModal();
    fireEvent.change(searchBoxes()[0], { target: { value: "Ru" } });
    await waitFor(() => expect(list).toHaveBeenCalledWith({ q: "Ru", gender: "F", pageSize: 8 }));

    pickCategory("c-g");
    expect(await screen.findByRole("button", { name: /Pablo Ruiz/ })).toBeInTheDocument();
    await act(async () => { answerOld({ data: [BEA] }); });

    expect(screen.queryByRole("button", { name: /Bea Ruiz/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pablo Ruiz/ })).toBeInTheDocument();
  });

  it("si al cambiar la categoría los elegidos ya no encajan, lo avisa con la regla del back; si vuelven a encajar, se va", async () => {
    renderModal();
    pickCategory("c-m");
    fireEvent.change(slot("Jugador 1").getByPlaceholderText(SEARCH), { target: { value: "Lu" } });
    fireEvent.click(await slot("Jugador 1").findByRole("button", { name: /Luis Mora/ }));
    fireEvent.change(slot("Jugador 2").getByPlaceholderText(SEARCH), { target: { value: "Pa" } });
    fireEvent.click(await slot("Jugador 2").findByRole("button", { name: /Pablo Ruiz/ }));
    expect(screen.queryByText(/no puede jugarla/)).not.toBeInTheDocument();

    // Dos jugadores en la mixta: ninguno encaja con su pareja
    pickCategory("c-mx");
    expect(slot("Jugador 1").getByText(
      "\"Luis Mora\" no puede jugarla: la categoría mixta es de un jugador y una jugadora.",
    )).toBeInTheDocument();
    expect(slot("Jugador 2").getByText(
      "\"Pablo Ruiz\" no puede jugarla: la categoría mixta es de un jugador y una jugadora.",
    )).toBeInTheDocument();

    pickCategory("c-f");
    expect(slot("Jugador 1").getByText(
      "\"Luis Mora\" no puede jugarla: la categoría femenina es solo de jugadoras.",
    )).toBeInTheDocument();

    pickCategory("c-g");
    expect(screen.queryByText(/no puede jugarla/)).not.toBeInTheDocument();
  });
});

describe("EnrollTeamModal — alta confirmada en un torneo que exige el pago (B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockImplementation(async () => ({ data: [CARLA] }) as any);
  });

  it("sin el pago, el 400 PAYMENT_REQUIRED_TO_CONFIRM se enseña tal cual, no cierra y no se reintenta forzando", async () => {
    const message = "El torneo exige el pago para confirmar. Falta por pagar: Carla Gil.";
    vi.mocked(adminService.registrations.enroll).mockRejectedValue(new ApiError(message, 400, "PAYMENT_REQUIRED_TO_CONFIRM"));
    const { onClose } = renderModal();

    fireEvent.change(searchBoxes()[0], { target: { value: "Car" } });
    fireEvent.click(await screen.findByRole("button", { name: /Carla Gil/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Sin pareja/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmada" }));
    fireEvent.click(screen.getByRole("button", { name: /Inscribir pareja/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(adminService.registrations.enroll).toHaveBeenCalledTimes(1);
    expect(vi.mocked(adminService.registrations.enroll).mock.calls[0][1]).toMatchObject({
      status: "CONFIRMED", paid: false, forceEnroll: undefined,
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
