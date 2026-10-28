import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
}));

import { api, ApiError, setToken, setRefreshToken } from "@/lib/api";
import {
  accountErrorMessage, changePassword, initialProfileForm, passwordProblem, profileProblems,
  requestPasswordReset, updateMyProfile,
} from "../../../lib/account";

describe("cuenta del panel (hueco #5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cambiar la contraseña manda la actual y la nueva y guarda la sesión nueva (las demás se cierran)", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: { token: "t2", refreshToken: "r2" } });
    await changePassword("Vieja123", "Nueva1234");
    expect(api.patch).toHaveBeenCalledWith("/auth/change-password", {
      currentPassword: "Vieja123",
      newPassword: "Nueva1234",
    });
    expect(setToken).toHaveBeenCalledWith("t2");
    expect(setRefreshToken).toHaveBeenCalledWith("r2");
  });

  it("si falla, no toca la sesión", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new ApiError("Contraseña actual incorrecta.", 400, "CURRENT_PASSWORD_WRONG"));
    await expect(changePassword("mal", "Nueva1234")).rejects.toBeInstanceOf(ApiError);
    expect(setToken).not.toHaveBeenCalled();
  });

  it("«¿Olvidaste tu contraseña?» llama a /auth/forgot-password con el email limpio", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: {} });
    await requestPasswordReset("  ana@club.es ");
    expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", { email: "ana@club.es" });
  });

  it("el perfil se guarda con PATCH /users/me (teléfono null lo borra)", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });
    await updateMyProfile({ firstName: "Ana", lastName: "López", phone: null });
    expect(api.patch).toHaveBeenCalledWith("/users/me", { firstName: "Ana", lastName: "López", phone: null });
  });
});

describe("passwordProblem (las reglas del back)", () => {
  it.each([
    ["corta1A", /8 caracteres/],
    ["sinmayuscula1", /mayúscula/],
    ["SinNumeroAqui", /número/],
  ])("«%s» no vale", (pass, msg) => {
    expect(passwordProblem(pass)).toMatch(msg);
  });

  it("8 caracteres con mayúscula y número, sí", () => {
    expect(passwordProblem("Nueva1234")).toBeNull();
  });
});

describe("initialProfileForm", () => {
  const base = { id: "u1", email: "club@x.es", phone: null };

  it("con nombre y apellidos guardados, los usa", () => {
    expect(initialProfileForm({ ...base, name: "Ana López", firstName: "Ana", lastName: "López", phone: "600111222" }))
      .toEqual({ firstName: "Ana", lastName: "López", phone: "600111222" });
  });

  it("un admin de club (solo `name`, sin nombre ni apellidos) parte el nombre", () => {
    expect(initialProfileForm({ ...base, name: "Club Pádel  Indoor", firstName: null, lastName: null }))
      .toEqual({ firstName: "Club", lastName: "Pádel Indoor", phone: "" });
    expect(initialProfileForm({ ...base, name: "Indoor", firstName: null, lastName: null }))
      .toEqual({ firstName: "Indoor", lastName: "", phone: "" });
  });
});

describe("profileProblems", () => {
  it("nombre obligatorio; apellidos opcionales; teléfono opcional pero con forma de teléfono", () => {
    expect(profileProblems({ firstName: " ", lastName: "", phone: "" })).toEqual({
      firstName: expect.any(String),
    });
    expect(profileProblems({ firstName: "Indoor", lastName: "", phone: "600111222" })).toEqual({});
    expect(profileProblems({ firstName: "Ana", lastName: "x".repeat(101), phone: "" })).toHaveProperty("lastName");
    expect(profileProblems({ firstName: "Ana", lastName: "López", phone: "abc-no-es-un-telefono" })).toHaveProperty("phone");
    expect(profileProblems({ firstName: "Ana", lastName: "López", phone: "+34 600 00 00 00" })).toEqual({});
    expect(profileProblems({ firstName: "Ana", lastName: "López", phone: "" })).toEqual({});
  });
});

describe("accountErrorMessage", () => {
  it("429: demasiados intentos (antes salía «ThrottlerException…»)", () => {
    expect(accountErrorMessage(new ApiError("ThrottlerException: Too Many Requests", 429), "x"))
      .toMatch(/demasiados intentos/i);
  });

  it("contraseña actual mal y cuenta sin contraseña, con su texto", () => {
    expect(accountErrorMessage(new ApiError("x", 400, "CURRENT_PASSWORD_WRONG"), "y")).toBe("La contraseña actual no es correcta.");
    expect(accountErrorMessage(new ApiError("x", 400, "NO_PASSWORD_CONFIGURED"), "y")).toMatch(/olvidaste tu contraseña/i);
  });

  it("otro error del back: su mensaje; algo que no es del back: el de reserva", () => {
    expect(accountErrorMessage(new ApiError("Algo concreto", 400), "reserva")).toBe("Algo concreto");
    expect(accountErrorMessage(new Error("boom"), "reserva")).toBe("reserva");
  });
});
