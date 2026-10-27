import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-form";

// El token llega en el enlace: que no salga en el Referer hacia nadie (también
// lo pone next.config.ts como cabecera) y que la página no se indexe.
export const metadata: Metadata = {
  title: "Nueva contraseña — AMT Pádel",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function RestablecerPage() {
  return <ResetPasswordForm />;
}
