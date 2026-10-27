import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const unpublishMock = vi.fn();
vi.mock("@/lib/services/admin", () => ({
  adminService: {
    schedule: { unpublish: (...a: unknown[]) => unpublishMock(...a) },
  },
}));
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { GroupsLockBanner } from "../../../components/admin/groups-lock-banner";

function renderBanner(props: Partial<Parameters<typeof GroupsLockBanner>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onForcedChange = vi.fn();
  const utils = render(
    <QueryClientProvider client={qc}>
      <GroupsLockBanner
        tournamentId="t1"
        categoryId="c1"
        categoryLabel="Masc. 4ª"
        published
        forced={false}
        onForcedChange={onForcedChange}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onForcedChange };
}

describe("GroupsLockBanner", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin el cuadro publicado no se muestra", () => {
    renderBanner({ published: false });
    expect(screen.queryByText("Grupos bloqueados")).toBeNull();
  });

  it("publicado: explica el bloqueo y cómo desbloquearlo", () => {
    renderBanner();
    expect(screen.getByText("Grupos bloqueados")).toBeInTheDocument();
    expect(screen.getByText(/oculta el cuadro \(se les avisa\), haz los cambios y vuelve a publicarlo/)).toBeInTheDocument();
  });

  it("«Ocultar cuadro» pide confirmación, despublica la categoría y avisa", async () => {
    unpublishMock.mockResolvedValue({ unpublished: true });
    const { onForcedChange } = renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar cuadro" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar y avisar" }));
    await waitFor(() => expect(unpublishMock).toHaveBeenCalledWith("t1", "c1"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Se ha avisado a los inscritos")));
    expect(onForcedChange).toHaveBeenCalledWith(false);
  });

  it("«Forzar» pide confirmación antes de desbloquear", () => {
    const { onForcedChange } = renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Forzar" }));
    expect(onForcedChange).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole("button", { name: "Forzar" });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onForcedChange).toHaveBeenCalledWith(true);
  });

  it("forzado: lo dice y deja volver a bloquear", () => {
    const { onForcedChange } = renderBanner({ forced: true });
    expect(screen.getByText("Edición forzada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver a bloquear" }));
    expect(onForcedChange).toHaveBeenCalledWith(false);
  });

  it("si ocultar falla, enseña el error", async () => {
    unpublishMock.mockRejectedValue(new Error("El horario de esta categoría no está publicado."));
    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar cuadro" }));
    fireEvent.click(screen.getByRole("button", { name: "Ocultar y avisar" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("El horario de esta categoría no está publicado."));
  });
});
