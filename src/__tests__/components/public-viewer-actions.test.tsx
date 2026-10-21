import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('sonner', () => ({
  toast: { info: vi.fn() },
}));

import { toast } from 'sonner';
import { PublicViewerActions } from '../../../components/admin/public-viewer-actions';

const HINT = 'Publica el torneo para compartirlo';

describe('PublicViewerActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publicado: el widget TV abre el directo y «Visor público» abre el modal de compartir', () => {
    const onShare = vi.fn();
    render(<PublicViewerActions tournamentId="t1" isDraft={false} onShare={onShare} />);

    const widget = screen.getByRole('link', { name: 'Widget TV' });
    expect(widget).toHaveAttribute('href', '/torneo/t1/live');
    expect(widget).not.toHaveAttribute('aria-disabled');
    fireEvent.click(screen.getByRole('button', { name: 'Compartir visor público' }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('borrador: los dos desactivados, sin enlace, y el motivo visible sin pasar el ratón', () => {
    const onShare = vi.fn();
    render(<PublicViewerActions tournamentId="t1" isDraft onShare={onShare} />);

    const hint = screen.getByText(HINT);
    const widget = screen.getByRole('link', { name: 'Widget TV' });
    const share = screen.getByRole('button', { name: 'Compartir visor público' });
    for (const control of [widget, share]) {
      expect(control).toHaveAttribute('aria-disabled', 'true');
      expect(control).toHaveAttribute('title', HINT);
      // El motivo, también para el lector de pantalla
      expect(control).toHaveAttribute('aria-describedby', hint.id);
    }
    expect(widget).not.toHaveAttribute('href');

    // Al tocarlos, el aviso; no se comparte
    fireEvent.click(share);
    fireEvent.click(widget);
    expect(onShare).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledTimes(2);
    expect(toast.info).toHaveBeenCalledWith(HINT);
  });

  it('borrador con teclado: los dos son enfocables y Enter explica el motivo', () => {
    render(<PublicViewerActions tournamentId="t1" isDraft onShare={vi.fn()} />);

    const widget = screen.getByRole('link', { name: 'Widget TV' });
    widget.focus();
    expect(widget).toHaveFocus();
    fireEvent.keyDown(widget, { key: 'Enter' });
    expect(toast.info).toHaveBeenCalledWith(HINT);

    const share = screen.getByRole('button', { name: 'Compartir visor público' });
    share.focus();
    expect(share).toHaveFocus();
  });
});
