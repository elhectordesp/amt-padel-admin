import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScheduleGrid } from '../../../components/admin/schedule-grid';
import type { MatchResult } from '../../../types';

function match(overrides: Partial<MatchResult>): MatchResult {
  return {
    id: 'm',
    tournament: 't-1',
    categoryId: 'cat-1',
    phase: 'QF',
    date: null,
    court: null,
    team1: [],
    team2: [],
    isResult: false,
    status: 'SCHEDULED',
    ...overrides,
  };
}

describe('ScheduleGrid — sin programar', () => {
  it('un bye sin fecha no cuenta como «Sin programar»', () => {
    render(
      <ScheduleGrid
        matches={[
          // Pase directo: W.O. con una sola pareja, terminado y sin hora
          match({
            id: 'bye',
            isWalkover: true,
            isResult: true,
            status: 'FINISHED',
            team1: ['Ana', 'Bea'],
          }),
          match({ id: 'qf', team1: ['Carla', 'Dora'], team2: ['Eva', 'Fe'] }),
        ]}
        duration={60}
        tournament={{ categories: [] }}
        onMatchClick={vi.fn()}
        onCorrectClick={vi.fn()}
      />,
    );
    expect(screen.getByText('Sin programar · 1 partido(s)')).toBeInTheDocument();
    expect(screen.queryByText('Ana / Bea')).not.toBeInTheDocument();
    expect(screen.getByText('Carla / Dora')).toBeInTheDocument();
  });
});

describe('ScheduleGrid — zona del torneo (P8)', () => {
  const renderGrid = (timezone: string | undefined, date: string, onCreateAt = vi.fn()) =>
    render(
      <ScheduleGrid
        matches={[match({ id: 'qf', date, court: 'Pista 1', team1: ['Ana', 'Bea'], team2: ['Eva', 'Fe'] })]}
        duration={60}
        tournament={{ categories: [], courts: ['Pista 1'], timezone }}
        onMatchClick={vi.fn()}
        onCorrectClick={vi.fn()}
        onCreateAt={onCreateAt}
      />,
    );

  it('las horas de la rejilla son las de la zona del torneo, no las del navegador', () => {
    const onCreateAt = vi.fn();
    renderGrid('Atlantic/Canary', '2026-11-20T18:00:00.000Z', onCreateAt);
    // La primera fila es la del partido: las 18:00 de Canarias (19:00 en Madrid)
    screen.getAllByTitle('Crear partido aquí')[0].click();
    expect(onCreateAt).toHaveBeenCalledWith({ date: '2026-11-20T18:00', court: 'Pista 1' });
  });

  it('sin zona (back anterior), Madrid', () => {
    const onCreateAt = vi.fn();
    renderGrid(undefined, '2026-11-20T18:00:00.000Z', onCreateAt);
    screen.getAllByTitle('Crear partido aquí')[0].click();
    expect(onCreateAt).toHaveBeenCalledWith({ date: '2026-11-20T19:00', court: 'Pista 1' });
  });

  it('el día del partido es el de la zona: las 23:30 UTC ya son el 21 en Madrid, aún el 20 en Canarias', () => {
    const { unmount } = renderGrid('Europe/Madrid', '2026-11-20T23:30:00.000Z');
    expect(screen.getByRole('button', { name: /21 nov/ })).toBeInTheDocument();
    unmount();
    renderGrid('Atlantic/Canary', '2026-11-20T23:30:00.000Z');
    expect(screen.getByRole('button', { name: /20 nov/ })).toBeInTheDocument();
  });
});
