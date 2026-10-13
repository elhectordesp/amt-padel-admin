/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printRegistrations, printSchedule, printTournamentReport } from '../../../lib/utils/print';

const makeMockWindow = () => {
  let html = '';
  const write = vi.fn((s: string) => { html += s; });
  const close = vi.fn();
  return { win: { document: { write, close } }, getHtml: () => html };
};

const makeTournament = (overrides: any = {}): any => ({
  id: 't1',
  name: 'Torneo Test',
  startDate: '2026-05-10T00:00:00Z',
  endDate:   '2026-05-11T00:00:00Z',
  status: 'OPEN',
  categories: [],
  club: { id: 'c1', name: 'Club Madrid', city: 'Madrid' },
  ...overrides,
});

const makePair = (overrides: any = {}): any => ({
  pairKey: 'u1-u2',
  ids: ['u1'],
  status: 'CONFIRMED',
  primary: {
    id: 'reg-1',
    tournamentId: 't1',
    categoryId: 'cat-1',
    userId: 'u1',
    user: { name: 'Ana López', spaPoints: null, categoryLevel: '4a' },
    partner: null,
    category: { gender: 'M', level: '4a', price: 20 },
    paid: false,
    createdAt: '2026-01-01T00:00:00Z',
  },
  ...overrides,
});

// ── printRegistrations ─────────────────────────────────────────────────────

describe('printRegistrations', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let mockData: ReturnType<typeof makeMockWindow>;

  beforeEach(() => {
    mockData = makeMockWindow();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(mockData.win as unknown as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it('abre una ventana y escribe HTML', () => {
    printRegistrations(makeTournament(), [makePair()]);
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(mockData.win.document.write).toHaveBeenCalled();
  });

  it('no hace nada si window.open devuelve null', () => {
    openSpy.mockReturnValue(null as unknown as Window);
    expect(() => printRegistrations(makeTournament(), [makePair()])).not.toThrow();
  });

  it('escapa < y > en el nombre del torneo', () => {
    printRegistrations(makeTournament({ name: '<script>xss</script>' }), [makePair()]);
    const html = mockData.getHtml();
    expect(html).toContain('&lt;script&gt;xss&lt;/script&gt;');
    expect(html).not.toContain('<script>xss');
  });

  it('escapa & en el nombre del torneo', () => {
    printRegistrations(makeTournament({ name: 'Club A & B' }), [makePair()]);
    expect(mockData.getHtml()).toContain('Club A &amp; B');
  });

  it('escapa " y \' en el nombre del torneo', () => {
    printRegistrations(makeTournament({ name: 'It\'s "special"' }), [makePair()]);
    const html = mockData.getHtml();
    expect(html).toContain('&#39;');
    expect(html).toContain('&quot;');
  });

  it('escapa XSS en el nombre del jugador', () => {
    const pair = makePair();
    pair.primary.user.name = '<img src=x onerror=alert(1)>';
    printRegistrations(makeTournament(), [pair]);
    const html = mockData.getHtml();
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('escapa XSS en el nombre del partner', () => {
    const pair = makePair();
    pair.primary.partner = { name: '"><script>alert(1)</script>', spaPoints: null, categoryLevel: '4a' };
    printRegistrations(makeTournament(), [pair]);
    const html = mockData.getHtml();
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).not.toContain('"><script>');
  });

  it('escapa XSS en el nombre del club', () => {
    printRegistrations(
      makeTournament({ club: { id: 'c1', name: '<bad>', city: 'Madrid' } }),
      [makePair()],
    );
    const html = mockData.getHtml();
    expect(html).toContain('&lt;bad&gt;');
    expect(html).not.toContain('<bad>');
  });

  it('escapa el nivel del jugador, del partner y de la categoría', () => {
    const pair = makePair();
    pair.primary.user.categoryLevel = '<i>4a';
    pair.primary.partner = { name: 'Bea', spaPoints: null, categoryLevel: '<b>3a' };
    pair.primary.category.level = '<u>4a';
    printRegistrations(makeTournament(), [pair]);
    const html = mockData.getHtml();
    expect(html).toContain('&lt;i&gt;4a');
    expect(html).toContain('&lt;b&gt;3a');
    expect(html).toContain('&lt;u&gt;4a');
    expect(html).not.toMatch(/<[ibu]>/);
  });

  it('filtra inscripciones CANCELLED', () => {
    const cancelled = makePair({ status: 'CANCELLED' });
    printRegistrations(makeTournament(), [cancelled]);
    const html = mockData.getHtml();
    // El section de categoría queda vacío → no se genera la tabla
    expect(html).not.toContain('<tbody>');
  });

  it('muestra "Sin pareja" si partner es null', () => {
    printRegistrations(makeTournament(), [makePair()]);
    expect(mockData.getHtml()).toContain('Sin pareja');
  });
});

// ── printSchedule ──────────────────────────────────────────────────────────

describe('printSchedule', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let mockData: ReturnType<typeof makeMockWindow>;

  beforeEach(() => {
    mockData = makeMockWindow();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(mockData.win as unknown as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  const makeMatch = (overrides: any = {}): any => ({
    id: 'm1',
    date: '2026-05-10T10:00:00Z',
    court: 'Pista 1',
    categoryId: 'cat-1',
    phase: 'GROUPS',
    team1: ['Ana', 'Bea'],
    team2: ['Carlos', 'David'],
    status: 'pending',
    sets1: [],
    sets2: [],
    winner: undefined,
    ...overrides,
  });

  it('no hace nada si no hay partidos con fecha', () => {
    printSchedule(makeTournament(), [{ id: 'm1', date: null } as any], {});
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('abre una ventana y escribe HTML cuando hay partidos', () => {
    printSchedule(makeTournament(), [makeMatch()], { 'cat-1': 'Masculino 4ª' });
    expect(openSpy).toHaveBeenCalledWith('', '_blank');
    expect(mockData.win.document.write).toHaveBeenCalled();
  });

  it('escapa XSS en los nombres de equipos', () => {
    printSchedule(
      makeTournament(),
      [makeMatch({ team1: ['<script>evil</script>', 'Player B'] })],
      {},
    );
    const html = mockData.getHtml();
    expect(html).toContain('&lt;script&gt;evil&lt;/script&gt;');
    expect(html).not.toContain('<script>evil');
  });

  it('escapa XSS en el nombre del torneo', () => {
    printSchedule(
      makeTournament({ name: '"><svg/onload=alert(1)>' }),
      [makeMatch()],
      {},
    );
    const html = mockData.getHtml();
    expect(html).toContain('&quot;&gt;&lt;svg/onload=alert(1)&gt;');
  });

  it('escapa XSS en el nombre de la pista (lo escribe un club)', () => {
    printSchedule(
      makeTournament(),
      [makeMatch({ court: '<img src=x onerror=alert(1)>' })],
      {},
    );
    const html = mockData.getHtml();
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
  });

  it('escapa la categoría y una fase desconocida', () => {
    printSchedule(
      makeTournament(),
      [makeMatch({ phase: '<b>RARA' })],
      { 'cat-1': '<script>cat</script>' },
    );
    const html = mockData.getHtml();
    expect(html).toContain('&lt;script&gt;cat&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;RARA');
    expect(html).not.toContain('<script>cat');
    expect(html).not.toContain('<b>RARA');
  });

  it('no hace nada si window.open devuelve null', () => {
    openSpy.mockReturnValue(null as unknown as Window);
    expect(() => printSchedule(makeTournament(), [makeMatch()], {})).not.toThrow();
  });

  it('muestra el resultado cuando el partido está FINISHED', () => {
    const match = makeMatch({
      status: 'finished',
      sets1: [6, 7],
      sets2: [3, 5],
      winner: 'team1',
    });
    printSchedule(makeTournament(), [match], {});
    const html = mockData.getHtml();
    expect(html).toContain('6-3');
    expect(html).toContain('7-5');
  });

  it('muestra "Pendiente" cuando el partido no está FINISHED', () => {
    printSchedule(makeTournament(), [makeMatch({ status: 'pending' })], {});
    expect(mockData.getHtml()).toContain('Pendiente');
  });
});

// ── printTournamentReport ──────────────────────────────────────────────────

describe('printTournamentReport', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let mockData: ReturnType<typeof makeMockWindow>;

  beforeEach(() => {
    mockData = makeMockWindow();
    openSpy = vi.spyOn(window, 'open').mockReturnValue(mockData.win as unknown as Window);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  const finalMatch: any = {
    id: 'm1',
    date: '2026-05-11T18:00:00Z',
    court: 'Central',
    categoryId: 'cat-1',
    phase: 'FINAL',
    team1: ['Ana', 'Bea'],
    team2: ['Carla', 'Dora'],
    status: 'finished',
    sets1: [6, 6],
    sets2: [4, 3],
    winner: 'team1',
  };

  it('usa el color del torneo si es #rrggbb', () => {
    printTournamentReport(makeTournament({ imageColor: '#1A1400' }), [finalMatch]);
    expect(mockData.getHtml()).toContain('border-bottom: 3px solid #1A1400');
  });

  it('un color que no es #rrggbb no llega al CSS: usa el de por defecto', () => {
    const evil = 'red}</style><script>alert(1)</script><style>';
    printTournamentReport(makeTournament({ imageColor: evil }), [finalMatch]);
    const html = mockData.getHtml();
    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('border-bottom: 3px solid #D4AF37');
  });

  it('escapa la categoría, la pista y los equipos', () => {
    printTournamentReport(
      makeTournament({ categories: [{ id: 'cat-1', gender: 'M', level: '<b>4a' }] }),
      [{ ...finalMatch, court: '<i>Central', team1: ['<u>Ana', 'Bea'] }],
    );
    const html = mockData.getHtml();
    expect(html).toContain('&lt;b&gt;4a');
    expect(html).toContain('&lt;u&gt;Ana');
    expect(html).not.toMatch(/<[biu]>/);
  });
});
