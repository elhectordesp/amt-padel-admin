/**
 * Reglas de la contraseña: las mismas que exige el back
 * (`PASSWORD_REGEX` de `src/auth/dto/auth.dto.ts`): mínimo 8 caracteres, una
 * mayúscula y un número. Si cambian allí, aquí también.
 */
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_RULES = [
  { id: "length", label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "Una mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { id: "digit", label: "Un número", test: (p: string) => /\d/.test(p) },
] as const;

export const PASSWORD_RULES_MESSAGE = "Mínimo 8 caracteres, una mayúscula y un número";
