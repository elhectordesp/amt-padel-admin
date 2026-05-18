import { describe, it, expect } from 'vitest';
import { cn } from '../../../lib/utils';

describe('cn (classnames helper)', () => {
  it('combina clases simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignora valores falsy', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('resuelve conflictos de Tailwind (último gana)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('maneja clases condicionales con objeto', () => {
    expect(cn({ 'font-bold': true, 'font-normal': false })).toBe('font-bold');
  });

  it('devuelve string vacío si no hay argumentos', () => {
    expect(cn()).toBe('');
  });
});
