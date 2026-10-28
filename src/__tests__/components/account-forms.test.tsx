import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/account")>()),
  changePassword:  vi.fn(),
  updateMyProfile: vi.fn(),
}));

vi.mock("@/lib/use-me", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/use-me")>()),
  useMe: () => ({ data: { id: "u1", name: "Ana López", role: "CLUB" } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ChangePasswordForm, ProfileForm } from "../../../components/admin/account-forms";
import { changePassword, updateMyProfile } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function fillPasswords(current: string, next: string, repeat: string) {
  fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Contraseña nueva"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Repite la contraseña nueva"), { target: { value: repeat } });
  fireEvent.click(screen.getByRole("button", { name: /cambiar contraseña/i }));
}

describe("ChangePasswordForm (hueco #5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("con la actual y una nueva válida repetida, la cambia y vacía el formulario", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce(undefined);
    renderWithQuery(<ChangePasswordForm />);
    fillPasswords("Vieja123", "Nueva1234", "Nueva1234");
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith("Vieja123", "Nueva1234"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/otros dispositivos/)));
    expect(screen.getByLabelText("Contraseña actual")).toHaveValue("");
  });

  it("no llama al servidor si la nueva no cumple, no coincide o es la misma", () => {
    renderWithQuery(<ChangePasswordForm />);
    fillPasswords("Vieja123", "corta", "corta");
    expect(screen.getByText(/al menos 8 caracteres/)).toBeInTheDocument();
    fillPasswords("Vieja123", "Nueva1234", "Otra1234");
    expect(screen.getByText(/no coincide/i)).toBeInTheDocument();
    fillPasswords("Vieja123", "Vieja123", "Vieja123");
    expect(screen.getByText(/distinta de la actual/i)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("si la actual no es correcta, lo dice", async () => {
    vi.mocked(changePassword).mockRejectedValueOnce(new ApiError("Contraseña actual incorrecta.", 400, "CURRENT_PASSWORD_WRONG"));
    renderWithQuery(<ChangePasswordForm />);
    fillPasswords("Mala1234", "Nueva1234", "Nueva1234");
    expect(await screen.findByRole("alert")).toHaveTextContent("La contraseña actual no es correcta.");
  });
});

describe("ProfileForm (hueco #5)", () => {
  const profile = { id: "u1", name: "Ana López", firstName: "Ana", lastName: "López", email: "ana@club.es", phone: "600111222" };

  beforeEach(() => vi.clearAllMocks());

  it("enseña el email y el rol sin dejar cambiarlos", () => {
    renderWithQuery(<ProfileForm profile={profile} />);
    expect(screen.getByLabelText("Email")).toHaveValue("ana@club.es");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByText("Admin de club")).toBeInTheDocument();
  });

  it("guarda nombre, apellidos y teléfono; vaciar el teléfono lo borra", async () => {
    vi.mocked(updateMyProfile).mockResolvedValueOnce(undefined);
    renderWithQuery(<ProfileForm profile={profile} />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: " Ana María " } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith({
      firstName: "Ana María", lastName: "López", phone: null,
    }));
  });

  it("un admin de club sin nombre ni apellidos (solo `name`) ve el nombre partido y guarda el teléfono sin apellidos", async () => {
    vi.mocked(updateMyProfile).mockResolvedValueOnce(undefined);
    renderWithQuery(<ProfileForm profile={{ id: "u1", name: "Indoor", firstName: null, lastName: null, email: "club@x.es", phone: null }} />);
    expect(screen.getByLabelText("Nombre")).toHaveValue("Indoor");
    expect(screen.getByLabelText("Apellidos")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "600111222" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith({
      firstName: "Indoor", lastName: "", phone: "600111222",
    }));
  });

  it("sin cambios no deja guardar; con el nombre vacío no llama al servidor", () => {
    renderWithQuery(<ProfileForm profile={profile} />);
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(screen.getByText("Escribe tu nombre.")).toBeInTheDocument();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });
});
