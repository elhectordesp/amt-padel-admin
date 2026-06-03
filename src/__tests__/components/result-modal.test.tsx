import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultModal } from '../../../components/admin/result-modal';
import type { MatchResult } from '../../../types';

vi.mock('@/lib/constants', () => ({
  phaseLabel: (phase: string) => phase,
}));

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    id:            'match-1',
    tournament:    'Torneo A',
    phase:         'GROUPS',
    date:          '2026-07-01T10:00:00',
    court:         'Pista 1',
    team1:         ['Jugador A', 'Jugador B'],
    team2:         ['Jugador C', 'Jugador D'],
    isResult:      false,
    status:        'pending',
    scoringFormat: 'BEST_OF_3',
    ...overrides,
  };
}

function baseProps(overrides: Partial<Parameters<typeof ResultModal>[0]> = {}) {
  return {
    match:   makeMatch(),
    onClose: vi.fn(),
    onSave:  vi.fn(),
    saving:  false,
    ...overrides,
  };
}

function fillSet(index: number, a: string, b: string) {
  const inputs = screen.getAllByRole('spinbutton');
  fireEvent.change(inputs[index * 2],     { target: { value: a } });
  fireEvent.change(inputs[index * 2 + 1], { target: { value: b } });
}

describe('ResultModal', () => {
  it('muestra los nombres de los equipos y el separador VS', () => {
    render(<ResultModal {...baseProps()} />);
    expect(screen.getByText('Jugador A / Jugador B')).toBeInTheDocument();
    expect(screen.getByText('Jugador C / Jugador D')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('muestra "Introducir resultado" cuando isCorrection=false', () => {
    render(<ResultModal {...baseProps({ isCorrection: false })} />);
    expect(screen.getByText('Introducir resultado')).toBeInTheDocument();
  });

  it('muestra "Corregir resultado" cuando isCorrection=true', () => {
    const match = makeMatch({ sets1: [6, 3], sets2: [4, 6] });
    render(<ResultModal {...baseProps({ match, isCorrection: true })} />);
    expect(screen.getByText('Corregir resultado')).toBeInTheDocument();
  });

  it('el botón de guardar está deshabilitado cuando no hay sets rellenos', () => {
    render(<ResultModal {...baseProps()} />);
    expect(screen.getByRole('button', { name: /guardar resultado/i })).toBeDisabled();
  });

  it('el botón de guardar se habilita cuando hay al menos 2 sets rellenos', () => {
    render(<ResultModal {...baseProps()} />);
    fillSet(0, '6', '3');
    fillSet(1, '6', '4');
    expect(screen.getByRole('button', { name: /guardar resultado/i })).not.toBeDisabled();
  });

  it('muestra error de validación cuando hay empate en un set', () => {
    render(<ResultModal {...baseProps()} />);
    fillSet(0, '6', '6');
    fillSet(1, '3', '6');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/no puede haber empate/i)).toBeInTheDocument();
  });

  it('muestra error de validación cuando el set tiene formato inválido (6-5)', () => {
    render(<ResultModal {...baseProps()} />);
    fillSet(0, '6', '5');
    fillSet(1, '6', '3');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/resultado inválido/i)).toBeInTheDocument();
  });

  it('llama a onSave con los arrays correctos para sets válidos (6-3, 7-5)', () => {
    const onSave = vi.fn();
    render(<ResultModal {...baseProps({ onSave })} />);
    fillSet(0, '6', '3');
    fillSet(1, '7', '5');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(onSave).toHaveBeenCalledWith([6, 7], [3, 5]);
  });

  it('acepta 7-6 como set válido', () => {
    const onSave = vi.fn();
    render(<ResultModal {...baseProps({ onSave })} />);
    fillSet(0, '7', '6');
    fillSet(1, '6', '3');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(onSave).toHaveBeenCalledWith([7, 6], [6, 3]);
  });

  it('acepta supertiebreak (10-8) en set 3 para BEST_OF_2_SUPERTB', () => {
    const onSave = vi.fn();
    const match  = makeMatch({ scoringFormat: 'BEST_OF_2_SUPERTB' });
    render(<ResultModal {...baseProps({ match, onSave })} />);
    fillSet(0, '6', '3');
    fillSet(1, '3', '6');
    fillSet(2, '10', '8');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(onSave).toHaveBeenCalledWith([6, 3, 10], [3, 6, 8]);
  });

  it('rechaza supertiebreak empatado (10-10) en set 3 para BEST_OF_2_SUPERTB', () => {
    const match = makeMatch({ scoringFormat: 'BEST_OF_2_SUPERTB' });
    render(<ResultModal {...baseProps({ match })} />);
    fillSet(0, '6', '3');
    fillSet(1, '3', '6');
    fillSet(2, '10', '10');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/no puede haber empate/i)).toBeInTheDocument();
  });

  it('rechaza supertiebreak con diferencia de 1 (10-9)', () => {
    const match = makeMatch({ scoringFormat: 'BEST_OF_2_SUPERTB' });
    render(<ResultModal {...baseProps({ match })} />);
    fillSet(0, '6', '3');
    fillSet(1, '3', '6');
    fillSet(2, '10', '9');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/resultado inválido/i)).toBeInTheDocument();
  });

  it('rechaza valores negativos en un set', () => {
    render(<ResultModal {...baseProps()} />);
    fillSet(0, '-1', '6');
    fillSet(1, '6', '3');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/números enteros no negativos/i)).toBeInTheDocument();
  });

  it('rechaza valores decimales en un set', () => {
    render(<ResultModal {...baseProps()} />);
    fillSet(0, '6.5', '3');
    fillSet(1, '6', '4');
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(screen.getByText(/números enteros no negativos/i)).toBeInTheDocument();
  });

  it('llama a onClose al hacer clic en Cancelar', () => {
    const onClose = vi.fn();
    render(<ResultModal {...baseProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('llama a onClose al hacer clic en el backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<ResultModal {...baseProps({ onClose })} />);
    const backdrop = container.querySelector('.absolute.inset-0');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('muestra spinner cuando saving=true', () => {
    render(<ResultModal {...baseProps({ saving: true })} />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('pre-rellena los sets en modo corrección', () => {
    const match = makeMatch({ sets1: [6, 3], sets2: [4, 6] });
    render(<ResultModal {...baseProps({ match, isCorrection: true })} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(6);
    expect(inputs[1]).toHaveValue(4);
    expect(inputs[2]).toHaveValue(3);
    expect(inputs[3]).toHaveValue(6);
  });

  it('el botón de guardar muestra "Guardar corrección" en modo corrección', () => {
    const match = makeMatch({ sets1: [6, 3], sets2: [4, 6] });
    render(<ResultModal {...baseProps({ match, isCorrection: true })} />);
    expect(screen.getByRole('button', { name: /guardar corrección/i })).toBeInTheDocument();
  });
});
