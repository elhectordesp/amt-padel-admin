import { describe, it, expect } from 'vitest';
import { leftMatchesNotice, type LeftMatch } from '../../../lib/utils/registration-left-matches';

const match = (n: number, label = `Cuartos: Pareja ${n} vs por definir`): LeftMatch => ({
  matchId: `m${n}`,
  categoryId: 'c1',
  phase: 'QF',
  label,
});

describe('leftMatchesNotice', () => {
  it('sin partidos que dejar (o sin el campo, con un back anterior) no hay aviso', () => {
    expect(leftMatchesNotice(undefined)).toBeNull();
    expect(leftMatchesNotice(null)).toBeNull();
    expect(leftMatchesNotice([])).toBeNull();
  });

  it('un partido: dice cuál y avisa de que el cuadro no se rehace ni sube la espera', () => {
    const text = leftMatchesNotice([match(1, 'Cuartos: Ana vs Eva')])!;
    expect(text).toContain('Deja 1 partido sin jugar: Cuartos: Ana vs Eva.');
    expect(text).toContain('no se rehace solo');
    expect(text).toContain('no sube nadie de la lista de espera');
  });

  it('varios: los cuenta y los enumera', () => {
    const text = leftMatchesNotice([match(1), match(2)])!;
    expect(text).toContain('Dejan 2 partidos sin jugar');
    expect(text).toContain('Pareja 1');
    expect(text).toContain('Pareja 2');
  });

  it('muchos: enumera los primeros y dice cuántos más', () => {
    const text = leftMatchesNotice([1, 2, 3, 4, 5, 6].map((n) => match(n)))!;
    expect(text).toContain('Dejan 6 partidos sin jugar');
    expect(text).toContain('Pareja 4');
    expect(text).not.toContain('Pareja 5');
    expect(text).toContain('y 2 más');
  });
});
