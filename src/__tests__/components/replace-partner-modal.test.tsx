/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * El modal de la pareja: la pone en una inscripción sin pareja o la cambia,
 * con el mismo endpoint. Si el titular había invitado a alguien y aún no ha
 * aceptado, avisa de que esa invitación quedará sin efecto (el back la vacía).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    players:       { list: vi.fn() },
    registrations: { replacePartner: vi.fn() },
  },
  registrationsQK: { list: (tournamentId: string) => ["registrations", tournamentId] },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// El rol del token: admin de AMT salvo que el test diga otra cosa
const mockRole = vi.hoisted(() => ({ role: "admin" as string | null, clubId: null }));
vi.mock("@/lib/use-role", () => ({
  useRole: () => mockRole,
  isClub:  (role: string | null) => role === "club",
}));

import ReplacePartnerModal from "../../../components/admin/replace-partner-modal";
import { adminService } from "@/lib/services/admin";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

const CARLA = { id: "u-carla", name: "Carla Gil", gender: "F", level: "3a" };
const BEA   = { id: "u-bea",   name: "Bea Ruiz",  gender: "F", level: "3a" };

const base: any = {
  id:           "reg-1",
  tournamentId: "t1",
  categoryId:   "cat-1",
  userId:       "u-ana",
  user:         { name: "Ana López", gender: "F" },
  category:     { gender: "F", level: "3a", price: 30 },
  status:       "PENDING",
  paid:         false,
  createdAt:    "2026-11-01T10:00:00Z",
};
// Ana invitó a Bea desde la app y Bea aún no ha aceptado: la fila, sin pareja
const withInvitation: any = {
  ...base,
  partnerId:        null,
  partner:          null,
  invitedPartnerId: "u-bea",
  partnerInvitedAt: "2026-11-01T10:00:00Z",
  invitedPartner:   { name: "Bea Ruiz" },
};
const withPartner: any = {
  ...base,
  partnerId:        "u-bea",
  partner:          { name: "Bea Ruiz" },
  invitedPartnerId: null,
  partnerInvitedAt: null,
  invitedPartner:   null,
};

// El aviso va en un <span> con el nombre en <strong>
const warning = (text: string) =>
  screen.queryByText((_, el) => el?.tagName === "SPAN" && el.textContent === text);

function renderModal(registration: any, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <ReplacePartnerModal registration={registration} tournamentId="t1" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { invalidate, onClose };
}

async function choose(name: string) {
  fireEvent.change(screen.getByPlaceholderText("Nombre o email…"), { target: { value: name.slice(0, 5) } });
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
}

describe("ReplacePartnerModal — poner o cambiar la pareja", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminService.players.list).mockResolvedValue({ data: [CARLA, BEA] } as any);
    vi.mocked(adminService.registrations.replacePartner).mockResolvedValue({});
  });

  it("sin pareja y con la invitación pendiente: «Poner pareja» y avisa de que la invitación quedará sin efecto", () => {
    renderModal(withInvitation);

    expect(screen.getByRole("heading", { name: "Poner pareja" })).toBeInTheDocument();
    expect(warning("La invitación a Bea Ruiz quedará sin efecto.")).toBeInTheDocument();
    // No hay compañero cuya inscripción se cancele
    expect(screen.queryByText(/quedará cancelada/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Poner pareja" })).toBeDisabled();
  });

  it("pone la pareja con el mismo endpoint, recarga la lista y cierra", async () => {
    const { invalidate, onClose } = renderModal(withInvitation);

    await choose("Carla Gil");
    fireEvent.click(screen.getByRole("button", { name: "Poner pareja" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(adminService.registrations.replacePartner).toHaveBeenCalledWith("reg-1", "u-carla");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["registrations", "t1"] });
    expect(toast.success).toHaveBeenCalledWith("Carla Gil es ahora la pareja de Ana López");
  });

  it("si el organizador pone a la propia invitada, no avisa de que su invitación quede sin efecto", async () => {
    renderModal(withInvitation);

    await choose("Bea Ruiz");

    expect(warning("La invitación a Bea Ruiz quedará sin efecto.")).not.toBeInTheDocument();
  });

  it("sin pareja ni invitación (o de un back que no la manda): «Poner pareja», sin avisos", () => {
    renderModal({ ...base, partnerId: null, partner: null });

    expect(screen.getByRole("heading", { name: "Poner pareja" })).toBeInTheDocument();
    expect(screen.queryByText(/quedará sin efecto/)).not.toBeInTheDocument();
    expect(screen.queryByText(/quedará cancelada/)).not.toBeInTheDocument();
  });

  it("con pareja: «Cambiar pareja» y la inscripción del compañero quedará cancelada, como hasta ahora", async () => {
    const { onClose } = renderModal(withPartner);

    expect(screen.getByRole("heading", { name: "Cambiar pareja" })).toBeInTheDocument();
    expect(warning("La inscripción de Bea Ruiz quedará cancelada.")).toBeInTheDocument();
    expect(screen.queryByText(/quedará sin efecto/)).not.toBeInTheDocument();

    await choose("Carla Gil");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Pareja actualizada a Carla Gil");
  });
});

describe("ReplacePartnerModal — quién puede ser la pareja por su género (D2)", () => {
  const LUIS = { id: "u-luis", name: "Luis Mora", gender: "M", level: "3a", points: 40 };
  const search = (text: string) =>
    fireEvent.change(screen.getByPlaceholderText("Nombre o email…"), { target: { value: text } });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRole.role = "admin";
    vi.mocked(adminService.players.list).mockImplementation(async (params) =>
      ({ data: params?.gender === "M" ? [LUIS] : params?.gender === "F" ? [CARLA] : [LUIS, CARLA] }) as any,
    );
  });

  it("femenina: solo busca jugadoras y la pista dice qué hacer si falta alguien", async () => {
    renderModal(withInvitation);

    search("Carla");
    await screen.findByRole("button", { name: /Carla Gil/ });
    expect(adminService.players.list).toHaveBeenCalledTimes(1);
    expect(adminService.players.list).toHaveBeenCalledWith({ q: "Carla", gender: "F", pageSize: 8 });
    expect(screen.getByText(
      "Femenina: solo salen jugadoras con el género en su ficha. Si falta alguien, ponle el género en su ficha.",
    )).toBeInTheDocument();
  });

  const mixed = { gender: "MX", level: "3a", price: 30 };

  it("mixta: con una titular, solo busca jugadores (el listado trae su género) y la pista lo dice", async () => {
    renderModal({ ...withInvitation, category: mixed });

    search("Gil M");
    expect(await screen.findByRole("button", { name: /Luis Mora/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carla Gil/ })).not.toBeInTheDocument();
    expect(adminService.players.list).toHaveBeenCalledTimes(1);
    expect(adminService.players.list).toHaveBeenCalledWith({ q: "Gil M", gender: "M", pageSize: 8 });
    expect(screen.getByText(/^Mixta, un jugador y una jugadora: solo salen jugadores con el género/)).toBeInTheDocument();
  });

  it("mixta: con un titular, solo busca jugadoras", async () => {
    renderModal({ ...withInvitation, user: { name: "Luis Mora", gender: "M" }, category: mixed });

    search("Gil M");
    expect(await screen.findByRole("button", { name: /Carla Gil/ })).toBeInTheDocument();
    expect(adminService.players.list).toHaveBeenCalledTimes(1);
    expect(adminService.players.list).toHaveBeenCalledWith({ q: "Gil M", gender: "F", pageSize: 8 });
    expect(screen.getByText(/^Mixta, un jugador y una jugadora: solo salen jugadoras con el género/)).toBeInTheDocument();
  });

  it("mixta: con el titular sin género en su ficha, no le busca pareja y dice que se lo pongan (el back lo rechazaría a él)", () => {
    renderModal({ ...withInvitation, user: { name: "Ana López", gender: null }, category: mixed });

    expect(screen.getByText("\"Ana López\" no tiene el género en su ficha: pónselo para buscarle pareja.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre o email…")).toBeDisabled();
    // La pista del buscador ya no aplica: no culpa a la pareja
    expect(screen.queryByText(/solo salen/)).not.toBeInTheDocument();
    expect(adminService.players.list).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Poner pareja" })).toBeDisabled();
  });

  it("a un club, con el titular sin género, le dice que se lo pida a AMT (no ve la ficha)", () => {
    mockRole.role = "club";
    renderModal({ ...withInvitation, user: { name: "Ana López", gender: null } });

    expect(screen.getByText(
      "\"Ana López\" no tiene el género en su ficha: pide a AMT que se lo ponga para buscarle pareja.",
    )).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre o email…")).toBeDisabled();
  });

  it("femenina con un titular: no le busca pareja y dice por qué, con la regla del back", () => {
    renderModal({ ...withInvitation, user: { name: "Luis Mora", gender: "M" } });

    expect(screen.getByText("\"Luis Mora\" no puede jugarla: la categoría femenina es solo de jugadoras.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nombre o email…")).toBeDisabled();
    expect(screen.queryByText(/solo salen/)).not.toBeInTheDocument();
  });

  it("quien no tiene el género en su ficha sale «Sin género» en los resultados y al elegirlo, no «Masc»", async () => {
    const LEO = { id: "u-leo", name: "Leo Martín", gender: "M", hasGender: false, level: "3a", points: 10 };
    vi.mocked(adminService.players.list).mockResolvedValue({ data: [LEO, LUIS] } as any);
    renderModal({ ...withInvitation, category: { gender: "G", level: "3a", price: 30 } });

    search("Leo");
    const leo = await screen.findByRole("button", { name: /Leo Martín/ });
    expect(leo).toHaveTextContent("Sin género");
    expect(leo).not.toHaveTextContent("Masc");
    expect(screen.getByRole("button", { name: /Luis Mora/ })).toHaveTextContent("Masc.");

    fireEvent.click(leo);
    expect(screen.getByText(/· Sin género$/)).toBeInTheDocument();
    expect(screen.queryByText(/Masculino/)).not.toBeInTheDocument();
  });

  it("general y junior: cualquiera, también sin género (el titular y su pareja), y sin pista", async () => {
    for (const gender of ["G", "J"]) {
      vi.mocked(adminService.players.list).mockClear();
      const registration = { ...withInvitation, user: { name: "Ana López", gender: null }, category: { gender, level: "3a", price: 30 } };
      const { unmount } = render(
        <QueryClientProvider client={new QueryClient()}>
          <ReplacePartnerModal registration={registration} tournamentId="t1" onClose={vi.fn()} />
        </QueryClientProvider>,
      );
      search("Luis");
      await screen.findByRole("button", { name: /Luis Mora/ });
      expect(adminService.players.list).toHaveBeenCalledWith({ q: "Luis", pageSize: 8 });
      expect(screen.queryByText(/con el género en su ficha/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("si el back rechaza a la pareja por el género (GENDER_REQUIRED), enseña su aviso y no cierra", async () => {
    // El texto de categoryGenderError del back para un jugador desde el panel
    const message = "\"Carla Gil\" no tiene el género en su perfil: sin él no puede jugar una categoría femenina. Lo puede poner desde la app, o AMT desde su ficha.";
    vi.mocked(adminService.registrations.replacePartner).mockRejectedValue(new ApiError(message, 400, "GENDER_REQUIRED"));
    const { onClose } = renderModal(withInvitation);

    await choose("Carla Gil");
    fireEvent.click(screen.getByRole("button", { name: "Poner pareja" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(onClose).not.toHaveBeenCalled();
  });
});
