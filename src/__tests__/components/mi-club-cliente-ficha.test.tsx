/**
 * Ficha de un cliente del club: quien escribe los clientes la edita (contacto de
 * quien no tiene la app, socio, etiquetas, notas) y la archiva; quien solo los
 * lee (Torneos) la ve entera, sin formularios ni botones.
 */
import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/admin/header", () => ({
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));
vi.mock("@/lib/use-role", () => ({
  useRole: () => ({ role: "club", clubId: "c1" }),
  isClub: (r: string) => r === "club",
}));
vi.mock("@/lib/use-club-time-zone", () => ({
  useClubTimeZone: () => ({ timeZone: "Europe/Madrid", isError: false, refetch: vi.fn() }),
}));
// Los bonos tienen sus propios tests: aquí solo importa la ficha
vi.mock("@/components/admin/customer-vouchers-section", () => ({ CustomerVouchersSection: () => null }));
const service = vi.hoisted(() => ({
  detail: vi.fn(), tags: vi.fn(), update: vi.fn(), archive: vi.fn(), unarchive: vi.fn(),
  markGuardianConsent: vi.fn(), clearGuardianConsent: vi.fn(), anonymize: vi.fn(),
}));
vi.mock("@/lib/services/club-customers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/club-customers")>("@/lib/services/club-customers");
  return { ...actual, clubCustomersService: service };
});

import ClienteDetailPage from "../../../app/(admin)/mi-club/clientes/[id]/page";
import { ME_QUERY_KEY } from "@/lib/use-me";

const ANA = {
  id: "cc-1", clubId: "c1", userId: null, hasAccount: false, name: "Ana Pérez", phone: "600111222", email: null,
  isMember: true, memberNumber: "042", memberSince: "2026-01-10", notes: "Prefiere las tardes", tags: ["profe"],
  source: "MANUAL", archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", messagesOptOutAt: null,
  bookings: [], registrations: [],
};

const asRole = (role: string) => ({
  id: "staff", name: "Equipo", activeClubId: "c1",
  clubs: [{ clubId: "c1", clubName: "Club Centro", roles: [role] }],
});

async function renderPage(me: object) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  qc.setQueryData(ME_QUERY_KEY, me);
  await act(async () => {
    render(
      <QueryClientProvider client={qc}>
        <Suspense fallback={null}>
          <ClienteDetailPage params={Promise.resolve({ id: "cc-1" })} />
        </Suspense>
      </QueryClientProvider>,
    );
  });
}

describe("Ficha de un cliente del club", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.detail.mockResolvedValue(ANA);
    service.tags.mockResolvedValue(["profe"]);
  });

  it("con escritura (Recepción): archivar y guardar contacto, socio y notas, y se editan las etiquetas", async () => {
    await renderPage(asRole("RECEPTION"));
    expect(await screen.findByRole("button", { name: /Archivar cliente/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar contacto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar socio/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Guardar notas/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Añadir etiqueta")).toBeInTheDocument();
  });

  it("con un rol de solo lectura (Torneos): ve el contacto, el socio, las etiquetas y las notas, sin botones ni formularios", async () => {
    await renderPage(asRole("TOURNAMENTS"));
    // Lo que se lee (el nombre sale en la cabecera y en el contacto)
    expect(await screen.findByText("600111222")).toBeInTheDocument();
    expect(screen.getAllByText("Ana Pérez")).toHaveLength(2);
    expect(screen.getByText("042")).toBeInTheDocument();
    expect(screen.getByText("10/1/2026")).toBeInTheDocument();
    expect(screen.getByText("profe")).toBeInTheDocument();
    expect(screen.getByText("Prefiere las tardes")).toBeInTheDocument();
    // Lo que escribe, fuera
    for (const name of [/Archivar cliente|Recuperar cliente/, /Guardar contacto/, /Guardar socio/, /Guardar notas/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Añadir etiqueta")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Notas privadas del club")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Es socio/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("sin notas, quien solo lee lo dice", async () => {
    service.detail.mockResolvedValue({ ...ANA, notes: null });
    await renderPage(asRole("TOURNAMENTS"));
    expect(await screen.findByText("Sin notas.")).toBeInTheDocument();
  });
});

// Un niño de 10 años: menor de 14, necesita el consentimiento de su tutor
const LEO = {
  ...ANA, id: "cc-1", name: "Leo Pérez", isMember: false, memberNumber: null, memberSince: null,
  birthDate: "2016-03-05", age: 10, isMinor: true,
  guardianName: "Marta Pérez", guardianPhone: "600333444", guardianEmail: "marta@ejemplo.com",
  guardianConsentAt: null, guardianConsentRequired: true, guardianConsentMissing: true,
};

describe("Ficha de un cliente del club: menores y tutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.detail.mockResolvedValue(LEO);
    service.tags.mockResolvedValue([]);
    service.markGuardianConsent.mockResolvedValue({ ...LEO, guardianConsentAt: "2026-11-18T10:00:00.000Z", guardianConsentMissing: false });
    service.clearGuardianConsent.mockResolvedValue(LEO);
    service.update.mockResolvedValue(LEO);
  });

  it("un menor de 14 sin consentimiento: aviso con el botón para marcarlo, y el tutor en su sección", async () => {
    await renderPage(asRole("RECEPTION"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Falta el consentimiento del tutor");
    expect(screen.getByText(/Menor de edad: tiene 10 años/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre del tutor")).toHaveValue("Marta Pérez");
    expect(screen.getByLabelText("Email del tutor")).toHaveValue("marta@ejemplo.com");

    fireEvent.click(within(alert).getByRole("button", { name: /Marcar consentimiento/ }));
    await waitFor(() => expect(service.markGuardianConsent).toHaveBeenCalledWith("c1", "cc-1"));
  });

  it("sin el nombre del tutor guardado no se puede marcar y dice por qué", async () => {
    service.detail.mockResolvedValue({ ...LEO, guardianName: null, guardianPhone: null, guardianEmail: null });
    await renderPage(asRole("RECEPTION"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Apunta antes el nombre del tutor");
    expect(within(alert).getByRole("button", { name: /Marcar consentimiento/ })).toBeDisabled();
  });

  it("con consentimiento: dice cuándo se dio, sin aviso, y se puede quitar", async () => {
    service.detail.mockResolvedValue({
      ...LEO, guardianConsentAt: "2026-11-18T10:00:00.000Z", guardianConsentMissing: false,
    });
    await renderPage(asRole("RECEPTION"));
    expect(await screen.findByText(/Consentimiento del tutor: dado el 18\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Quitar consentimiento/ }));
    await waitFor(() => expect(service.clearGuardianConsent).toHaveBeenCalledWith("c1", "cc-1"));
  });

  it("de 14 a 17 años no hay aviso: el consentimiento es opcional y se puede apuntar desde el tutor", async () => {
    service.detail.mockResolvedValue({
      ...LEO, birthDate: "2010-03-05", age: 16, guardianConsentRequired: false, guardianConsentMissing: false,
    });
    await renderPage(asRole("RECEPTION"));
    expect(await screen.findByText(/no es obligatorio desde los 14 años/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Marcar consentimiento/ }));
    await waitFor(() => expect(service.markGuardianConsent).toHaveBeenCalledWith("c1", "cc-1"));
  });

  it("un adulto no tiene sección de tutor ni aviso", async () => {
    service.detail.mockResolvedValue({ ...ANA, birthDate: "1985-05-12", age: 41, isMinor: false });
    await renderPage(asRole("RECEPTION"));
    await screen.findByRole("button", { name: /Guardar nacimiento/ });
    expect(screen.queryByLabelText("Nombre del tutor")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("guarda el nacimiento y el tutor; vaciar un campo lo borra", async () => {
    await renderPage(asRole("RECEPTION"));
    fireEvent.change(await screen.findByLabelText("Fecha de nacimiento"), { target: { value: "2016-04-01" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar nacimiento/ }));
    await waitFor(() => expect(service.update).toHaveBeenCalledWith("c1", "cc-1", { birthDate: "2016-04-01" }));

    fireEvent.change(screen.getByLabelText("Teléfono del tutor"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar tutor/ }));
    await waitFor(() =>
      expect(service.update).toHaveBeenCalledWith("c1", "cc-1", {
        guardianName: "Marta Pérez", guardianPhone: null, guardianEmail: "marta@ejemplo.com",
      }),
    );
  });

  it("un email del tutor mal escrito no se manda", async () => {
    await renderPage(asRole("RECEPTION"));
    fireEvent.change(await screen.findByLabelText("Email del tutor"), { target: { value: "marta@" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar tutor/ }));
    expect(service.update).not.toHaveBeenCalled();
  });

  it("con un rol de solo lectura (Torneos): ve el aviso y el tutor, sin botones ni formularios", async () => {
    await renderPage(asRole("TOURNAMENTS"));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Falta el consentimiento del tutor");
    expect(screen.getByText("Marta Pérez")).toBeInTheDocument();
    expect(screen.getByText("marta@ejemplo.com")).toBeInTheDocument();
    for (const name of [/Marcar consentimiento/, /Quitar consentimiento/, /Guardar nacimiento/, /Guardar tutor/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Nombre del tutor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fecha de nacimiento")).not.toBeInTheDocument();
  });
});

describe("Ficha de un cliente del club: anonimizar (RGPD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    service.detail.mockResolvedValue(ANA);
    service.tags.mockResolvedValue([]);
    service.anonymize.mockResolvedValue({ ...ANA, name: "Cliente anonimizado", anonymized: true });
  });

  it.each(["OWNER", "MANAGER"])("%s ve el botón", async (role) => {
    await renderPage(asRole(role));
    expect(await screen.findByRole("button", { name: /Anonimizar cliente/ })).toBeInTheDocument();
  });

  it.each(["RECEPTION", "TOURNAMENTS", "RESULTS", "COACH"])("%s no lo ve (el back lo cierra a propietario y gestor)", async (role) => {
    await renderPage(asRole(role));
    await screen.findByText(/No tiene la app/);
    expect(screen.queryByRole("button", { name: /Anonimizar cliente/ })).not.toBeInTheDocument();
  });

  it("pide escribir ANONIMIZAR: sin la palabra exacta el botón no se activa y no se manda nada", async () => {
    await renderPage(asRole("OWNER"));
    fireEvent.click(await screen.findByRole("button", { name: /Anonimizar cliente/ }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("No se puede deshacer");
    const confirm = within(dialog).getByRole("button", { name: "Anonimizar" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText("Palabra de confirmación"), { target: { value: "anonimizar" } });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(service.anonymize).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Palabra de confirmación"), { target: { value: "ANONIMIZAR" } });
    expect(confirm).toBeEnabled();
  });

  it("con la palabra escrita anonimiza el cliente del club y cierra el diálogo", async () => {
    await renderPage(asRole("MANAGER"));
    fireEvent.click(await screen.findByRole("button", { name: /Anonimizar cliente/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Palabra de confirmación"), { target: { value: "ANONIMIZAR" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Anonimizar" }));

    await waitFor(() => expect(service.anonymize).toHaveBeenCalledWith("c1", "cc-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelar no manda nada y al volver a abrir la palabra está vacía", async () => {
    await renderPage(asRole("OWNER"));
    fireEvent.click(await screen.findByRole("button", { name: /Anonimizar cliente/ }));
    let dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Palabra de confirmación"), { target: { value: "ANONIMIZAR" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(service.anonymize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Anonimizar cliente/ }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Palabra de confirmación")).toHaveValue("");
  });

  it("un cliente ya anonimizado se lee, sin botón de anonimizar ni formularios (no se edita)", async () => {
    service.detail.mockResolvedValue({
      ...ANA, name: "Cliente anonimizado", phone: null, notes: null, tags: [], anonymized: true, archivedAt: "2026-11-18T10:00:00.000Z",
    });
    await renderPage(asRole("OWNER"));
    expect(await screen.findByRole("status")).toHaveTextContent("Cliente anonimizado");
    expect(screen.queryByRole("button", { name: /Anonimizar cliente/ })).not.toBeInTheDocument();
    for (const name of [/Archivar cliente|Recuperar cliente/, /Guardar contacto/, /Guardar socio/, /Guardar notas/]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Notas privadas del club")).not.toBeInTheDocument();
  });
});
