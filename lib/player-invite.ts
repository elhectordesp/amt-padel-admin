/**
 * Qué pasó con la invitación que sale sola al dar de alta a un jugador con
 * email (o al cambiarle el email antes de que active su cuenta): enviada, no
 * enviada porque el envío automático está apagado en Configuración, o falló
 * el envío. El back no lo manda si no había invitación que enviar (o si es
 * una versión anterior).
 */
export type AutomaticInvite = "sent" | "disabled" | "failed";

/**
 * Aviso sobre la invitación tras crear o editar un jugador; null si no hay
 * nada que decir. Antes se daba por enviada aunque estuviera apagada.
 * `fromPlayerPage`: quien lo ve puede abrir la ficha del jugador (AMT) y
 * enviarla desde allí; un club no ve la ficha ni la Configuración.
 */
export function invitationNotice(
  invitation: AutomaticInvite | undefined,
  { fromPlayerPage }: { fromPlayerPage: boolean } = { fromPlayerPage: true },
): { kind: "success" | "warning"; text: string } | null {
  const hint = fromPlayerPage ? " Puedes enviarla o compartirla desde su ficha." : "";
  if (invitation === "sent")
    return { kind: "success", text: "Le hemos enviado la invitación por email." };
  if (invitation === "disabled")
    return {
      kind: "warning",
      text: `No se le ha enviado la invitación por email: el envío automático está desactivado en la configuración de AMT.${hint}`,
    };
  if (invitation === "failed")
    return { kind: "warning", text: `No se pudo enviar la invitación por email.${hint}` };
  return null;
}
