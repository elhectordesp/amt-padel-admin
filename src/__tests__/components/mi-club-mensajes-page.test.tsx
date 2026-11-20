/**
 * Mensajes del club a sus clientes: no se envía sin ver antes a cuántos
 * llega; el recuento y el envío llevan los filtros elegidos, la confirmación
 * dice cuántos clientes son y el historial enseña lo enviado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
const customers = vi.hoisted(() => ({ tags: vi.fn() }));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: customers };
});
const service = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/services/club-messages", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-messages")>("@/lib/services/club-messages");
  return { ...actual, clubMessagesService: service };
});

import MensajesPage from "../../../app/(admin)/mi-club/mensajes/page";
import { ME_QUERY_KEY } from "@/lib/use-me";

const asRole = (role: string) => ({
  id: "staff", name: "Equipo", activeClubId: "c1",
  clubs: [{ clubId: "c1", clubName: "Club Centro", roles: [role] }],
});

const SENT = {
  id: "m1", title: "Cerramos el sábado", body: "Torneo", sendPush: true, sendEmail: true,
  segment: { members: true, tags: ["vip"] }, recipientCount: 12, pushCount: 8, emailCount: 9, emailFailedCount: 1,
  sentBy: { id: "u1", name: "Gestor Club" }, createdAt: "2026-11-10T09:30:00.000Z",
};

// me: la cuenta del equipo con sus roles en el club (en la caché, como la deja el panel al entrar)
function renderPage(me?: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  if (me) qc.setQueryData(ME_QUERY_KEY, me);
  return render(
    <QueryClientProvider client={qc}>
      <MensajesPage />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };

function fill() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Abrimos la liga" } });
  fireEvent.change(screen.getByLabelText("Texto"), { target: { value: "Apúntate en recepción" } });
}

describe("Mensajes del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customers.tags.mockResolvedValue(["vip"]);
    service.list.mockResolvedValue({ items: [SENT], total: 1, page: 1, pageSize: 20 });
    service.preview.mockResolvedValue({ recipients: 30, withPush: 20, withEmail: 25 });
    service.send.mockResolvedValue({ id: "m2", recipientCount: 30, pushCount: 20, emailsQueued: 25, createdAt: "2026-11-17T10:00:00.000Z" });
  });

  it("enseña el historial con destinatarios, push, emails y fallidos", async () => {
    renderPage();
    expect(await screen.findByText("Cerramos el sábado", {}, WAIT)).toBeTruthy();
    expect(screen.getByText(/Gestor Club · socios · etiqueta vip/)).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("no deja enviar hasta ver a cuántos llega, y el recuento lleva los filtros", async () => {
    renderPage();
    await screen.findByText("Cerramos el sábado", {}, WAIT);
    fill();
    const sendButton = screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Solo socios"));
    fireEvent.click(await screen.findByLabelText("vip", {}, WAIT));
    fireEvent.click(screen.getByRole("button", { name: /Ver a cuántos llega/ }));

    await waitFor(() => expect(service.preview).toHaveBeenCalledWith("c1", { members: true, tags: ["vip"] }), WAIT);
    expect(await screen.findByText(/30 clientes/, {}, WAIT)).toBeTruthy();
    await waitFor(() => expect(sendButton.disabled).toBe(false), WAIT);

    // Cambiar un filtro invalida el recuento
    fireEvent.click(screen.getByLabelText("Solo socios"));
    await waitFor(() => expect(sendButton.disabled).toBe(true), WAIT);
  });

  it("antes de enviar avisa de quién se queda fuera: sin canal, menores por su tutor y bajas (F21)", async () => {
    service.preview.mockResolvedValue({
      recipients: 14, withPush: 8, withEmail: 12, withoutContact: 2, viaGuardian: 3, excluded: 4,
    });
    renderPage();
    await screen.findByText("Cerramos el sábado", {}, WAIT);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /Ver a cuántos llega/ }));
    expect(await screen.findByText(/2 clientes sin app ni email: no recibirán nada/, {}, WAIT)).toBeTruthy();
    expect(screen.getByText(/3 menores de 14: el mensaje va por email a su tutor/)).toBeTruthy();
    expect(screen.getByText(/4 clientes quedan fuera: de baja o menor de 14 sin consentimiento/)).toBeTruthy();
  });

  it("confirma con el número de clientes y manda título, texto, canales y filtros", async () => {
    renderPage();
    await screen.findByText("Cerramos el sábado", {}, WAIT);
    fill();
    fireEvent.click(screen.getByLabelText("Email"));
    fireEvent.click(screen.getByRole("button", { name: /Ver a cuántos llega/ }));
    await screen.findByText(/30 clientes/, {}, WAIT);

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Enviar a 30 clientes", {}, WAIT)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Enviar" }).at(-1)!);

    await waitFor(
      () =>
        expect(service.send).toHaveBeenCalledWith("c1", {
          title: "Abrimos la liga",
          body: "Apúntate en recepción",
          sendPush: true,
          sendEmail: false,
          segment: {},
        }),
      WAIT,
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Mensaje enviado a 30 clientes"), WAIT);
  });

  it("con un rol de solo lectura (Torneos) se ve lo enviado, pero no el formulario ni «Enviar»", async () => {
    renderPage(asRole("TOURNAMENTS"));
    expect(await screen.findByText("Cerramos el sábado", {}, WAIT)).toBeTruthy();
    expect(screen.queryByLabelText("Título")).toBeNull();
    expect(screen.queryByRole("button", { name: "Enviar" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ver a cuántos llega/ })).toBeNull();
  });

  it("con escritura (Recepción) están el formulario y «Enviar»", async () => {
    renderPage(asRole("RECEPTION"));
    await screen.findByText("Cerramos el sábado", {}, WAIT);
    expect(screen.getByLabelText("Título")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy();
  });
});
