/** El IVA si el back no manda el suyo (`vatRate`): el general, 21 %. */
export const DEFAULT_VAT_RATE = 0.21;

/** Un importe con IVA, su base y su cuota. */
export interface VatSplit {
  withVat:    number;
  withoutVat: number;
  vat:        number;
}

/**
 * Un importe con el IVA incluido, partido en base y cuota: sin IVA = importe
 * ÷ (1 + IVA). La misma regla en las tarjetas, la tabla y el CSV de Finanzas:
 * antes la tarjeta y el total restaban a los ingresos el IVA del beneficio
 * (el 75 % de los ingresos) y salían dos IVA para el mismo importe.
 */
export function splitVat(withVat: number, vatRate = DEFAULT_VAT_RATE): VatSplit {
  const withoutVat = withVat / (1 + vatRate);
  return { withVat, withoutVat, vat: withVat - withoutVat };
}

/**
 * La base y la cuota que calcula el back (la misma regla, ya redondeadas),
 * si las manda; si no (un back anterior), splitVat.
 */
export function vatSplitOf(
  withVat: number,
  fromBack: { withoutVat?: number | null; vatAmount?: number | null } | undefined,
  vatRate = DEFAULT_VAT_RATE,
): VatSplit {
  if (fromBack?.withoutVat != null && fromBack.vatAmount != null)
    return { withVat, withoutVat: fromBack.withoutVat, vat: fromBack.vatAmount };
  return splitVat(withVat, vatRate);
}
