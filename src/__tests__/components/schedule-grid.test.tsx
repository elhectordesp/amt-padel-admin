import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('ScheduleGrid — tramos de la jornada', () => {
  // Jornada del 20-nov de 16:00 a 21:00 (Madrid); partido a las 20:00
  const slots = ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
  const renderGrid = (tournament: Record<string, unknown>, phase = 'GROUPS') =>
    render(
      <ScheduleGrid
        matches={[match({ id: 'm1', phase, date: '2026-11-20T19:00:00.000Z', court: 'Pista 1', team1: ['Ana', 'Bea'], team2: ['Eva', 'Fe'] })]}
        duration={60}
        tournament={{ categories: [], courts: ['Pista 1'], ...tournament }}
        onMatchClick={vi.fn()}
        onCorrectClick={vi.fn()}
        onCreateAt={vi.fn()}
      />,
    );

  it('las celdas fuera de los tramos se ven y lo dicen (antes nada avisaba)', () => {
    const { container } = renderGrid({ schedule: [{ date: '2026-11-20T00:00:00.000Z', slots }] });
    // Rango visible: la jornada más lo que dura el último slot (hasta las
    // 21:30); solo la media hora de las 21:00 queda fuera
    expect(container.querySelectorAll('[data-outside]')).toHaveLength(1);
    // Ampliado hasta las 23:00: las 4 medias horas de 21:00 a 23:00 quedan fuera
    const [, to] = screen.getAllByRole('combobox');
    fireEvent.change(to, { target: { value: String(23 * 60) } });
    expect(container.querySelectorAll('[data-outside]')).toHaveLength(4);
    expect(screen.getAllByTitle('Crear partido aquí (fuera de los tramos de la jornada)')).toHaveLength(4);
    expect(screen.getByText(/Rayado: fuera de los tramos de la jornada/)).toBeInTheDocument();
  });

  it('sin jornadas con fecha no se marca nada', () => {
    const { container } = renderGrid({ schedule: [] });
    expect(container.querySelectorAll('[data-outside]')).toHaveLength(0);
  });

  it('una final dura lo de la eliminatoria: 90 min son 3 filas', () => {
    const { container } = renderGrid({ schedule: [], elimMatchDuration: 90 }, 'FINAL');
    const card = Array.from(container.querySelectorAll<HTMLElement>('div')).find((d) => d.style.gridRow?.includes('span'));
    expect(card?.style.gridRow).toBe('2 / span 3');
  });
});
