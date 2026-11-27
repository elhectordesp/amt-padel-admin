/**
 * Aviso que no bloquea: un cliente se puede dar de alta solo con el nombre, pero
 * sin teléfono ni email el club no puede escribirle (ni a él ni, si es menor, a
 * su tutor). Va bajo los campos de contacto.
 */
export function CustomerNoContactNotice() {
  return (
    <p role="status" className="text-xs text-muted-foreground">
      Sin teléfono ni email no podrás escribirle desde el club.
    </p>
  );
}
