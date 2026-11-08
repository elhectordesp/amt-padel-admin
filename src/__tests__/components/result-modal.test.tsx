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

  it.each([['11', '9'], ['12', '10']])('acepta supertiebreak alargado (%s-%s)', (a, b) => {
    const onSave = vi.fn();
    const match  = makeMatch({ scoringFormat: 'BEST_OF_2_SUPERTB' });
    render(<ResultModal {...baseProps({ match, onSave })} />);
    fillSet(0, '6', '3');
    fillSet(1, '3', '6');
    fillSet(2, a, b);
    fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
    expect(onSave).toHaveBeenCalledWith([6, 3, Number(a)], [3, 6, Number(b)]);
  });

  // Se acaba en cuanto alguien llega a 10 con 2 de diferencia: el back rechaza
  // estos marcadores con 400 MATCH_SCORE_INVALID
  it.each([['11', '8'], ['15', '3'], ['99', '0'], ['13', '10']])(
    'rechaza supertiebreak imposible (%s-%s)',
    (a, b) => {
      const onSave = vi.fn();
      const match  = makeMatch({ scoringFormat: 'BEST_OF_2_SUPERTB' });
      render(<ResultModal {...baseProps({ match, onSave })} />);
      fillSet(0, '6', '3');
      fillSet(1, '3', '6');
      fillSet(2, a, b);
      fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
      expect(screen.getByText(/resultado inválido/i)).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    },
  );

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

  // ── B5-2 — Formatos cortos ─────────────────────────────────────────────

  describe('Formatos de partido (B5-2)', () => {
    const save = () => fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));

    it('3 sets y 2 sets + súper tie-break: tres casillas y el marcador válido a la vista', () => {
      render(<ResultModal {...baseProps()} />);
      expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
      expect(screen.getByText('3 sets')).toBeInTheDocument();
      expect(screen.getByText(/Marcador válido: 3 sets: cada set 6-0 a 6-4, 7-5 o 7-6/)).toBeInTheDocument();
    });

    it('un partido sin formato conocido se trata como a 3 sets', () => {
      render(<ResultModal {...baseProps({ match: makeMatch({ scoringFormat: undefined }) })} />);
      expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
    });

    it('a 3 sets, dos sets repartidos no cierran el partido', () => {
      const onSave = vi.fn();
      render(<ResultModal {...baseProps({ onSave })} />);
      fillSet(0, '6', '3');
      fillSet(1, '3', '6');
      save();
      expect(screen.getByText('Partido incompleto: el ganador debe ganar 2 sets')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('1 set (tie-break a 6-6): una casilla, se guarda con un set y 6-5 se rechaza', () => {
      const onSave = vi.fn();
      const match  = makeMatch({ scoringFormat: 'ONE_SET' });
      render(<ResultModal {...baseProps({ match, onSave })} />);
      expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
      expect(screen.getByText('1 set (tie-break a 6-6)')).toBeInTheDocument();
      expect(screen.getByText(/Marcador válido: 1 set: 6-0 a 6-4, 7-5 o 7-6/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /guardar resultado/i })).toBeDisabled();

      fillSet(0, '6', '5');
      expect(screen.getByRole('button', { name: /guardar resultado/i })).not.toBeDisabled();
      save();
      expect(screen.getByText('Set 1: resultado inválido (6-5). Esperado: 6-0 a 6-4, 7-5 o 7-6')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();

      fillSet(0, '7', '6');
      save();
      expect(onSave).toHaveBeenCalledWith([7], [6]);
    });

    it('1 set (juego decisivo a 5-5): 6-5 vale y 7-5 no', () => {
      const onSave = vi.fn();
      const match  = makeMatch({ scoringFormat: 'ONE_SET_GOLDEN_GAME' });
      render(<ResultModal {...baseProps({ match, onSave })} />);
      expect(screen.getByText(/Marcador válido: 1 set: 6-0 a 6-4 o 6-5/)).toBeInTheDocument();
      fillSet(0, '7', '5');
      save();
      expect(screen.getByText('Set 1: resultado inválido (7-5). Esperado: 6-0 a 6-4 o 6-5')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();

      fillSet(0, '5', '6');
      save();
      expect(onSave).toHaveBeenCalledWith([5], [6]);
    });

    it('a 9 juegos: 9-8 vale y 10-8 se rechaza con el marcador esperado', () => {
      const onSave = vi.fn();
      const match  = makeMatch({ scoringFormat: 'PRO_SET_9' });
      render(<ResultModal {...baseProps({ match, onSave })} />);
      expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
      expect(screen.getByText(/Marcador válido: a 9 juegos: 9-0 a 9-8/)).toBeInTheDocument();
      fillSet(0, '10', '8');
      save();
      expect(screen.getByText('Set 1: resultado inválido (10-8). Esperado: 9-0 a 9-8')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();

      fillSet(0, '9', '8');
      save();
      expect(onSave).toHaveBeenCalledWith([9], [8]);
    });

    it('2 sets (tie-break a 5-5) + súper tie-break: tres casillas, sets a 6-5 y súper tie-break como 3.º', () => {
      const onSave = vi.fn();
      const match  = makeMatch({ scoringFormat: 'SHORT_SETS_SUPERTB' });
      render(<ResultModal {...baseProps({ match, onSave })} />);
      expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
      expect(screen.getByText('supertb')).toBeInTheDocument();

      fillSet(0, '7', '5');
      fillSet(1, '6', '4');
      save();
      expect(screen.getByText('Set 1: resultado inválido (7-5). Esperado: 6-0 a 6-4 o 6-5')).toBeInTheDocument();

      fillSet(0, '6', '5');
      fillSet(1, '5', '6');
      fillSet(2, '10', '8');
      save();
      expect(onSave).toHaveBeenCalledWith([6, 5, 10], [5, 6, 8]);
    });

    it('en una corrección de un set, la casilla sale con el marcador guardado', () => {
      const match = makeMatch({ scoringFormat: 'PRO_SET_9', sets1: [9], sets2: [7] });
      render(<ResultModal {...baseProps({ match, isCorrection: true })} />);
      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toHaveValue(9);
      expect(inputs[1]).toHaveValue(7);
    });
  });

  // ── A2 — Walkover ─────────────────────────────────────────────────────

  describe('Walkover (A2)', () => {
    it('muestra los botones de modo Resultado y Walkover', () => {
      render(<ResultModal {...baseProps()} />);
      expect(screen.getByRole('button', { name: 'Resultado' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /walkover/i })).toBeInTheDocument();
    });

    it('al cambiar a modo Walkover oculta los inputs de sets', () => {
      render(<ResultModal {...baseProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('al cambiar a modo Walkover muestra los 2 botones de pareja ganadora', () => {
      render(<ResultModal {...baseProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      expect(screen.getByRole('button', { name: /Gana pareja 1.*Jugador A.*Jugador B/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Gana pareja 2.*Jugador C.*Jugador D/i })).toBeInTheDocument();
    });

    it('el botón de guardar está deshabilitado hasta elegir ganador del walkover', () => {
      render(<ResultModal {...baseProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      expect(screen.getByRole('button', { name: /registrar walkover/i })).toBeDisabled();
    });

    it('al elegir pareja 1 como ganadora se habilita el botón Registrar walkover', () => {
      render(<ResultModal {...baseProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      fireEvent.click(screen.getByRole('button', { name: /Gana pareja 1.*Jugador A.*Jugador B/i }));
      expect(screen.getByRole('button', { name: /registrar walkover/i })).not.toBeDisabled();
    });

    it('llama onSave con walkover=true y walkoverWinnerTeam=1', () => {
      const onSave = vi.fn();
      render(<ResultModal {...baseProps({ onSave })} />);
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      fireEvent.click(screen.getByRole('button', { name: /Gana pareja 1.*Jugador A.*Jugador B/i }));
      fireEvent.click(screen.getByRole('button', { name: /registrar walkover/i }));
      expect(onSave).toHaveBeenCalledWith([], [], { walkover: true, walkoverWinnerTeam: 1 });
    });

    it('llama onSave con walkover=true y walkoverWinnerTeam=2', () => {
      const onSave = vi.fn();
      render(<ResultModal {...baseProps({ onSave })} />);
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      fireEvent.click(screen.getByRole('button', { name: /Gana pareja 2.*Jugador C.*Jugador D/i }));
      fireEvent.click(screen.getByRole('button', { name: /registrar walkover/i }));
      expect(onSave).toHaveBeenCalledWith([], [], { walkover: true, walkoverWinnerTeam: 2 });
    });

    it('en modo corrección con match isWalkover=true preselecciona modo Walkover', () => {
      const match = makeMatch({
        sets1: [6, 6], sets2: [0, 0],
        isResult: true,
        winner: 'team1',
        isWalkover: true,
      });
      render(<ResultModal {...baseProps({ match, isCorrection: true })} />);
      // El botón debe ser "Guardar W.O. corregido"
      expect(screen.getByRole('button', { name: /guardar w\.o\. corregido/i })).toBeInTheDocument();
      // Y debe haber un overlay con el aviso de walkover (texto)
      expect(screen.getByText(/no se presentó/i)).toBeInTheDocument();
    });

    it('alternar Score → Walkover → Score limpia validation error', () => {
      render(<ResultModal {...baseProps()} />);
      // Provocar error en score mode
      fillSet(0, '6', '6');
      fillSet(1, '3', '6');
      fireEvent.click(screen.getByRole('button', { name: /guardar resultado/i }));
      expect(screen.getByText(/no puede haber empate/i)).toBeInTheDocument();
      // Cambiar a walkover limpia el error
      fireEvent.click(screen.getByRole('button', { name: /walkover/i }));
      expect(screen.queryByText(/no puede haber empate/i)).not.toBeInTheDocument();
    });
  });
});
