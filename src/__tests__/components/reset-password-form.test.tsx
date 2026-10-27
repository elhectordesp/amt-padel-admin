import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  resetPassword: vi.fn(),
}));

import { ACTIVATE_LINK_EXPIRED_MESSAGE, resetPassword, RESET_LINK_EXPIRED_MESSAGE } from "@/lib/auth";

const mockReset = vi.mocked(resetPassword);
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";

/**
 * La página lee el enlace una vez por carga (caché del módulo): cada test
 * carga el componente de nuevo con su propia URL.
 */
async function renderAt(hash: string, { userAgent = DESKTOP, search = "" } = {}) {
  window.history.replaceState(null, "", `/restablecer${search}${hash}`);
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  vi.resetModules();
  const { ResetPasswordForm } = await import("../../../app/restablecer/reset-form");
  return render(<ResetPasswordForm />);
}

describe("/restablecer (P2-26)", () => {
  // La primera importación compila el componente y sus dependencias: fuera
  // del tiempo de cada test
  beforeAll(async () => {
    await import("../../../app/restablecer/reset-form");
  }, 60_000);

  beforeEach(() => {
    mockReset.mockReset();
    mockReset.mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("lee el token del enlace y lo quita de la barra de direcciones", async () => {
    await renderAt("#token=tok-123");

    expect(await screen.findByRole("heading", { name: "Nueva contraseña" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(window.location.pathname).toBe("/restablecer");
  });

  it("enseña las reglas de la contraseña desde el principio y las marca al cumplirse", async () => {
    await renderAt("#token=tok-123");
    const rules = await screen.findByRole("list", { name: "Requisitos de la contraseña" });
    expect(rules).toHaveTextContent("Mínimo 8 caracteres (pendiente)");
    // (A-Z): como en el back, la Ñ y las letras con tilde no cuentan
    expect(rules).toHaveTextContent("Una mayúscula (A-Z) (pendiente)");
    expect(rules).toHaveTextContent("Un número (pendiente)");

    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "Ñandú1");
    expect(rules).toHaveTextContent("Una mayúscula (A-Z) (pendiente)");
    await userEvent.clear(screen.getByLabelText("Contraseña nueva"));
    await userEvent.type(screen.getByLabelText("Contraseña nueva"), "Clave1");
    expect(rules).toHaveTextContent("Una mayúscula (A-Z) (cumplido)");
    expect(rules).toHaveTextContent("Un número (cumplido)");
    expect(rules).toHaveTextContent("Mínimo 8 caracteres (pendiente)");
  });

  it("no manda una contraseña que el back rechazaría", async () => {
    await renderAt("#token=tok-123");
    await userEvent.type(await screen.findByLabelText("Contraseña nueva"), "clavesinmayuscula");
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), "clavesinmayuscula");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByText("Mínimo 8 caracteres, una mayúscula y un número")).toBeInTheDocument();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("cambia la contraseña con el token del enlace y lo confirma", async () => {
    await renderAt("#token=tok-123");
    await userEvent.type(await screen.findByLabelText("Contraseña nueva"), "ClaveNueva1");
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), "ClaveNueva1");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByRole("heading", { name: "Contraseña cambiada" })).toBeInTheDocument();
    expect(mockReset).toHaveBeenCalledWith("tok-123", "ClaveNueva1", { activate: false });
  });

  it("al activar una cuenta, avisa de que es una invitación (por si caducó)", async () => {
    mockReset.mockRejectedValueOnce(new Error(ACTIVATE_LINK_EXPIRED_MESSAGE));
    await renderAt("#token=tok-9&mode=activate");
    await userEvent.type(await screen.findByLabelText("Contraseña nueva"), "ClaveNueva1");
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), "ClaveNueva1");
    await userEvent.click(screen.getByRole("button", { name: "Activar mi cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("pide a quien te invitó que te reenvíe la invitación");
    expect(mockReset).toHaveBeenCalledWith("tok-9", "ClaveNueva1", { activate: true });
  });

  it("enlace caducado o usado: lo dice y cómo pedir otro", async () => {
    mockReset.mockRejectedValueOnce(new Error(RESET_LINK_EXPIRED_MESSAGE));
    await renderAt("#token=tok-123");
    await userEvent.type(await screen.findByLabelText("Contraseña nueva"), "ClaveNueva1");
    await userEvent.type(screen.getByLabelText("Repite la contraseña"), "ClaveNueva1");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("¿Olvidaste tu contraseña?");
  });

  it("invitación (mode=activate, también por ?token=): activar la cuenta", async () => {
    await renderAt("", { search: "?token=tok-9&mode=activate" });
    expect(await screen.findByRole("heading", { name: "Activa tu cuenta" })).toBeInTheDocument();
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("sin token: enlace no válido, y qué hacer si se ha recargado la página", async () => {
    await renderAt("");
    expect(await screen.findByRole("heading", { name: "Enlace no válido" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Si has recargado la página, vuelve a abrir el enlace del email (sigue valiendo si no lo has usado).",
      ),
    ).toBeInTheDocument();
  });

  it("en el ordenador no intenta abrir la app", async () => {
    await renderAt("#token=tok-123");
    await screen.findByRole("heading", { name: "Nueva contraseña" });
    expect(screen.queryByRole("link", { name: /abrir en la app/i })).not.toBeInTheDocument();
  });

  // No abre la app sola: sin ella instalada, Safari da un error y el
  // navegador de un correo en Android acaba en ERR_UNKNOWN_URL_SCHEME (y al
  // volver ya no hay token). Solo el botón, y el formulario
  it("en el móvil ofrece el botón de la app con el mismo enlace, sin abrirla sola", async () => {
    const realLocation = window.location;
    const opened: string[] = [];
    // jsdom no navega a amtpadel://: se apunta si algo intenta abrirlo
    const stubLocation = () =>
      Object.defineProperty(window, "location", {
        configurable: true,
        value: new Proxy(realLocation, {
          get: (target, prop) => Reflect.get(target, prop),
          set: (_target, prop, value) => {
            if (prop === "href") opened.push(String(value));
            return true;
          },
        }),
      });

    try {
      window.history.replaceState(null, "", "/restablecer#token=tok-123&mode=activate");
      stubLocation();
      await renderAt("#token=tok-123&mode=activate", { userAgent: IPHONE });

      expect(await screen.findByRole("link", { name: /abrir en la app/i })).toHaveAttribute(
        "href",
        "amtpadel://reset-password?token=tok-123&mode=activate",
      );
      expect(screen.getByLabelText("Contraseña nueva")).toBeInTheDocument();
      // Tras el efecto que limpia la URL, nada ha navegado a la app
      await waitFor(() => expect(window.location.hash).toBe(""));
      expect(opened).toEqual([]);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: realLocation });
    }
  });
});
