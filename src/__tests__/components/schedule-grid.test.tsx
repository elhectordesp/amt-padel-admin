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
