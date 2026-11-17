/**
 * Formulario «Plan de AMT» de la ficha del club (solo AMT): carga lo guardado,
 * convierte euros y porcentaje a céntimos y tasa al guardar, y no deja enviar
 * lo que el back rechazaría.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const internalMock = vi.fn();
const updateMock = vi.fn();
const amtPlanMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("@/lib/services/admin", () => ({
  adminService: {
    clubs: {
      amtPlanInternal: (...a: unknown[]) => internalMock(...a),
      updateAmtPlan: (...a: unknown[]) => updateMock(...a),
      amtPlan: (...a: unknown[]) => amtPlanMock(...a),
      setFeePaidUntil: vi.fn(),
    },
  },
}));
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccessMock(...a),
    error: (...a: unknown[]) => toastErrorMock(...a),
  },
}));

import { ClubAmtPlanEditor } from "@/components/admin/club-amt-plan-editor";

const stored = {
  bookingPlan: "FREE",
  bookingMonthlyFeeCents: null,
  bookingCommissionRate: null,
  bookingBillingNotes: null,
  feePaidUntil: "2026-12-31",
  overdue: false,
};

function renderEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClubAmtPlanEditor clubId="club-1" />
    </QueryClientProvider>,
  );
}

const save = () => screen.getByRole("button", { name: "Guardar plan" });
const choosePlan = (plan: string) => fireEvent.change(screen.getByLabelText("Plan"), { target: { value: plan } });

describe("ClubAmtPlanEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    internalMock.mockResolvedValue(stored);
    amtPlanMock.mockResolvedValue(stored);
  });

  it("carga lo guardado y trae el «pagado hasta» debajo", async () => {
    internalMock.mockResolvedValue({
      ...stored,
      bookingPlan: "COMMISSION",
      bookingCommissionRate: 0.055,
      bookingBillingNotes: "trato con Pedro",
    });
    renderEditor();
    expect(await screen.findByDisplayValue("5,5")).toBeTruthy();
    expect((screen.getByLabelText("Plan") as HTMLSelectElement).value).toBe("COMMISSION");
    expect((screen.getByLabelText(/Notas internas de AMT/) as HTMLTextAreaElement).value).toBe("trato con Pedro");
    expect(screen.queryByLabelText(/Cuota mensual/)).toBeNull();
    expect(screen.getByLabelText("Cuota pagada hasta")).toBeTruthy();
    expect(internalMock).toHaveBeenCalledWith("club-1");
  });

  it("suscripción: euros a céntimos y las notas recortadas", async () => {
    updateMock.mockResolvedValue({
      bookingPlan: "SUBSCRIPTION",
      bookingMonthlyFeeCents: 4950,
      bookingCommissionRate: null,
      bookingBillingNotes: "piloto",
    });
    renderEditor();
    await screen.findByLabelText("Plan");
    choosePlan("SUBSCRIPTION");
    fireEvent.change(await screen.findByLabelText(/Cuota mensual/), { target: { value: "49,5" } });
    fireEvent.change(screen.getByLabelText(/Notas internas de AMT/), { target: { value: "  piloto " } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith("club-1", {
        bookingPlan: "SUBSCRIPTION",
        bookingMonthlyFeeCents: 4950,
        bookingCommissionRate: null,
        bookingBillingNotes: "piloto",
      }),
    );
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Plan de AMT guardado"));
  });

  it("comisión: porcentaje a tasa sin ruido (7 % = 0,07) y sin cuota", async () => {
    updateMock.mockResolvedValue({});
    renderEditor();
    await screen.findByLabelText("Plan");
    choosePlan("COMMISSION");
    fireEvent.change(await screen.findByLabelText(/Comisión/), { target: { value: "7" } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith("club-1", {
        bookingPlan: "COMMISSION",
        bookingMonthlyFeeCents: null,
        bookingCommissionRate: 0.07,
        bookingBillingNotes: null,
      }),
    );
  });

  it("cambiar de plan no arrastra la cuota del anterior", async () => {
    internalMock.mockResolvedValue({ ...stored, bookingPlan: "SUBSCRIPTION", bookingMonthlyFeeCents: 4900 });
    updateMock.mockResolvedValue({});
    renderEditor();
    expect(await screen.findByDisplayValue("49")).toBeTruthy();
    choosePlan("COMMISSION");
    fireEvent.change(await screen.findByLabelText(/Comisión/), { target: { value: "5" } });
    fireEvent.click(save());
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith("club-1", {
        bookingPlan: "COMMISSION",
        bookingMonthlyFeeCents: null,
        bookingCommissionRate: 0.05,
        bookingBillingNotes: null,
      }),
    );
  });

  it("suscripción sin cuota: avisa y no envía", async () => {
    renderEditor();
    await screen.findByLabelText("Plan");
    choosePlan("SUBSCRIPTION");
    await screen.findByLabelText(/Cuota mensual/);
    fireEvent.click(save());
    expect(await screen.findByText("La cuota mensual es obligatoria")).toBeTruthy();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sin cambios, el botón no deja guardar", async () => {
    renderEditor();
    await screen.findByLabelText("Plan");
    expect((save() as HTMLButtonElement).disabled).toBe(true);
  });

  it("un error del back se enseña tal cual", async () => {
    updateMock.mockRejectedValue(new Error("La cuota mensual debe ser mayor que 0"));
    renderEditor();
    await screen.findByLabelText("Plan");
    choosePlan("CUSTOM");
    fireEvent.change(await screen.findByLabelText(/Cuota mensual/), { target: { value: "25" } });
    fireEvent.click(save());
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("La cuota mensual debe ser mayor que 0"));
  });

  it("Intro en un campo no envía el formulario del club que lo envuelve", async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <form onSubmit={onSubmit}>
          <ClubAmtPlanEditor clubId="club-1" />
        </form>
      </QueryClientProvider>,
    );
    await screen.findByLabelText("Plan");
    choosePlan("SUBSCRIPTION");
    const fee = await screen.findByLabelText(/Cuota mensual/);
    const notPrevented = fireEvent.keyDown(fee, { key: "Enter" });
    expect(notPrevented).toBe(false);
  });

  it("no se pudo cargar: lo dice y no enseña el formulario", async () => {
    internalMock.mockRejectedValue(new Error("403"));
    renderEditor();
    expect(await screen.findByText("No se pudo cargar el plan del club.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Guardar plan" })).toBeNull();
  });
});
