/**
 * Alumnos de un grupo (F8-C3): cómo paga cada uno (cuota o bono), su descuento
 * con motivo y su baja temporal con vuelta prevista, con sus etiquetas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/admin/booking-customer-picker", () => ({
  BookingCustomerPicker: () => <div>Buscador de clientes</div>,
}));

const school = vi.hoisted(() => ({ members: { add: vi.fn(), leave: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/services/school", async (orig) => {
  const actual = await orig<typeof import("@/lib/services/school")>();
  return { ...actual, schoolService: { ...actual.schoolService, ...school } };
});

import { SchoolMembersSection } from "@/components/admin/school-members-section";
import type { SchoolGroupDetail, SchoolGroupMember } from "@/types/school";

const member = (id: string, name: string, over: Partial<SchoolGroupMember> = {}): SchoolGroupMember => ({
  id, clubCustomerId: `cc-${id}`, name, joinedAt: "2026-09-14T08:00:00.000Z", leftAt: null,
  billing: "MONTHLY", discountCents: null, discountReason: null, pausedFrom: null, pausedUntil: null,
  pauseReason: null, voucherRemaining: null, ...over,
});

const group = (members: SchoolGroupMember[], over: Partial<SchoolGroupDetail> = {}) =>
  ({
    id: "g1", clubId: "c1", name: "Iniciación", level: null, maxStudents: 8, monthlyFeeCents: 8000,
    startDate: "2026-09-14", endDate: "2027-06-18", notes: null, activity: "ACADEMY", archivedAt: null,
    createdAt: "", coach: null, slots: [], members, activeStudents: members.length, sessions: [], ...over,
  }) as SchoolGroupDetail;

function renderSection(g: SchoolGroupDetail, canWrite = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SchoolMembersSection clubId="c1" group={g} timeZone="Europe/Madrid" canWrite={canWrite} />
    </QueryClientProvider>,
  );
}

const WAIT = { timeout: 5000 };
const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("SchoolMembersSection: pago y baja temporal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    school.members.update.mockResolvedValue({ warnings: [] });
    school.members.leave.mockResolvedValue({ warnings: [] });
  });

  it("las etiquetas: de baja hasta cuándo, paga con bono (con lo que le queda) y su descuento con motivo", () => {
    renderSection(
      group([
        member("m1", "Ana", { pausedFrom: "2026-11-02", pausedUntil: "2026-12-15" }),
        member("m2", "Beto", { pausedFrom: "2026-11-02" }),
        member("m3", "Carla", { billing: "VOUCHER", voucherRemaining: 4 }),
        member("m4", "Dani", { discountCents: 1000, discountReason: "Hermanos" }),
        member("m5", "Eva"),
      ]),
    );
    expect(within(row("Ana")).getByText("De baja hasta el 15 dic")).toBeInTheDocument();
    expect(within(row("Beto")).getByText("De baja (sin fecha de vuelta)")).toBeInTheDocument();
    expect(within(row("Carla")).getByText("Paga con bono (quedan 4)")).toBeInTheDocument();
    expect(within(row("Dani")).getByText("− 10,00 € (Hermanos)")).toBeInTheDocument();
    expect(within(row("Eva")).queryByText(/De baja|Paga con bono|−/)).not.toBeInTheDocument();
  });

  it("pasar a bono manda solo la forma de pago y enseña los avisos de las cuotas con pagos", async () => {
    school.members.update.mockResolvedValue({ warnings: ["La cuota de 2026-12 ya tiene pagos: se queda como está"] });
    renderSection(group([member("m1", "Ana")]));
    fireEvent.click(screen.getByRole("button", { name: "Pago y baja temporal de Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Ana: pago y baja" });
    fireEvent.change(within(dialog).getByLabelText("Forma de pago"), { target: { value: "VOUCHER" } });
    expect(within(dialog).getByText(/No se le genera cuota/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(school.members.update).toHaveBeenCalledWith("c1", "g1", "m1", { billing: "VOUCHER" }), WAIT);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Alumno guardado"), WAIT);
    expect(toast.warning).toHaveBeenCalledWith("La cuota de 2026-12 ya tiene pagos: se queda como está");
  });

  it("un descuento en euros con su motivo; sin motivo no se manda", async () => {
    renderSection(group([member("m1", "Ana")]));
    fireEvent.click(screen.getByRole("button", { name: "Pago y baja temporal de Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Ana: pago y baja" });
    fireEvent.change(within(dialog).getByLabelText(/Descuento en cada cuota/), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El descuento necesita un motivo"), WAIT);
    expect(school.members.update).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Motivo del descuento"), { target: { value: "Hermanos" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(
      () => expect(school.members.update).toHaveBeenCalledWith("c1", "g1", "m1", { discountCents: 1000, discountReason: "Hermanos" }),
      WAIT,
    );
  });

  it("una baja temporal con vuelta prevista y motivo; la vuelta no puede ser anterior al inicio", async () => {
    renderSection(group([member("m1", "Ana")]));
    fireEvent.click(screen.getByRole("button", { name: "Pago y baja temporal de Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Ana: pago y baja" });
    fireEvent.click(within(dialog).getByLabelText("De baja temporalmente"));
    fireEvent.change(within(dialog).getByLabelText("Desde"), { target: { value: "2026-11-10" } });
    fireEvent.change(within(dialog).getByLabelText(/Vuelve el/), { target: { value: "2026-11-09" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(
      () => expect(toast.error).toHaveBeenCalledWith("La vuelta no puede ser anterior al inicio de la baja"),
      WAIT,
    );

    fireEvent.change(within(dialog).getByLabelText(/Vuelve el/), { target: { value: "2026-12-01" } });
    fireEvent.change(within(dialog).getByLabelText("Motivo"), { target: { value: "Lesión" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(
      () =>
        expect(school.members.update).toHaveBeenCalledWith("c1", "g1", "m1", {
          pausedFrom: "2026-11-10", pausedUntil: "2026-12-01", pauseReason: "Lesión",
        }),
      WAIT,
    );
  });

  it("«Vuelve el…» sobre una baja sin fecha: solo manda la vuelta; «Reactivar hoy» pone la de hoy", async () => {
    renderSection(group([member("m1", "Ana", { pausedFrom: "2026-01-02", pauseReason: "Lesión" })]));
    fireEvent.click(screen.getByRole("button", { name: "Pago y baja temporal de Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Ana: pago y baja" });
    fireEvent.change(within(dialog).getByLabelText(/Vuelve el/), { target: { value: "2026-02-01" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(
      () => expect(school.members.update).toHaveBeenCalledWith("c1", "g1", "m1", { pausedUntil: "2026-02-01" }),
      WAIT,
    );
  });

  it("un grupo sin cuota no admite descuento; sin cambios no se llama al back", async () => {
    renderSection(group([member("m1", "Ana")], { monthlyFeeCents: null }));
    fireEvent.click(screen.getByRole("button", { name: "Pago y baja temporal de Ana" }));
    const dialog = await screen.findByRole("dialog", { name: "Ana: pago y baja" });
    expect(within(dialog).queryByLabelText(/Descuento en cada cuota/)).not.toBeInTheDocument();
    expect(within(dialog).getByText(/no hay descuento que poner/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("No había cambios"), WAIT);
    expect(school.members.update).not.toHaveBeenCalled();
  });

  it("la baja definitiva avisa de las cuotas con pagos que se quedan", async () => {
    school.members.leave.mockResolvedValue({ warnings: ["La cuota de 2026-12 ya tiene pagos: se queda como está"] });
    renderSection(group([member("m1", "Ana")]));
    fireEvent.click(screen.getByRole("button", { name: "Dar de baja a Ana" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dar de baja" }));
    await waitFor(() => expect(school.members.leave).toHaveBeenCalledWith("c1", "g1", "m1"), WAIT);
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith("La cuota de 2026-12 ya tiene pagos: se queda como está"), WAIT);
  });

  it("quien solo lee no cambia el pago ni la baja de nadie", () => {
    renderSection(group([member("m1", "Ana")]), false);
    expect(screen.queryByRole("button", { name: /Pago y baja temporal/ })).not.toBeInTheDocument();
  });
});
