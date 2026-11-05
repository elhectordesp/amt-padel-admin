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

import ReplacePartnerModal from "../../../components/admin/replace-partner-modal";
import { adminService } from "@/lib/services/admin";
import { toast } from "sonner";

const CARLA = { id: "u-carla", name: "Carla Gil", gender: "F", level: "3a" };
const BEA   = { id: "u-bea",   name: "Bea Ruiz",  gender: "F", level: "3a" };

const base: any = {
  id:           "reg-1",
  tournamentId: "t1",
  categoryId:   "cat-1",
  userId:       "u-ana",
  user:         { name: "Ana López" },
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
