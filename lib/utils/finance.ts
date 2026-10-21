/** El IVA si el back no manda el suyo (`vatRate`): el general, 21 %. */
export const DEFAULT_VAT_RATE = 0.21;

/**
 * Un importe con el IVA incluido, partido en base y cuota: sin IVA = importe
 * ÷ (1 + IVA). La misma regla en las tarjetas, la tabla y el CSV de Finanzas:
 * antes la tarjeta y el total restaban a los ingresos el IVA del beneficio
 * (el 75 % de los ingresos) y salían dos IVA para el mismo importe.
 */
export function splitVat(withVat: number, vatRate = DEFAULT_VAT_RATE) {
  const withoutVat = withVat / (1 + vatRate);
  return { withVat, withoutVat, vat: withVat - withoutVat };
}
